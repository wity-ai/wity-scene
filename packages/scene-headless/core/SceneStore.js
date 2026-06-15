/**
 * @file core/SceneStore.js
 * Mutable authoring state for a WityScene document.
 *
 * Wraps an immutable WityScene (from scene-core) with granular mutation
 * methods and a fine-grained event bus. The store is the single source of
 * truth for the in-progress document; scene-core's evaluate() is called by
 * the renderer against store.getScene() at render time.
 *
 * Extensibility:
 *   - registerElementType(tag, config) — add custom element types beyond the
 *     built-in three without modifying the core
 *   - The event bus is open — emit and subscribe to any string event
 *   - All mutations are atomic and emit narrowly-scoped events so renderers
 *     and UI layers update only what changed
 */

import { EventBus }      from './EventBus.js';
import { ELEMENT_TAGS }  from '@wity/scene-core';

// ─── Default element type configs ────────────────────────────────────────────

const DEFAULT_ELEMENT_TYPES = {
  'ws-text': {
    label:    'Text',
    defaults: {
      x: '50%', y: '50%', anchor: 'center',
      begin: 0, dur: Infinity, z: 0, opacity: 1,
      animateIn: 'none', animateOut: 'none', animateDur: 0.4,
      fontSize: '3%', fontFamily: 'sans-serif', fontWeight: 'normal',
      color: '#ffffff', textAlign: 'center', lineHeight: 1.4,
      maxWidth: null, letterSpacing: 0, content: '',
    },
  },
  'ws-rect': {
    label:    'Rectangle',
    defaults: {
      x: 0, y: 0, anchor: 'top-left',
      begin: 0, dur: Infinity, z: 0, opacity: 1,
      animateIn: 'none', animateOut: 'none', animateDur: 0.4,
      width: '100%', height: '100%', fill: 'transparent',
      stroke: null, strokeWidth: 1, rx: 0,
    },
  },
  'ws-image': {
    label:    'Image',
    defaults: {
      x: 0, y: 0, anchor: 'top-left',
      begin: 0, dur: Infinity, z: 0, opacity: 1,
      animateIn: 'none', animateOut: 'none', animateDur: 0.4,
      src: '', width: '100%', height: '100%', fit: 'cover',
    },
  },
};

// ─── ID generation ────────────────────────────────────────────────────────────

let _counter = 0;
function uid(prefix = 'el') {
  return `${prefix}-${Date.now().toString(36)}-${(++_counter).toString(36)}`;
}

// ─── SceneStore ───────────────────────────────────────────────────────────────

export class SceneStore extends EventBus {
  /**
   * @param {import('@wity/scene-core').WityScene | null} [scene]
   */
  constructor(scene = null) {
    super();

    /** @type {import('@wity/scene-core').WityScene} */
    this._scene = scene ?? { version: '1.0', width: 1920, height: 1080, dur: 10, layers: [] };

    /** @type {Map<string, object>} element type registry */
    this._elementTypes = new Map(Object.entries(DEFAULT_ELEMENT_TYPES));

    // Internal maps for O(1) lookup — kept in sync with _scene
    this._layerMap   = new Map(); // id → layer
    this._elementMap = new Map(); // id → { element, layerId }
    this._rebuildMaps();
  }

  // ─── Scene-level ───────────────────────────────────────────────────────────

  /** @returns {import('@wity/scene-core').WityScene} */
  getScene() {
    return this._scene;
  }

  /**
   * Replace the entire scene document.
   * Useful for loading a newly parsed document.
   * @param {import('@wity/scene-core').WityScene} scene
   */
  setScene(scene) {
    this._scene = scene;
    this._rebuildMaps();
    this.emit('scene:replaced', { scene });
  }

  /**
   * Patch root scene properties (width, height, dur, version).
   * @param {{ width?: number, height?: number, dur?: number }} patch
   */
  updateScene(patch) {
    Object.assign(this._scene, patch);
    this.emit('scene:updated', { scene: this._scene });
  }

  // ─── Layer ops ─────────────────────────────────────────────────────────────

  /**
   * Add a new layer. Returns the created layer object.
   * @param {{ id?: string, z?: number, opacity?: number }} [data]
   * @returns {import('@wity/scene-core').WsLayer}
   */
  addLayer(data = {}) {
    const layer = {
      id:       data.id      ?? uid('layer'),
      z:        data.z       ?? this._scene.layers.length,
      opacity:  data.opacity ?? 1,
      elements: [],
    };
    this._scene.layers.push(layer);
    this._layerMap.set(layer.id, layer);
    this.emit('layer:added', { layer });
    return layer;
  }

  /**
   * Patch a layer's properties (z, opacity). Does not move elements.
   * @param {string} id
   * @param {{ z?: number, opacity?: number }} patch
   */
  updateLayer(id, patch) {
    const layer = this._layerMap.get(id);
    if (!layer) return;
    Object.assign(layer, patch);
    this.emit('layer:updated', { layer });
  }

  /**
   * Remove a layer and all its elements.
   * @param {string} id
   */
  removeLayer(id) {
    const layer = this._layerMap.get(id);
    if (!layer) return;
    // Unregister elements
    for (const el of layer.elements) this._elementMap.delete(el.id);
    this._scene.layers = this._scene.layers.filter((l) => l.id !== id);
    this._layerMap.delete(id);
    this.emit('layer:removed', { id });
  }

