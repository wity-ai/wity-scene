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
export class MoveElementCommand {
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
export class UpdateElementCommand {
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
export class AddElementCommand {
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
export class RemoveElementCommand {
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
export class AddLayerCommand {
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
export class UpdateLayerCommand {
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
export class ReorderLayersCommand {
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
