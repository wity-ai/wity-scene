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

import {
  SCHEMA_VERSION,
  ELEMENT_TAGS,
  ANIMATE_IN_VALUES,
  ANIMATE_OUT_VALUES,
  ANCHOR_VALUES,
  MEDIA_FIT_VALUES,
} from '../schema/types.js';

// ─── DOM resolver ─────────────────────────────────────────────────────────────

/**
 * Injected parser for Node.js environments.
 * Browser consumers use native DOMParser (set automatically).
 * Node.js consumers (e.g. scene-to-video) call setXmlParser() once at startup
 * with an @xmldom/xmldom instance — keeping scene-core free of any Node.js-only imports.
 */
let _injectedParser = null;

/**
 * Inject an XML parser for environments where DOMParser is not globally available (Node.js).
 * Must be called before parse() in Node.js contexts.
 *
 * @param {{ parseFromString: (xml: string, mime: string) => Document }} parserInstance
 *
 * @example
 * // In Node.js / scene-to-video:
 * import { DOMParser } from '@xmldom/xmldom';
 * import { setXmlParser } from '@wity/scene-core';
 * setXmlParser(new DOMParser());
 */
export function setXmlParser(parserInstance) {
  _injectedParser = parserInstance;
}

/**
 * Obtain a DOMParser-compatible parser.
 * Browser: native DOMParser (automatic).
 * Node.js: injected via setXmlParser() — throws a clear error if not set.
 *
 * @returns {{ parseFromString: (xml: string, mime: string) => Document }}
 */
function getParser() {
  if (_injectedParser)                   return _injectedParser;
  if (typeof DOMParser !== 'undefined')  return new DOMParser();
  throw new Error(
    '[wity-scene] No XML parser available. In Node.js, call setXmlParser() before parse().\n' +
    '  import { DOMParser } from "@xmldom/xmldom";\n' +
    '  import { setXmlParser } from "@wity/scene-core";\n' +
    '  setXmlParser(new DOMParser());',
  );
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

function boolAttr(el, name, fallback) {
  const v = el.getAttribute(name);
  if (v === null) return fallback;
  return v === 'true' || v === '1';
}

let _elementCounter = 0;
function nextId(tag) {
  return `${tag}-${++_elementCounter}`;
}

// ─── Cue parser ──────────────────────────────────────────────────────────────

/**
 * Parse ws-cue children from a ws-video or ws-audio element.
 * Returns undefined (not an empty array) when no cues are present,
 * so the field is omitted from the object entirely.
 * @param {Element} parentEl
 * @returns {import('../schema/types.js').WsCue[] | undefined}
 */
function parseCues(parentEl) {
  const cues = [];
  for (const child of parentEl.children) {
    if (child.tagName !== 'ws-cue') continue;
    cues.push({
      begin:   numAttr(child, 'begin', 0),
      end:     numAttr(child, 'end', 0),
      text:    child.textContent?.trim() ?? '',
      ...(child.hasAttribute('speaker') ? { speaker: attr(child, 'speaker') } : {}),
    });
  }
  return cues.length > 0 ? cues : undefined;
}

// ─── Element parsers ─────────────────────────────────────────────────────────

/**
 * Parse common WsElementBase attributes (visual elements only).
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
    ...(el.hasAttribute('name') ? { name: attr(el, 'name') } : {}),
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
    fit:    enumAttr(el, 'fit', MEDIA_FIT_VALUES, 'cover'),
  };
}

/** @param {Element} el @returns {import('../schema/types.js').WsVideo} */
function parseVideo(el) {
  const cues = parseCues(el);
  return {
    ...parseElementBase(el),
    tag:     'ws-video',
    src:     attr(el, 'src', ''),
    width:   unitAttr(el, 'width', '100%'),
    height:  unitAttr(el, 'height', '100%'),
    fit:     enumAttr(el, 'fit', MEDIA_FIT_VALUES, 'cover'),
    volume:  numAttr(el, 'volume', 1),
    trimIn:  numAttr(el, 'trim-in', 0),
    trimOut: el.hasAttribute('trim-out') ? numAttr(el, 'trim-out', null) : null,
    muted:   boolAttr(el, 'muted', false),
    ...(cues ? { cues } : {}),
  };
}

/** @param {Element} el @returns {import('../schema/types.js').WsAudio} */
function parseAudio(el) {
  const cues = parseCues(el);
  return {
    tag:     'ws-audio',
    id:      attr(el, 'id') || nextId('ws-audio'),
    begin:   numAttr(el, 'begin', 0),
    dur:     numAttr(el, 'dur', Infinity),
    src:     attr(el, 'src', ''),
    volume:  numAttr(el, 'volume', 1),
    loop:    boolAttr(el, 'loop', false),
    trimIn:  numAttr(el, 'trim-in', 0),
    trimOut: el.hasAttribute('trim-out') ? numAttr(el, 'trim-out', null) : null,
    ...(el.hasAttribute('name') ? { name: attr(el, 'name') } : {}),
    ...(cues ? { cues } : {}),
  };
}

/** @param {Element} el @returns {import('../schema/types.js').WsElement | null} */
function parseElement(el) {
  switch (el.tagName) {
    case 'ws-text':  return parseText(el);
    case 'ws-rect':  return parseRect(el);
    case 'ws-image': return parseImage(el);
    case 'ws-video': return parseVideo(el);
    case 'ws-audio': return parseAudio(el);
    default:         return null;
  }
}

// ─── Cast parser ──────────────────────────────────────────────────────────────

/** @param {Element} el @returns {import('../schema/types.js').WsCharacter} */
function parseCharacter(el) {
  return {
    id:          attr(el, 'id') || nextId('ws-character'),
    name:        attr(el, 'name', ''),
    ...(el.hasAttribute('role')        && { role:        attr(el, 'role') }),
    ...(el.hasAttribute('description') && { description: attr(el, 'description') }),
    ...(el.hasAttribute('avatar-url')  && { avatarUrl:   attr(el, 'avatar-url') }),
  };
}

/**
 * Parse a <ws-cast> element into an array of WsCharacter objects.
 * @param {Element} el
 * @returns {import('../schema/types.js').WsCharacter[]}
 */
function parseCast(el) {
  const characters = [];
  for (const child of el.children) {
    if (child.tagName === 'ws-character') {
      characters.push(parseCharacter(child));
    }
  }
  return characters;
}

// ─── Layer parser ─────────────────────────────────────────────────────────────

/** @param {Element} el @returns {import('../schema/types.js').WsLayer} */
function parseLayer(el) {
  const elements = [];
  for (const child of el.children) {
    const parsed = parseElement(child);
    if (parsed) elements.push(parsed);
  }
  const rawLabel = el.getAttribute('label');
  return {
    id:       attr(el, 'id') || `layer-${elements.length}`,
    ...(rawLabel ? { label: rawLabel } : {}),
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
  let cast = [];

  for (const child of root.children) {
    if (child.tagName === 'ws-layer') {
      layers.push(parseLayer(child));
    } else if (child.tagName === 'ws-cast') {
      cast = parseCast(child);
    }
  }

  return { version, width, height, dur, layers, cast };
}
