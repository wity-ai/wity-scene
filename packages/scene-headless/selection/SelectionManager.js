/**
 * @file selection/SelectionManager.js
 * ID-based selection state. Knows nothing about element shape or scene
 * structure — works on string IDs only. Wire to any store.
 */

import { EventBus } from '../core/EventBus.js';

export class SelectionManager extends EventBus {
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
