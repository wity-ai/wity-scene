/**
 * @file utils/units.js
 * Resolves wity-scene unit values to pixels.
 *
 * Supported input forms:
 *   "50%"   → containerSize * 0.5
 *   "120px" → 120
 *   "120"   → 120  (bare numeric string)
 *   120     → 120  (number passthrough)
 */

/**
 * Resolve a unit value to pixels.
 *
 * @param {string | number} value         - Raw attribute value
 * @param {number}          containerSize - Reference dimension (width or height) for % resolution
 * @returns {number} Resolved pixel value
 */
export function resolveUnit(value, containerSize) {
  if (typeof value === 'number') return value;

  const s = String(value).trim();

  if (s.endsWith('%')) {
    const pct = parseFloat(s);
    if (!Number.isFinite(pct)) return 0;
    return (pct / 100) * containerSize;
  }

  if (s.endsWith('px')) {
    const px = parseFloat(s);
    return Number.isFinite(px) ? px : 0;
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Resolve x using scene width as the container.
 * @param {string | number} value
 * @param {number}          sceneWidth
 * @returns {number}
 */
export function resolveX(value, sceneWidth) {
  return resolveUnit(value, sceneWidth);
}

/**
 * Resolve y using scene height as the container.
 * @param {string | number} value
 * @param {number}          sceneHeight
 * @returns {number}
 */
export function resolveY(value, sceneHeight) {
  return resolveUnit(value, sceneHeight);
}
