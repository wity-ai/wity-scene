/**
 * @file evaluator/easing.js
 * Pure easing functions used by the animation evaluator.
 * All functions take a normalised progress value p ∈ [0, 1] and return a
 * value in [0, 1] (or slightly outside for overshoot easings).
 */

/** Linear — no easing */
export const linear = (p) => p;

/** Ease out cubic — snappy entrance, gentle stop */
export const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);

/** Ease in cubic — slow start, accelerating exit */
export const easeInCubic = (p) => p * p * p;

/** Ease in-out cubic */
export const easeInOutCubic = (p) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

/** Ease out quart — used for fade-up/fade-down entrances */
export const easeOutQuart = (p) => 1 - Math.pow(1 - p, 4);

/**
 * Clamp p to [0, 1] then apply easeOutCubic.
 * Safe to call with any float.
 * @param {number} p
 * @returns {number}
 */
export const safeEaseOut = (p) => easeOutCubic(Math.min(1, Math.max(0, p)));

/**
 * Clamp p to [0, 1] then apply easeInCubic.
 * @param {number} p
 * @returns {number}
 */
export const safeEaseIn = (p) => easeInCubic(Math.min(1, Math.max(0, p)));
