/**
 * @file parser/parse.js
 * Parse a wity-scene XML string into a WityScene object.
 *
 * Isomorphic: uses DOMParser in browser environments and a minimal
 * attribute-walk in Node.js (via @xmldom/xmldom if available, else
 * falls back to a bundled micro-parser for Node.js contexts).
 *
 * @module parser/parse
 */

import { createRequire }   from 'node:module';
import { SCHEMA_VERSION, ELEMENT_TAGS, ANIMATE_IN_VALUES, ANIMATE_OUT_VALUES, ANCHOR_VALUES } from '../schema/types.js';

// ─── DOM resolver ─────────────────────────────────────────────────────────────

/**
 * Obtain a DOMParser-compatible parser.
 * Browser: native DOMParser.
 * Node.js: @xmldom/xmldom (optional peer dep) or throws a clear error.
 *
 * @returns {{ parseFromString: (xml: string, mime: string) => Document }}
 */
function getParser() {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser();
  }
  // Node.js — require optional peer
  try {
    const { DOMParser: XmlDOMParser } = await_require('@xmldom/xmldom');
    return new XmlDOMParser();
  } catch {
    throw new Error(
      '[wity-scene] Node.js environment detected but @xmldom/xmldom is not installed. ' +
      'Run: npm install @xmldom/xmldom',
    );
  }
}

/** Synchronous require shim — works in both CJS (require exists) and pure ESM (createRequire) */
function await_require(id) {
  const req = typeof require !== 'undefined' ? require : createRequire(import.meta.url);
  return req(id);
}

// ─── Attribute helpers ───────────────────────────────────────────────────────

/** @param {Element} el @param {string} name @param {string} fallback */
function attr(el, name, fallback = '') {
  return el.getAttribute(name) ?? fallback;
}

