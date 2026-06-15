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
export function gridSnapStrategy(gridSize) {
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
export function alignmentSnapStrategy(elements, excludeIds, threshold = 8) {
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

export class SnapState {
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
