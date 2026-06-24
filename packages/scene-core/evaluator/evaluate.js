/**
 * @file evaluator/evaluate.js
 * Core evaluator: f(scene, t) → ComputedFrame
 *
 * Given a parsed WityScene and a time t (seconds), returns the complete
 * render state for that instant. Pure function — no side effects, no DOM.
 *
 * @module evaluator/evaluate
 */

import { resolveUnit, resolveX, resolveY } from '../utils/units.js';
import { safeEaseOut, safeEaseIn }          from './easing.js';

// ─── Anchor offset ────────────────────────────────────────────────────────────

/**
 * Compute the pixel offset that should be applied to (x, y) so that the
 * element's anchor point aligns with the specified coordinate.
 *
 * @param {string} anchor
 * @param {number} elWidth
 * @param {number} elHeight
 * @returns {{ dx: number, dy: number }}
 */
function anchorOffset(anchor, elWidth, elHeight) {
  const h = anchor.includes('right')  ? -elWidth  :
            anchor.includes('left')   ? 0          :
            /* center */                -elWidth  / 2;

  const v = anchor.includes('bottom') ? -elHeight :
            anchor.includes('top')    ? 0          :
            /* center */                -elHeight / 2;

  return { dx: h, dy: v };
}

// ─── Animation opacity + translate ───────────────────────────────────────────

const SLIDE_DISTANCE = 40; // px — amount slide animations travel

/**
 * @param {import('../schema/types.js').WsElementBase} el
 * @param {number} t    - scene time
 * @param {number} layerOpacity
 * @returns {{ opacity: number, translateX: number, translateY: number }}
 */
function computeAnimation(el, t, layerOpacity) {
  const start = el.begin;
  const end   = el.begin + (Number.isFinite(el.dur) ? el.dur : Infinity);
  const ad    = el.animateDur;

  // Time relative to this element
  const tRel   = t - start;
  const tFromEnd = end - t;

  let animOpacity   = 1;
  let translateX    = 0;
  let translateY    = 0;

  // ── Animate-in ──
  if (el.animateIn !== 'none' && tRel >= 0 && tRel < ad) {
    const p = safeEaseOut(tRel / ad);
    switch (el.animateIn) {
      case 'fade':
        animOpacity = p;
        break;
      case 'fade-up':
        animOpacity = p;
        translateY  = SLIDE_DISTANCE * (1 - p);
        break;
      case 'fade-down':
        animOpacity = p;
        translateY  = -SLIDE_DISTANCE * (1 - p);
        break;
      case 'slide-left':
        animOpacity = p;
        translateX  = SLIDE_DISTANCE * (1 - p);
        break;
      case 'slide-right':
        animOpacity = p;
        translateX  = -SLIDE_DISTANCE * (1 - p);
        break;
    }
  }

  // ── Animate-out ──
  if (el.animateOut !== 'none' && Number.isFinite(end) && tFromEnd >= 0 && tFromEnd < ad) {
    const p = safeEaseIn(tFromEnd / ad); // p = 1 at start of exit, 0 at end
    switch (el.animateOut) {
      case 'fade':
        animOpacity = Math.min(animOpacity, p);
        break;
      case 'fade-up':
        animOpacity = Math.min(animOpacity, p);
        translateY  = -SLIDE_DISTANCE * (1 - p);
        break;
      case 'fade-down':
        animOpacity = Math.min(animOpacity, p);
        translateY  = SLIDE_DISTANCE * (1 - p);
        break;
      case 'slide-left':
        animOpacity = Math.min(animOpacity, p);
        translateX  = -SLIDE_DISTANCE * (1 - p);
        break;
      case 'slide-right':
        animOpacity = Math.min(animOpacity, p);
        translateX  = SLIDE_DISTANCE * (1 - p);
        break;
    }
  }

  return {
    opacity:    el.opacity * layerOpacity * animOpacity,
    translateX,
    translateY,
  };
}

// ─── Tag-specific props ───────────────────────────────────────────────────────

/**
 * @param {import('../schema/types.js').WsText} el
 * @param {number} W - scene width
 * @param {number} H - scene height
 */
function resolveTextProps(el, W, H) {
  return {
    fontSize:      resolveUnit(el.fontSize, Math.min(W, H)),
    fontFamily:    el.fontFamily,
    fontWeight:    el.fontWeight,
    color:         el.color,
    textAlign:     el.textAlign,
    lineHeight:    el.lineHeight,
    maxWidth:      el.maxWidth != null ? resolveUnit(el.maxWidth, W) : null,
    letterSpacing: resolveUnit(el.letterSpacing, W),
  };
}