/** @param {Element} el @param {string} name @param {number} fallback */
function numAttr(el, name, fallback) {
  const v = el.getAttribute(name);
  if (v === null) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse a unit value attribute — returns raw string or number.
 * Callers resolve to pixels at evaluation time.
 * @param {Element} el @param {string} name @param {string|number} fallback
 * @returns {string|number}
 */
function unitAttr(el, name, fallback) {
  const v = el.getAttribute(name);
  if (v === null) return fallback;
  const n = parseFloat(v);
  // bare number with no unit suffix → number
  if (String(n) === v.trim()) return n;
  return v.trim();
}

/** @param {string} v @param {readonly string[]} allowed @param {string} fallback */
function enumAttr(el, name, allowed, fallback) {
  const v = el.getAttribute(name);
  if (v === null || !allowed.includes(v)) return fallback;
  return v;
}

let _elementCounter = 0;
function nextId(tag) {
  return `${tag}-${++_elementCounter}`;
}

// ─── Element parsers ─────────────────────────────────────────────────────────

/**
 * Parse common WsElementBase attributes.
 * @param {Element} el
 * @returns {import('../schema/types.js').WsElementBase}
 */
function parseElementBase(el) {
  return {
    id:         attr(el, 'id') || nextId(el.tagName),
    x:          unitAttr(el, 'x', 0),
    y:          unitAttr(el, 'y', 0),
    anchor:     enumAttr(el, 'anchor', ANCHOR_VALUES, 'top-left'),
    begin:      numAttr(el, 'begin', 0),
    dur:        numAttr(el, 'dur', Infinity),
    z:          numAttr(el, 'z', 0),
    opacity:    numAttr(el, 'opacity', 1),
    animateIn:  enumAttr(el, 'animate-in',  ANIMATE_IN_VALUES,  'none'),
    animateOut: enumAttr(el, 'animate-out', ANIMATE_OUT_VALUES, 'none'),
    animateDur: numAttr(el, 'animate-dur', 0.4),
  };
}

/** @param {Element} el @returns {import('../schema/types.js').WsText} */
function parseText(el) {
  return {
    ...parseElementBase(el),
    tag:           'ws-text',
    content:       el.textContent?.trim() ?? '',
    fontSize:      unitAttr(el, 'font-size', '3%'),
    fontFamily:    attr(el, 'font-family', 'sans-serif'),
    fontWeight:    attr(el, 'font-weight', 'normal'),
    color:         attr(el, 'color', '#ffffff'),
    textAlign:     enumAttr(el, 'text-align', ['left', 'center', 'right'], 'center'),
    lineHeight:    numAttr(el, 'line-height', 1.4),
    maxWidth:      el.hasAttribute('max-width') ? unitAttr(el, 'max-width', null) : null,
    letterSpacing: unitAttr(el, 'letter-spacing', 0),
  };
}

/** @param {Element} el @returns {import('../schema/types.js').WsRect} */
function parseRect(el) {
  return {
    ...parseElementBase(el),
    tag:         'ws-rect',
    width:       unitAttr(el, 'width', '100%'),
    height:      unitAttr(el, 'height', '100%'),
    fill:        attr(el, 'fill', 'transparent'),
    stroke:      el.hasAttribute('stroke') ? attr(el, 'stroke', null) : null,
    strokeWidth: numAttr(el, 'stroke-width', 1),
    rx:          numAttr(el, 'rx', 0),
  };
}

/** @param {Element} el @returns {import('../schema/types.js').WsImage} */
function parseImage(el) {
  return {
    ...parseElementBase(el),
    tag:    'ws-image',
    src:    attr(el, 'src', ''),
    width:  unitAttr(el, 'width', '100%'),
    height: unitAttr(el, 'height', '100%'),
    fit:    enumAttr(el, 'fit', ['cover', 'contain', 'fill', 'none'], 'cover'),
  };
}

/** @param {Element} el @returns {import('../schema/types.js').WsElement | null} */
function parseElement(el) {
  switch (el.tagName) {
    case 'ws-text':  return parseText(el);
    case 'ws-rect':  return parseRect(el);
    case 'ws-image': return parseImage(el);
    default:         return null;
  }
}

// ─── Layer parser ─────────────────────────────────────────────────────────────

/** @param {Element} el @returns {import('../schema/types.js').WsLayer} */
function parseLayer(el) {
  const elements = [];
  for (const child of el.children) {
    const parsed = parseElement(child);
    if (parsed) elements.push(parsed);
  }
  return {
    id:       attr(el, 'id') || `layer-${elements.length}`,
    z:        numAttr(el, 'z', 0),
    opacity:  numAttr(el, 'opacity', 1),
    elements,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a wity-scene XML string into a WityScene object.
 *
 * @param {string} xml - Raw XML string
 * @returns {import('../schema/types.js').WityScene}
 * @throws {Error} If the XML is malformed or the root element is not `<wity-scene>`
 */
export function parse(xml) {
  _elementCounter = 0; // reset id counter per parse

  const parser = getParser();
  const doc    = parser.parseFromString(xml, 'text/xml');

  // DOMParser error handling — use getElementsByTagName for xmldom compat (no querySelector)
  const parseErrors = doc.getElementsByTagName('parsererror');
  if (parseErrors && parseErrors.length > 0) {
    throw new Error(`[wity-scene] XML parse error: ${parseErrors[0].textContent?.trim()}`);
  }

  const root = doc.documentElement;
  if (root.tagName !== 'wity-scene') {
    throw new Error(`[wity-scene] Root element must be <wity-scene>, got <${root.tagName}>`);
  }

  const version = attr(root, 'version', SCHEMA_VERSION);
  const width   = numAttr(root, 'width',  1920);
  const height  = numAttr(root, 'height', 1080);
  const dur     = numAttr(root, 'dur',    0);

  const layers = [];
  for (const child of root.children) {
    if (child.tagName === 'ws-layer') {
      layers.push(parseLayer(child));
    }
  }

  return { version, width, height, dur, layers };
}
