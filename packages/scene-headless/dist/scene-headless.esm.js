/**
 * @file core/EventBus.js
 * Open pub/sub event bus. No fixed event enum — emit and subscribe to any string.
 * The same instance is extended by SceneStore, SelectionManager, TimelineState.
 */

class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   * @param {string}   event
   * @param {Function} handler
   * @returns {() => void}
   */
  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe once — auto-removed after first emission.
   * @param {string}   event
   * @param {Function} handler
   * @returns {() => void}
   */
  once(event, handler) {
    const wrapper = (payload) => {
      handler(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe a specific handler.
   * @param {string}   event
   * @param {Function} handler
   */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event
   * @param {unknown} [payload]
   */
  emit(event, payload) {
    for (const handler of this._listeners.get(event) ?? []) {
      handler(payload);
    }
  }

  /**
   * Remove all handlers for one event, or all events if omitted.
   * @param {string} [event]
   */
  clear(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  /**
   * Destroy — remove all listeners.
   */
  destroy() {
    this._listeners.clear();
  }
}

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

class SceneStore extends EventBus {
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

/**
 * @file selection/SelectionManager.js
 * ID-based selection state. Knows nothing about element shape or scene
 * structure — works on string IDs only. Wire to any store.
 */


class SelectionManager extends EventBus {
  /**
   * @param {import('../core/SceneStore.js').SceneStore} [store]
   * Optional — if provided, clears selection when an element is removed.
   */
  constructor(store) {
    super();
    /** @type {Set<string>} */
    this._selected = new Set();

    if (store) {
      store.on('element:removed', ({ id }) => {
        if (this._selected.has(id)) {
          this._selected.delete(id);
          this._emit([], [id]);
        }
      });
      store.on('layer:removed', () => this.clear());
      store.on('scene:replaced', () => this.clear());
    }
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  /**
   * Select an element by ID.
   * @param {string} id
   * @param {{ addToSelection?: boolean }} [options]
   */
  select(id, { addToSelection = false } = {}) {
    const prev = new Set(this._selected);
    if (!addToSelection) this._selected.clear();
    this._selected.add(id);
    this._emitDiff(prev);
  }

  /**
   * Select multiple elements at once.
   * @param {string[]} ids
   * @param {{ addToSelection?: boolean }} [options]
   */
  selectMany(ids, { addToSelection = false } = {}) {
    const prev = new Set(this._selected);
    if (!addToSelection) this._selected.clear();
    for (const id of ids) this._selected.add(id);
    this._emitDiff(prev);
  }

  /**
   * @param {string} id
   */
  deselect(id) {
    if (!this._selected.has(id)) return;
    const prev = new Set(this._selected);
    this._selected.delete(id);
    this._emitDiff(prev);
  }

  /**
   * Toggle selection state of an element.
   * @param {string} id
   * @param {{ addToSelection?: boolean }} [options]
   */
  toggle(id, { addToSelection = false } = {}) {
    if (this._selected.has(id)) {
      this.deselect(id);
    } else {
      this.select(id, { addToSelection });
    }
  }

  /**
   * Clear all selections.
   * @param {string[]} [excludeIds] - IDs to keep selected
   */
  clear(excludeIds = []) {
    const prev = new Set(this._selected);
    this._selected.clear();
    for (const id of excludeIds) this._selected.add(id);
    this._emitDiff(prev);
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────

  /** @returns {string[]} */
  getSelected() {
    return [...this._selected];
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  isSelected(id) {
    return this._selected.has(id);
  }

  /** @returns {number} */
  get count() {
    return this._selected.size;
  }

  /** @returns {boolean} */
  get isMulti() {
    return this._selected.size > 1;
  }

  /** @returns {boolean} */
  get isEmpty() {
    return this._selected.size === 0;
  }

  /**
   * Stable composite key — sorted IDs joined by '|'.
   * Useful as a React/Muffin dependency key.
   * @returns {string}
   */
  get compositeId() {
    return [...this._selected].sort().join('|');
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  /**
   * @param {Set<string>} prev
   */
  _emitDiff(prev) {
    const added   = [...this._selected].filter((id) => !prev.has(id));
    const removed = [...prev].filter((id) => !this._selected.has(id));
    if (added.length === 0 && removed.length === 0) return;
    this._emit(added, removed);
  }

  /**
   * @param {string[]} added
   * @param {string[]} removed
   */
  _emit(added, removed) {
    this.emit('selection:changed', {
      selected:   [...this._selected],
      added,
      removed,
      isMulti:    this.isMulti,
      compositeId: this.compositeId,
    });
  }
}

/**
 * @file history/HistoryManager.js
 * Undo/redo via an open Command interface.
 *
 * A Command is any object with:
 *   apply()   — execute the mutation (called once on commit)
 *   revert()  — reverse the mutation
 *   label?    — human-readable description ("Move text", "Change color")
 *
 * The manager doesn't know what commands do — it only manages the stack.
 * Build custom commands for any mutation type without touching this file.
 */

/**
 * @typedef {Object} Command
 * @property {() => void}    apply   - Execute the mutation
 * @property {() => void}    revert  - Reverse the mutation
 * @property {string}       [label]  - Human-readable description
 */

class HistoryManager {
  /**
   * @param {{ limit?: number }} [options]
   */
  constructor({ limit = 100 } = {}) {
    this._limit = limit;
    /** @type {Command[]} */
    this._undoStack = [];
    /** @type {Command[]} */
    this._redoStack = [];
  }

  // ─── Core API ──────────────────────────────────────────────────────────────

  /**
   * Apply a command and push it onto the undo stack.
   * Clears the redo stack (branching history is not supported).
   * @param {Command} command
   */
  commit(command) {
    command.apply();
    this._undoStack.push(command);
    this._redoStack = [];
    if (this._undoStack.length > this._limit) {
      this._undoStack.shift();
    }
  }

  /**
   * Undo the last committed command.
   * @returns {Command | null} The command that was undone, or null if stack empty
   */
  undo() {
    const command = this._undoStack.pop();
    if (!command) return null;
    command.revert();
    this._redoStack.push(command);
    return command;
  }

  /**
   * Redo the last undone command.
   * @returns {Command | null} The command that was re-applied, or null if empty
   */
  redo() {
    const command = this._redoStack.pop();
    if (!command) return null;
    command.apply();
    this._undoStack.push(command);
    return command;
  }

  /**
   * Group multiple commands into a single undoable unit.
   * All commands in the batch are applied in order and undone in reverse.
   * @param {Command[]} commands
   * @param {string}   [label]
   */
  commitBatch(commands, label) {
    this.commit({
      label,
      apply:  () => commands.forEach((c) => c.apply()),
      revert: () => [...commands].reverse().forEach((c) => c.revert()),
    });
  }

  /**
   * Clear both stacks. Useful when loading a new document.
   */
  clear() {
    this._undoStack = [];
    this._redoStack = [];
  }

  // ─── State reads ───────────────────────────────────────────────────────────

  /** @returns {boolean} */
  get canUndo() {
    return this._undoStack.length > 0;
  }

  /** @returns {boolean} */
  get canRedo() {
    return this._redoStack.length > 0;
  }

  /** @returns {string | null} */
  get undoLabel() {
    return this._undoStack.at(-1)?.label ?? null;
  }

  /** @returns {string | null} */
  get redoLabel() {
    return this._redoStack.at(-1)?.label ?? null;
  }

  /** @returns {number} */
  get undoDepth() {
    return this._undoStack.length;
  }

  /** @returns {number} */
  get redoDepth() {
    return this._redoStack.length;
  }
}

/**
 * @file history/commands.js
 * Built-in Command implementations for common SceneStore mutations.
 *
 * These are convenience helpers — not an exhaustive list. Build your own
 * commands for any mutation by implementing { apply(), revert(), label? }.
 */

// ─── Element commands ─────────────────────────────────────────────────────────

/**
 * Move an element. Captures previous position on construction.
 */
class MoveElementCommand {
  /**
   * @param {import('../core/SceneStore.js').SceneStore} store
   * @param {string}          id
   * @param {string | number} x
   * @param {string | number} y
   * @param {string | number} prevX
   * @param {string | number} prevY
   */
  constructor(store, id, x, y, prevX, prevY) {
    this.label = 'Move element';
    this._store = store;
    this._id = id;
    this._x = x; this._y = y;
    this._prevX = prevX; this._prevY = prevY;
  }
  apply()  { this._store.moveElement(this._id, this._x, this._y); }
  revert() { this._store.moveElement(this._id, this._prevX, this._prevY); }
}

/**
 * Patch arbitrary element properties. Captures a full snapshot of the
 * patched keys before applying, so revert is always exact.
 */
class UpdateElementCommand {
  /**
   * @param {import('../core/SceneStore.js').SceneStore} store
   * @param {string}                  id
   * @param {Record<string, unknown>} patch
   * @param {string}                 [label]
   */
  constructor(store, id, patch, label = 'Update element') {
    this.label = label;
    this._store = store;
    this._id    = id;
    this._patch = patch;
    // Snapshot current values for the patched keys
    const el = store.getElement(id);
    this._prev = el ? Object.fromEntries(Object.keys(patch).map((k) => [k, el[k]])) : {};
  }
  apply()  { this._store.updateElement(this._id, this._patch); }
  revert() { this._store.updateElement(this._id, this._prev); }
}

/**
 * Add an element to a layer. Revert removes it.
 */
class AddElementCommand {
  /**
   * @param {import('../core/SceneStore.js').SceneStore} store
   * @param {string} layerId
   * @param {object} data
   */
  constructor(store, layerId, data) {
    this.label   = `Add ${data.tag ?? 'element'}`;
    this._store  = store;
    this._layerId = layerId;
    this._data   = data;
    this._id     = null; // set on first apply
  }
  apply() {
    if (this._id) {
      // Re-add with the same id after undo
      this._store.addElement(this._layerId, { ...this._data, id: this._id });
    } else {
      const el  = this._store.addElement(this._layerId, this._data);
      this._id  = el.id;
      this._data = { ...this._data, id: el.id };
    }
  }
  revert() { this._store.removeElement(this._id); }
}

/**
 * Remove an element. Revert re-adds it at the end of its layer.
 */
class RemoveElementCommand {
  /**
   * @param {import('../core/SceneStore.js').SceneStore} store
   * @param {string} id
   */
  constructor(store, id) {
    this.label    = 'Remove element';
    this._store   = store;
    this._id      = id;
    this._layerId = store.getElementLayerId(id);
    // Snapshot the element before removing
    const el = store.getElement(id);
    this._snapshot = el ? { ...el } : null;
  }
  apply()  { this._store.removeElement(this._id); }
  revert() {
    if (this._snapshot && this._layerId) {
      this._store.addElement(this._layerId, this._snapshot);
    }
  }
}

// ─── Layer commands ───────────────────────────────────────────────────────────

/**
 * Add a layer. Revert removes it (and any elements added inside it
 * during that operation — use commitBatch if you also add elements).
 */
class AddLayerCommand {
  /**
   * @param {import('../core/SceneStore.js').SceneStore} store
   * @param {object} [data]
   */
  constructor(store, data = {}) {
    this.label  = 'Add layer';
    this._store = store;
    this._data  = data;
    this._id    = null;
  }
  apply() {
    const layer = this._store.addLayer(this._id ? { ...this._data, id: this._id } : this._data);
    this._id    = layer.id;
    this._data  = { ...this._data, id: layer.id };
  }
  revert() { this._store.removeLayer(this._id); }
}

/**
 * Patch a layer's properties (z, opacity).
 */
class UpdateLayerCommand {
  /**
   * @param {import('../core/SceneStore.js').SceneStore} store
   * @param {string}                  id
   * @param {Record<string, unknown>} patch
   * @param {string}                 [label]
   */
  constructor(store, id, patch, label = 'Update layer') {
    this.label  = label;
    this._store = store;
    this._id    = id;
    this._patch = patch;
    const layer = store.getLayer(id);
    this._prev  = layer ? Object.fromEntries(Object.keys(patch).map((k) => [k, layer[k]])) : {};
  }
  apply()  { this._store.updateLayer(this._id, this._patch); }
  revert() { this._store.updateLayer(this._id, this._prev); }
}

/**
 * Reorder layers. Revert restores original order.
 */
class ReorderLayersCommand {
  /**
   * @param {import('../core/SceneStore.js').SceneStore} store
   * @param {string[]} newOrder  - layer IDs in desired order
   */
  constructor(store, newOrder) {
    this.label    = 'Reorder layers';
    this._store   = store;
    this._new     = newOrder;
    this._prev    = store.getLayers().map((l) => l.id);
  }
  apply()  { this._store.reorderLayers(this._new); }
  revert() { this._store.reorderLayers(this._prev); }
}

/**
 * @file transform/TransformState.js
 * Pure math for selection bounding boxes and resize handles.
 * No state, no DOM — just functions over ComputedElement arrays.
 *
 * Call evaluate(scene, t) first to get resolved pixel positions,
 * then pass ComputedElements into these functions.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} Bounds
 */

/**
 * @typedef {{
 *   id:     string,
 *   x:      number,
 *   y:      number,
 *   cursor: string,
 * }} ResizeHandle
 */

// ─── Resize handle descriptors ────────────────────────────────────────────────

const HANDLE_DEFS = [
  { id: 'top-left',     rx: 0,   ry: 0,   cursor: 'nwse-resize' },
  { id: 'top',          rx: 0.5, ry: 0,   cursor: 'ns-resize'   },
  { id: 'top-right',    rx: 1,   ry: 0,   cursor: 'nesw-resize' },
  { id: 'right',        rx: 1,   ry: 0.5, cursor: 'ew-resize'   },
  { id: 'bottom-right', rx: 1,   ry: 1,   cursor: 'nwse-resize' },
  { id: 'bottom',       rx: 0.5, ry: 1,   cursor: 'ns-resize'   },
  { id: 'bottom-left',  rx: 0,   ry: 1,   cursor: 'nesw-resize' },
  { id: 'left',         rx: 0,   ry: 0.5, cursor: 'ew-resize'   },
];

// ─── Public functions ─────────────────────────────────────────────────────────

/**
 * Compute the bounding box that encloses all selected ComputedElements.
 * Elements without a resolved size (ws-text) use a 0×0 point at their position.
 *
 * @param {import('@wity/scene-core').ComputedElement[]} elements - From evaluate()
 * @param {string[]}                                     ids      - Selected element IDs
 * @returns {Bounds | null}
 */
function getSelectionBounds(elements, ids) {
  const selected = elements.filter((el) => ids.includes(el.id) && el.visible);
  if (selected.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const el of selected) {
    const w = el.props?.width  ?? 0;
    const h = el.props?.height ?? 0;
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + w);
    maxY = Math.max(maxY, el.y + h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Compute the 8 resize handle positions for a bounding box.
 *
 * @param {Bounds} bounds
 * @returns {ResizeHandle[]}
 */
function getResizeHandles(bounds) {
  return HANDLE_DEFS.map(({ id, rx, ry, cursor }) => ({
    id,
    x: bounds.x + rx * bounds.w,
    y: bounds.y + ry * bounds.h,
    cursor,
  }));
}

/**
 * Compute rotation handle position — directly above the bounding box center.
 *
 * @param {Bounds} bounds
 * @param {number} [offset=32] - px above the top edge
 * @returns {{ x: number, y: number }}
 */
function getRotationHandle(bounds, offset = 32) {
  return { x: bounds.x + bounds.w / 2, y: bounds.y - offset };
}

/**
 * Get the anchor pixel position within a bounding box.
 * Useful for snapping or aligning to a specific point.
 *
 * @param {Bounds} bounds
 * @param {import('@wity/scene-core').AnchorValue} anchor
 * @returns {{ x: number, y: number }}
 */
function getAnchorPoint(bounds, anchor) {
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const r  = bounds.x + bounds.w;
  const b  = bounds.y + bounds.h;

  switch (anchor) {
    case 'top-left':     return { x: bounds.x, y: bounds.y };
    case 'top':          return { x: cx,        y: bounds.y };
    case 'top-right':    return { x: r,         y: bounds.y };
    case 'left':         return { x: bounds.x,  y: cy       };
    case 'center':       return { x: cx,         y: cy       };
    case 'right':        return { x: r,          y: cy       };
    case 'bottom-left':  return { x: bounds.x,   y: b        };
    case 'bottom':       return { x: cx,          y: b        };
    case 'bottom-right': return { x: r,           y: b        };
    default:             return { x: bounds.x,   y: bounds.y };
  }
}

/**
 * Check if a point (px, py) is within a bounds rect, with optional padding.
 *
 * @param {number} px
 * @param {number} py
 * @param {Bounds} bounds
 * @param {number} [padding=0]
 * @returns {boolean}
 */
function pointInBounds(px, py, bounds, padding = 0) {
  return (
    px >= bounds.x - padding &&
    px <= bounds.x + bounds.w + padding &&
    py >= bounds.y - padding &&
    py <= bounds.y + bounds.h + padding
  );
}

/**
 * Find which visible element contains the point (px, py) — topmost z first.
 *
 * @param {number} px
 * @param {number} py
 * @param {import('@wity/scene-core').ComputedElement[]} elements
 * @param {number} [padding=4]
 * @returns {import('@wity/scene-core').ComputedElement | null}
 */
function elementAtPoint(px, py, elements, padding = 4) {
  // Elements are sorted ascending by z — iterate in reverse for topmost
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!el.visible) continue;
    const w = el.props?.width  ?? 0;
    const h = el.props?.height ?? 0;
    if (pointInBounds(px, py, { x: el.x, y: el.y, w, h }, padding)) return el;
  }
  return null;
}

/**
 * @file snap/SnapState.js
 * Pluggable snap system. Ships with a grid strategy; register any number
 * of additional strategies (alignment guides, magnet-to-element, etc.)
 * without modifying this file.
 *
 * A snap strategy is a function:
 *   (x, y, context) → { x, y, guides: Guide[] }
 *
 * Strategies are applied in registration order; each receives the output
 * of the previous, so they compose.
 */

/**
 * @typedef {{ type: 'vertical' | 'horizontal', position: number }} Guide
 */

/**
 * @typedef {{ x: number, y: number, guides: Guide[] }} SnapResult
 */

/**
 * @typedef {(x: number, y: number, context: unknown) => SnapResult} SnapStrategy
 */

// ─── Built-in strategies ──────────────────────────────────────────────────────

/**
 * Grid snap strategy factory.
 * @param {number} gridSize - px
 * @returns {SnapStrategy}
 */
function gridSnapStrategy(gridSize) {
  return (x, y, _context) => {
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;
    return {
      x:      snappedX,
      y:      snappedY,
      guides: [
        { type: 'vertical',   position: snappedX },
        { type: 'horizontal', position: snappedY },
      ],
    };
  };
}

/**
 * Alignment guide strategy — snaps to edges/centers of other elements.
 * @param {import('@wity/scene-core').ComputedElement[]} elements - All visible elements
 * @param {string[]} excludeIds - IDs of selected elements to exclude
 * @param {number}   threshold  - px threshold for snapping
 * @returns {SnapStrategy}
 */
function alignmentSnapStrategy(elements, excludeIds, threshold = 8) {
  return (x, y, _context) => {
    const guides = [];
    let snappedX = x;
    let snappedY = y;
    let bestDX   = threshold;
    let bestDY   = threshold;

    for (const el of elements) {
      if (!el.visible || excludeIds.includes(el.id)) continue;
      const w = el.props?.width  ?? 0;
      const h = el.props?.height ?? 0;

      const xCandidates = [el.x, el.x + w / 2, el.x + w];
      const yCandidates = [el.y, el.y + h / 2, el.y + h];

      for (const cx of xCandidates) {
        const dx = Math.abs(x - cx);
        if (dx < bestDX) { bestDX = dx; snappedX = cx; guides.push({ type: 'vertical', position: cx }); }
      }
      for (const cy of yCandidates) {
        const dy = Math.abs(y - cy);
        if (dy < bestDY) { bestDY = dy; snappedY = cy; guides.push({ type: 'horizontal', position: cy }); }
      }
    }

    return { x: snappedX, y: snappedY, guides };
  };
}

// ─── SnapState ────────────────────────────────────────────────────────────────

class SnapState {
  /**
   * @param {{ gridSize?: number, enabled?: boolean }} [options]
   */
  constructor({ gridSize = 8, enabled = true } = {}) {
    this._enabled  = enabled;
    this._gridSize = gridSize;
    /** @type {Map<string, SnapStrategy>} */
    this._strategies = new Map();

    // Register default grid strategy
    this.registerStrategy('grid', gridSnapStrategy(gridSize));
  }

  // ─── Strategy registry ────────────────────────────────────────────────────

  /**
   * Register a snap strategy by name. If a strategy with this name already
   * exists it will be replaced. Call in registration order — strategies
   * compose sequentially.
   *
   * @param {string}       name
   * @param {SnapStrategy} fn
   */
  registerStrategy(name, fn) {
    this._strategies.set(name, fn);
  }

  /**
   * @param {string} name
   */
  unregisterStrategy(name) {
    this._strategies.delete(name);
  }

  /** @returns {string[]} */
  getStrategyNames() {
    return [...this._strategies.keys()];
  }

  // ─── Snap ─────────────────────────────────────────────────────────────────

  /**
   * Run all registered strategies in sequence.
   * Each strategy receives the output of the previous.
   *
   * @param {number}  x
   * @param {number}  y
   * @param {unknown} [context] - Passed through to every strategy; put scene, elements, etc. here
   * @returns {SnapResult}
   */
  snap(x, y, context) {
    if (!this._enabled) return { x, y, guides: [] };

    let result = { x, y, guides: [] };
    for (const fn of this._strategies.values()) {
      const next = fn(result.x, result.y, context);
      result = {
        x:      next.x,
        y:      next.y,
        guides: [...result.guides, ...next.guides],
      };
    }
    return result;
  }

  // ─── Config ───────────────────────────────────────────────────────────────

  /** @param {number} size */
  setGridSize(size) {
    this._gridSize = size;
    // Replace the grid strategy with the new size
    if (this._strategies.has('grid')) {
      this.registerStrategy('grid', gridSnapStrategy(size));
    }
  }

  /** @param {boolean} enabled */
  setEnabled(enabled) {
    this._enabled = enabled;
  }

  /** @returns {boolean} */
  get enabled() {
    return this._enabled;
  }

  /** @returns {number} */
  get gridSize() {
    return this._gridSize;
  }
}

/**
 * @file timeline/TimelineState.js
 * Playhead state for scene preview. Owns current time and play/pause.
 * Drives itself via requestAnimationFrame in browser, or a timer in Node.js.
 * The renderer calls evaluate(store.getScene(), timeline.currentTime) each frame.
 */


class TimelineState extends EventBus {
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

/**
 * @file clipboard/Clipboard.js
 * Copy/paste elements within or across layers.
 * Operates on element IDs — deep-clones the element data at copy time so
 * subsequent mutations to originals don't affect the clipboard.
 */

let _clipCounter = 0;

class Clipboard {
  /**
   * @param {import('../core/SceneStore.js').SceneStore} store
   */
  constructor(store) {
    this._store   = store;
    /** @type {{ element: object, layerId: string }[]} */
    this._items   = [];
  }

  // ─── Copy / cut ───────────────────────────────────────────────────────────

  /**
   * Copy elements by ID. Snapshots their current state.
   * @param {string[]} ids
   */
  copy(ids) {
    this._items = ids.flatMap((id) => {
      const el      = this._store.getElement(id);
      const layerId = this._store.getElementLayerId(id);
      if (!el || !layerId) return [];
      return [{ element: structuredClone ? structuredClone(el) : JSON.parse(JSON.stringify(el)), layerId }];
    });
  }

  /**
   * Copy then remove elements.
   * @param {string[]} ids
   */
  cut(ids) {
    this.copy(ids);
    for (const id of ids) this._store.removeElement(id);
  }

  // ─── Paste ────────────────────────────────────────────────────────────────

  /**
   * Paste clipboard items into a target layer (or their original layers).
   * Each pasted element gets a fresh ID and an optional position offset.
   *
   * @param {string}               [targetLayerId] - If omitted, pastes into original layer
   * @param {{ x?: number, y?: number }} [offset]  - px offset added to position
   * @returns {string[]} IDs of newly created elements
   */
  paste(targetLayerId, offset = { x: 16, y: 16 }) {
    if (this._items.length === 0) return [];
    const newIds = [];

    for (const { element, layerId } of this._items) {
      const layer = targetLayerId ?? layerId;
      if (!this._store.getLayer(layer)) continue;

      const cloned = structuredClone ? structuredClone(element) : JSON.parse(JSON.stringify(element));
      cloned.id = `${cloned.id ?? 'el'}-copy-${++_clipCounter}`;

      // Apply offset to numeric or percentage positions
      if (offset.x && typeof cloned.x === 'number') cloned.x += offset.x;
      if (offset.y && typeof cloned.y === 'number') cloned.y += offset.y;

      const added = this._store.addElement(layer, cloned);
      newIds.push(added.id);
    }

    return newIds;
  }

  // ─── State ────────────────────────────────────────────────────────────────

  /** @returns {boolean} */
  get hasContent() {
    return this._items.length > 0;
  }

  /** @returns {number} */
  get count() {
    return this._items.length;
  }

  clear() {
    this._items = [];
  }
}

export { AddElementCommand, AddLayerCommand, Clipboard, EventBus, HistoryManager, MoveElementCommand, RemoveElementCommand, ReorderLayersCommand, SceneStore, SelectionManager, SnapState, TimelineState, UpdateElementCommand, UpdateLayerCommand, alignmentSnapStrategy, elementAtPoint, getAnchorPoint, getResizeHandles, getRotationHandle, getSelectionBounds, gridSnapStrategy, pointInBounds };
//# sourceMappingURL=scene-headless.esm.js.map
