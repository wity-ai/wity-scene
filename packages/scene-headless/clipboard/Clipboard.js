/**
 * @file clipboard/Clipboard.js
 * Copy/paste elements within or across layers.
 * Operates on element IDs — deep-clones the element data at copy time so
 * subsequent mutations to originals don't affect the clipboard.
 */

let _clipCounter = 0;

export class Clipboard {
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
