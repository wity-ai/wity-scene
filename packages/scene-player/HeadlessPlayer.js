/**
 * @file HeadlessPlayer.js
 * Headless composition player for wity-scene.
 *
 * Drives evaluate(scene, t) at playback rate via RAF (or setTimeout in Node.js).
 * Emits 'frame' on every tick with the ComputedFrame at current time.
 * Presentation-agnostic: wire any renderer to the 'frame' event.
 *
 * Architecture:
 *   HeadlessPlayer
 *     ├── SceneStore       — mutable scene document (from scene-headless)
 *     ├── TimelineState    — playhead, RAF loop  (from scene-headless)
 *     └── evaluate()       — f(scene, t) → ComputedFrame  (from scene-core)
 *
 * Usage:
 *   const player = new HeadlessPlayer();
 *   player.loadXml(xml);
 *   player.on('frame', ({ frame, t }) => renderFrame(frame));
 *   player.play();
 *
 *   // Mutation — e.g. media URL arrives for a pending layer:
 *   player.updateElement(elementId, { src: url });
 *   // Next tick automatically reflects the change — no reload.
 *
 *   player.destroy();
 *
 * Events emitted:
 *   'frame'            { frame: ComputedFrame, t: number }
 *   'playback:started' { t: number }
 *   'playback:paused'  { t: number }
 *   'playback:stopped' {}
 *   'playback:ended'   { t: number }
 *   'time:changed'     { t: number }
 *   'scene:loaded'     { scene: WityScene }
 *   'scene:mutated'    { scene: WityScene }
 */

import { EventBus }      from '@wity/scene-headless';
import { SceneStore }    from '@wity/scene-headless';
import { TimelineState } from '@wity/scene-headless';
import { parse, evaluate, serialize } from '@wity/scene-core';

export class HeadlessPlayer extends EventBus {
  /**
   * @param {{ fps?: number }} [options]
   */
  constructor({ fps = 60 } = {}) {
    super();

    /** @type {InstanceType<typeof SceneStore> | null} */
    this._store    = null;

    /** @type {InstanceType<typeof TimelineState> | null} */
    this._timeline = null;

    this._fps = fps;

    /** @type {(() => void)[]} — internal unsub handles collected per load */
    this._unsubs = [];
  }

  // ─── Scene loading ────────────────────────────────────────────────────────

  /**
   * Load a scene from XML. Safe to call multiple times — replaces previous scene.
   * @param {string} xml
   */
  loadXml(xml) {
    const scene = parse(xml);
    this._init(scene);
  }

  /**
   * Load a scene from an already-parsed WityScene object.
   * @param {import('@wity/scene-core').WityScene} scene
   */
  loadScene(scene) {
    this._init(scene);
  }

  /**
   * Replace the entire scene document at runtime.
   * Timeline resets to 0 but retains play/pause state.
   * @param {string} xml
   */
  replaceXml(xml) {
    if (!this._store) { this.loadXml(xml); return; }
    const wasPlaying = this._timeline?.isPlaying ?? false;
    this._store.setScene(parse(xml));
    if (wasPlaying) this._timeline?.play();
  }

  // ─── Scene mutation API ───────────────────────────────────────────────────
  // These mirror SceneStore's authoring surface but are surfaced here so
  // callers only need a single reference — the player.

  /**
   * Add a layer. Returns the new layer id.
   * @param {Record<string, unknown>} data
   * @returns {string}
   */
  addLayer(data) {
    this._assertLoaded();
    const id = this._store.addLayer(data);
    this._emitMutated();
    return id;
  }

  /**
   * Update a layer by id.
   * @param {string} id
   * @param {Record<string, unknown>} patch
   */
  updateLayer(id, patch) {
    this._assertLoaded();
    this._store.updateLayer(id, patch);
    this._emitMutated();
  }

  /** @param {string} id */
  removeLayer(id) {
    this._assertLoaded();
    this._store.removeLayer(id);
    this._emitMutated();
  }

  /**
   * Add an element to a layer. Returns the new element id.
   * @param {string} layerId
   * @param {Record<string, unknown>} data
   * @returns {string}
   */
  addElement(layerId, data) {
    this._assertLoaded();
    const id = this._store.addElement(layerId, data);
    this._emitMutated();
    return id;
  }