/**
 * @param {import('../schema/types.js').WsRect} el
 * @param {number} W
 * @param {number} H
 */
function resolveRectProps(el, W, H) {
  return {
    width:       resolveUnit(el.width, W),
    height:      resolveUnit(el.height, H),
    fill:        el.fill,
    stroke:      el.stroke,
    strokeWidth: el.strokeWidth,
    rx:          el.rx,
  };
}

/**
 * @param {import('../schema/types.js').WsImage} el
 * @param {number} W
 * @param {number} H
 */
function resolveImageProps(el, W, H) {
  return {
    src:    el.src,
    width:  resolveUnit(el.width, W),
    height: resolveUnit(el.height, H),
    fit:    el.fit,
  };
}

/**
 * @param {import('../schema/types.js').WsVideo} el
 * @param {number} W
 * @param {number} H
 */
function resolveVideoProps(el, W, H) {
  return {
    src:     el.src,
    width:   resolveUnit(el.width, W),
    height:  resolveUnit(el.height, H),
    fit:     el.fit,
    volume:  el.volume,
    trimIn:  el.trimIn,
    trimOut: el.trimOut,
    muted:   el.muted,
  };
}

// ─── Element evaluator ────────────────────────────────────────────────────────

/**
 * @param {import('../schema/types.js').WsElement} el
 * @param {number} t
 * @param {number} layerOpacity
 * @param {number} W
 * @param {number} H
 * @param {number} effectiveZ - layer.z * 1000 + el.z
 * @returns {import('../schema/types.js').ComputedElement}
 */
function evaluateElement(el, t, layerOpacity, W, H, effectiveZ) {
  // ws-audio has no visual representation — skip to avoid NaN z/opacity in the frame.
  if (el.tag === 'ws-audio') return null;

  const start   = el.begin;
  const end     = el.begin + (Number.isFinite(el.dur) ? el.dur : Infinity);
  const visible = t >= start && t < end;

  const { opacity, translateX, translateY } = computeAnimation(el, t, layerOpacity);

  const baseX = resolveX(el.x, W);
  const baseY = resolveY(el.y, H);

  // Resolve element size for anchor calculation (use props if rect/image/video, 0 for text)
  let elW = 0, elH = 0;
  if (el.tag === 'ws-rect' || el.tag === 'ws-image' || el.tag === 'ws-video') {
    elW = resolveUnit(el.width,  W);
    elH = resolveUnit(el.height, H);
  }
  const { dx, dy } = anchorOffset(el.anchor, elW, elH);

  let props = {};
  let content = null;
  switch (el.tag) {
    case 'ws-text':
      props   = resolveTextProps(el, W, H);
      content = el.content;
      break;
    case 'ws-rect':
      props = resolveRectProps(el, W, H);
      break;
    case 'ws-image':
      props = resolveImageProps(el, W, H);
      break;
    case 'ws-video':
      props = resolveVideoProps(el, W, H);
      break;
  }

  return {
    id:      el.id,
    tag:     el.tag,
    x:       baseX + dx + translateX,
    y:       baseY + dy + translateY,
    opacity,
    z:       effectiveZ,
    visible,
    /** Scene-absolute time (seconds) when this element begins. */
    begin:   el.begin,
    /** Element duration in seconds (Infinity if open-ended). */
    dur:     Number.isFinite(el.dur) ? el.dur : Infinity,
    props,
    content,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluate a WityScene at time t, returning the complete render frame.
 *
 * @param {import('../schema/types.js').WityScene} scene
 * @param {number} t - Time in seconds (clamped to [0, scene.dur])
 * @returns {import('../schema/types.js').ComputedFrame}
 */
export function evaluate(scene, t) {
  const clampedT = Math.min(Math.max(0, t), scene.dur);
  const { width: W, height: H } = scene;

  const elements = [];

  for (const layer of scene.layers) {
    const effectiveLayerZ = layer.z;
    for (const el of layer.elements) {
      const effectiveZ = effectiveLayerZ * 1000 + el.z;
      const computed = evaluateElement(el, clampedT, layer.opacity, W, H, effectiveZ);
      if (computed) elements.push(computed);
    }
  }

  // Sort by effective z — painters algorithm order
  elements.sort((a, b) => a.z - b.z);

  return { t: clampedT, width: W, height: H, elements };
}
