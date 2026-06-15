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
export function getSelectionBounds(elements, ids) {
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
export function getResizeHandles(bounds) {
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
export function getRotationHandle(bounds, offset = 32) {
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
export function getAnchorPoint(bounds, anchor) {
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
export function pointInBounds(px, py, bounds, padding = 0) {
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
export function elementAtPoint(px, py, elements, padding = 4) {
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
