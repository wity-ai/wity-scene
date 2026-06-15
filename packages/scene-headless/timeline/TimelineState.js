/**
 * @file timeline/TimelineState.js
 * Playhead state for scene preview. Owns current time and play/pause.
 * Drives itself via requestAnimationFrame in browser, or a timer in Node.js.
 * The renderer calls evaluate(store.getScene(), timeline.currentTime) each frame.
 */

import { EventBus } from '../core/EventBus.js';

export class TimelineState extends EventBus {
  /**
   * @param {import('../core/SceneStore.js').SceneStore} store
   * @param {{ fps?: number }} [options]
   */
  constructor(store, { fps = 60 } = {}) {
    super();
    this._store     = store;
    this._fps       = fps;
    this._t         = 0;
    this._playing   = false;
    this._rafId     = null;
    this._lastTs    = null;

    // Sync duration when scene changes
    store.on('scene:replaced', () => { this.seek(0); });
    store.on('scene:updated',  () => {
      if (this._t > this._duration()) this.seek(this._duration());
    });
  }

  // ─── Playback ─────────────────────────────────────────────────────────────

  play() {
    if (this._playing) return;
    // Wrap around if at end
    if (this._t >= this._duration()) this._t = 0;
    this._playing = true;
    this._lastTs  = null;
    this._tick();
    this.emit('playback:started', { t: this._t });
  }

  pause() {
    if (!this._playing) return;
    this._playing = false;
    this._cancelTick();
    this.emit('playback:paused', { t: this._t });
  }

  stop() {
    this._playing = false;
    this._cancelTick();
    this._t = 0;
    this.emit('playback:stopped', {});
    this.emit('time:changed', { t: 0 });
  }

  /**
   * Jump to a specific time. Clamps to [0, duration].
   * @param {number} t
   */
  seek(t) {
    this._t = Math.min(Math.max(0, t), this._duration());
    this.emit('time:changed', { t: this._t });
  }

  // ─── State reads ──────────────────────────────────────────────────────────

  /** @returns {number} */
  get currentTime() { return this._t; }

  /** @returns {boolean} */
  get isPlaying() { return this._playing; }

  /** @returns {number} */
  get duration() { return this._duration(); }

  /** @returns {number} 0–1 */
  get progress() {
    const dur = this._duration();
    return dur > 0 ? this._t / dur : 0;
  }

  // ─── Internal tick ────────────────────────────────────────────────────────

  _tick() {
    const step = (ts) => {
      if (!this._playing) return;
      if (this._lastTs !== null) {
        const dt = (ts - this._lastTs) / 1000;
        this._t  = Math.min(this._t + dt, this._duration());
        this.emit('time:changed', { t: this._t });
        if (this._t >= this._duration()) {
          this._playing = false;
          this.emit('playback:ended', { t: this._t });
          return;
        }
      }
      this._lastTs = ts;
      this._rafId  = this._requestFrame(step);
    };
    this._rafId = this._requestFrame(step);
  }

  _cancelTick() {
    if (this._rafId != null) {
      this._cancelFrame(this._rafId);
      this._rafId  = null;
      this._lastTs = null;
    }
  }

  _duration() {
    return this._store.getScene().dur ?? 0;
  }

  // RAF shim — works in browser and Node.js
  _requestFrame(fn) {
    if (typeof requestAnimationFrame !== 'undefined') {
      return requestAnimationFrame(fn);
    }
    return setTimeout(() => fn(Date.now()), 1000 / this._fps);
  }

  _cancelFrame(id) {
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(id);
    } else {
      clearTimeout(id);
    }
  }

  destroy() {
    this.pause();
    super.destroy();
  }
}