  /**
   * Reorder layers by providing the desired order of layer IDs.
   * Missing IDs are appended at the end in original order.
   * @param {string[]} ids
   */
  reorderLayers(ids) {
    const ordered = ids.map((id) => this._layerMap.get(id)).filter(Boolean);
    const rest    = this._scene.layers.filter((l) => !ids.includes(l.id));
    this._scene.layers = [...ordered, ...rest];
    this.emit('layers:reordered', { layers: this._scene.layers });
  }

  /**
   * @param {string} id
   * @returns {import('@wity/scene-core').WsLayer | null}
   */
  getLayer(id) {
    return this._layerMap.get(id) ?? null;
  }

  /** @returns {import('@wity/scene-core').WsLayer[]} */
  getLayers() {
    return this._scene.layers;
  }

  // ─── Element ops ───────────────────────────────────────────────────────────

  /**
   * Add an element to a layer. Merges with element type defaults.
   * @param {string} layerId
   * @param {{ tag: string, [key: string]: unknown }} data
   * @returns {import('@wity/scene-core').WsElement}
   */
  addElement(layerId, data) {
    const layer = this._layerMap.get(layerId);
    if (!layer) throw new Error(`[scene-headless] addElement: layer "${layerId}" not found`);

    const typeConfig = this._elementTypes.get(data.tag) ?? {};
    const element = {
      ...(typeConfig.defaults ?? {}),
      ...data,
      id: data.id ?? uid(data.tag ?? 'el'),
      tag: data.tag,
    };

    layer.elements.push(element);
    this._elementMap.set(element.id, { element, layerId });
    this.emit('element:added', { element, layerId });
    return element;
  }

  /**
   * Patch an element's properties. Shallow merge.
   * @param {string} id
   * @param {Record<string, unknown>} patch
   */
  updateElement(id, patch) {
    const entry = this._elementMap.get(id);
    if (!entry) return;
    Object.assign(entry.element, patch);
    this.emit('element:updated', { element: entry.element });
  }

  /**
   * Remove an element from its layer.
   * @param {string} id
   */
  removeElement(id) {
    const entry = this._elementMap.get(id);
    if (!entry) return;
    const layer = this._layerMap.get(entry.layerId);
    if (layer) layer.elements = layer.elements.filter((el) => el.id !== id);
    this._elementMap.delete(id);
    this.emit('element:removed', { id, layerId: entry.layerId });
  }

  /**
   * Move an element — shorthand for updateElement with x and y.
   * Emits 'element:moved' in addition to 'element:updated'.
   * @param {string} id
   * @param {string | number} x
   * @param {string | number} y
   */
  moveElement(id, x, y) {
    const entry = this._elementMap.get(id);
    if (!entry) return;
    entry.element.x = x;
    entry.element.y = y;
    this.emit('element:moved',   { id, x, y });
    this.emit('element:updated', { element: entry.element });
  }

  /**
   * Move an element to a different layer.
   * @param {string} elementId
   * @param {string} targetLayerId
   */
  moveElementToLayer(elementId, targetLayerId) {
    const entry       = this._elementMap.get(elementId);
    const targetLayer = this._layerMap.get(targetLayerId);
    if (!entry || !targetLayer) return;

    const srcLayer = this._layerMap.get(entry.layerId);
    if (srcLayer) srcLayer.elements = srcLayer.elements.filter((el) => el.id !== elementId);

    targetLayer.elements.push(entry.element);
    entry.layerId = targetLayerId;
    this.emit('element:layer-changed', { id: elementId, fromLayerId: entry.layerId, toLayerId: targetLayerId });
  }

  /**
   * @param {string} id
   * @returns {import('@wity/scene-core').WsElement | null}
   */
  getElement(id) {
    return this._elementMap.get(id)?.element ?? null;
  }

  /**
   * @param {string} [layerId] - If omitted, returns all elements across all layers
   * @returns {import('@wity/scene-core').WsElement[]}
   */
  getElements(layerId) {
    if (layerId) return this._layerMap.get(layerId)?.elements ?? [];
    return [...this._elementMap.values()].map((e) => e.element);
  }

  /**
   * Get the layer ID that contains an element.
   * @param {string} elementId
   * @returns {string | null}
   */
  getElementLayerId(elementId) {
    return this._elementMap.get(elementId)?.layerId ?? null;
  }

  // ─── Element type registry ─────────────────────────────────────────────────

  /**
   * Register a custom element type. Extends the built-in three without
   * modifying scene-core. The tag is used as the XML element name.
   *
   * @param {string} tag       - e.g. 'ws-video', 'ws-particle'
   * @param {{
   *   label?:    string,
   *   defaults?: Record<string, unknown>,
   *   validate?: (el: object) => string[],   // returns error strings
   * }} config
   */
  registerElementType(tag, config) {
    this._elementTypes.set(tag, config);
  }

  /**
   * @param {string} tag
   * @returns {object | null}
   */
  getElementTypeConfig(tag) {
    return this._elementTypes.get(tag) ?? null;
  }

  /** @returns {string[]} All registered element type tags */
  getElementTypeTags() {
    return [...this._elementTypes.keys()];
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  _rebuildMaps() {
    this._layerMap.clear();
    this._elementMap.clear();
    for (const layer of this._scene.layers) {
      this._layerMap.set(layer.id, layer);
      for (const el of layer.elements) {
        this._elementMap.set(el.id, { element: el, layerId: layer.id });
      }
    }
  }
}