  /**
   * Update an element by id.
   * @param {string} id
   * @param {Record<string, unknown>} patch
   */
  updateElement(id, patch) {
    this._assertLoaded();
    this._store.updateElement(id, patch);
    this._emitMutated();
  }

  /** @param {string} id */
  removeElement(id) {
    this._assertLoaded();
    this._store.removeElement(id);
    this._emitMutated();
  }

  // ─── Playback controls ────────────────────────────────────────────────────

  play() {
    this._assertLoaded();
    this._timeline.play();
  }

  pause() {
    this._timeline?.pause();
  }

  stop() {
    this._timeline?.stop();
  }

  /**
   * Seek to time t. Emits 'frame' immediately so the renderer updates.
   * @param {number} t
   */
  seek(t) {
    this._assertLoaded();
    this._timeline.seek(t);
    // Emit frame immediately so renderer reflects seek without waiting for next tick
    this._emitFrame(this._timeline.currentTime);
  }

  // ─── State reads ──────────────────────────────────────────────────────────

  /** @returns {number} */
  get currentTime() { return this._timeline?.currentTime ?? 0; }

  /** @returns {number} */
  get duration()    { return this._store?.getScene().dur ?? 0; }

  /** @returns {boolean} */
  get isPlaying()   { return this._timeline?.isPlaying ?? false; }

  /** @returns {boolean} */
  get isLoaded()    { return this._store !== null; }

  /** @returns {number} 0–1 */
  get progress()    { return this._timeline?.progress ?? 0; }

  /**
   * Synchronously evaluate the scene at time t and return the ComputedFrame.
   *
   * Use this for static snapshots — design studio background, thumbnail generation,
   * preview tiles, etc. For continuous playback, use play()/seek() with the 'frame'
   * event instead.
   *
   * @param {number} [t=0] - Time in seconds (clamped to [0, scene.dur])
   * @returns {import('@wity/scene-core').ComputedFrame | null} null if no scene loaded
   */
  getFrame(t = 0) {
    if (!this._store) return null;
    return evaluate(this._store.getScene(), t);
  }

  /**
   * Serialize current scene to XML. Useful for persisting mutations.
   * @returns {string | null}
   */
  getXml() {
    if (!this._store) return null;
    return serialize(this._store.getScene());
  }

  /**
   * Get the raw SceneStore for advanced authoring (history, snap, clipboard, etc.)
   * @returns {InstanceType<typeof SceneStore> | null}
   */
  getStore() {
    return this._store;
  }

  // ─── Teardown ─────────────────────────────────────────────────────────────

  destroy() {
    this._teardown();
    super.destroy();
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * @param {import('@wity/scene-core').WityScene} scene
   */
  _init(scene) {
    // Tear down previous instance if any
    this._teardown();

    this._store    = new SceneStore(scene);
    this._timeline = new TimelineState(this._store, { fps: this._fps });

    // Forward playback lifecycle events
    this._unsubs.push(
      this._timeline.on('playback:started', p => this.emit('playback:started', p)),
      this._timeline.on('playback:paused',  p => this.emit('playback:paused',  p)),
      this._timeline.on('playback:stopped', p => this.emit('playback:stopped', p)),
      this._timeline.on('playback:ended',   p => this.emit('playback:ended',   p)),
    );

    // On every time tick → evaluate → emit frame
    this._unsubs.push(
      this._timeline.on('time:changed', ({ t }) => {
        this.emit('time:changed', { t });
        this._emitFrame(t);
      }),
    );

    this.emit('scene:loaded', { scene: this._store.getScene() });
    // Emit initial frame at t=0
    this._emitFrame(0);
  }

  _teardown() {
    this._timeline?.destroy();
    this._store?.destroy();
    for (const unsub of this._unsubs) unsub();
    this._unsubs = [];
    this._store    = null;
    this._timeline = null;
  }

  _assertLoaded() {
    if (!this._store || !this._timeline) {
      throw new Error('HeadlessPlayer: no scene loaded. Call loadXml() or loadScene() first.');
    }
  }

  /** @param {number} t */
  _emitFrame(t) {
    const scene = this._store.getScene();
    const frame = evaluate(scene, t);
    this.emit('frame', { frame, t });
  }

  _emitMutated() {
    this.emit('scene:mutated', { scene: this._store.getScene() });
    // Emit a frame immediately so the renderer reflects the mutation without
    // waiting for the next RAF tick (matters when paused).
    this._emitFrame(this._timeline?.currentTime ?? 0);
  }
}
