/**
 * @file schema/types.js
 * JSDoc type definitions and runtime constants for the wity-scene v1.0 schema.
 *
 * A WityScene document is a deterministic spatial-temporal composition:
 *   f(scene, t) → ComputedFrame
 *
 * XML representation:
 *   <wity-scene version="1.0" width="1920" height="1080" dur="8.0">
 *     <ws-cast>
 *       <ws-character id="char1" name="Sarah" role="host" />
 *     </ws-cast>
 *     <ws-layer id="media" z="0">
 *       <ws-video src="clip.mp4" width="100%" height="100%" begin="0" dur="8" />
 *       <ws-audio src="music.mp3" begin="0" dur="8" volume="0.4" />
 *     </ws-layer>
 *     <ws-layer id="graphics" z="10">
 *       <ws-image src="poster.jpg" x="50%" y="50%" anchor="center" begin="2" dur="4" />
 *       <ws-text x="50%" y="40%" anchor="center" animate-in="fade-up" animate-dur="0.6">
 *         Opening Night
 *       </ws-text>
 *     </ws-layer>
 *   </wity-scene>
 */

// ─── Schema version ──────────────────────────────────────────────────────────

const SCHEMA_VERSION = '1.0';

// ─── Animation types ─────────────────────────────────────────────────────────

/** @type {readonly string[]} */
const ANIMATE_IN_VALUES  = /** @type {const} */ (['none', 'fade', 'fade-up', 'fade-down', 'slide-left', 'slide-right']);
/** @type {readonly string[]} */
const ANIMATE_OUT_VALUES = /** @type {const} */ (['none', 'fade', 'fade-up', 'fade-down', 'slide-left', 'slide-right']);

// ─── Anchor types ────────────────────────────────────────────────────────────

/** @type {readonly string[]} */
const ANCHOR_VALUES = /** @type {const} */ ([
  'top-left', 'top', 'top-right',
  'left',     'center', 'right',
  'bottom-left', 'bottom', 'bottom-right',
]);

// ─── Media fit types ─────────────────────────────────────────────────────────

/** @type {readonly string[]} */
const MEDIA_FIT_VALUES = /** @type {const} */ (['cover', 'contain', 'fill', 'none']);

// ─── Element tags ────────────────────────────────────────────────────────────
// Visual elements (rendered inside ws-layer).
// ws-audio has no visual output but is temporal and lives in layers.

const ELEMENT_TAGS = /** @type {const} */ (['ws-text', 'ws-rect', 'ws-image', 'ws-video', 'ws-audio']);

// ─── JSDoc types ─────────────────────────────────────────────────────────────

/**
 * A resolved unit value — always pixels after `resolveUnit()`.
 * @typedef {number} Pixels
 */

/**
 * Raw unit string from XML attribute: "50%", "120px", or bare number string "120".
 * @typedef {string | number} UnitValue
 */

/**
 * @typedef {'none'|'fade'|'fade-up'|'fade-down'|'slide-left'|'slide-right'} AnimateValue
 */

/**
 * @typedef {'top-left'|'top'|'top-right'|'left'|'center'|'right'|'bottom-left'|'bottom'|'bottom-right'} AnchorValue
 */

/**
 * @typedef {'cover'|'contain'|'fill'|'none'} MediaFit
 */

/**
 * Common positional and temporal attributes shared by visual elements.
 * @typedef {Object} WsElementBase
 * @property {string}      id          - Unique element identifier (auto-assigned if absent in XML)
 * @property {UnitValue}   x           - Horizontal position
 * @property {UnitValue}   y           - Vertical position
 * @property {AnchorValue} anchor      - Origin point for x/y positioning
 * @property {number}      begin       - Start time within the layer, seconds (default 0)
 * @property {number}      dur         - Duration in seconds; Infinity = full scene duration
 * @property {number}      z           - Z-index within the layer (default 0)
 * @property {number}      opacity     - 0–1 (default 1)
 * @property {AnimateValue} animateIn  - Entrance animation
 * @property {AnimateValue} animateOut - Exit animation
 * @property {number}      animateDur  - Duration of entrance/exit animation in seconds (default 0.4)
 */

/**
 * @typedef {WsElementBase & {
 *   tag:         'ws-text',
 *   content:     string,
 *   fontSize:    UnitValue,
 *   fontFamily:  string,
 *   fontWeight:  string,
 *   color:       string,
 *   textAlign:   'left'|'center'|'right',
 *   lineHeight:  number,
 *   maxWidth:    UnitValue | null,
 *   letterSpacing: UnitValue,
 * }} WsText
 */

/**
 * @typedef {WsElementBase & {
 *   tag:          'ws-rect',
 *   width:        UnitValue,
 *   height:       UnitValue,
 *   fill:         string,
 *   stroke:       string | null,
 *   strokeWidth:  number,
 *   rx:           number,
 * }} WsRect
 */

/**
 * @typedef {WsElementBase & {
 *   tag:         'ws-image',
 *   src:         string,
 *   width:       UnitValue,
 *   height:      UnitValue,
 *   fit:         MediaFit,
 * }} WsImage
 */

/**
 * A video clip element — positioned and temporally placed within a layer.
 * @typedef {WsElementBase & {
 *   tag:     'ws-video',
 *   src:     string,
 *   width:   UnitValue,
 *   height:  UnitValue,
 *   fit:     MediaFit,
 *   volume:  number,
 *   trimIn:  number,
 *   trimOut: number | null,
 *   muted:   boolean,
 * }} WsVideo
 */

/**
 * An audio track element — temporal only, no visual output.
 * Lives inside a ws-layer for document organisation but has no spatial position.
 * @typedef {Object} WsAudio
 * @property {string}        tag     - 'ws-audio'
 * @property {string}        id      - Unique identifier
 * @property {number}        begin   - Start time in seconds (default 0)
 * @property {number}        dur     - Duration in seconds; Infinity = full scene duration
 * @property {string}        src     - Audio file URL
 * @property {number}        volume  - 0–1 (default 1)
 * @property {boolean}       loop    - Whether to loop (default false)
 * @property {number}        trimIn  - Trim start offset in seconds (default 0)
 * @property {number | null} trimOut - Trim end offset in seconds from start; null = no trim
 */

/**
 * @typedef {WsText | WsRect | WsImage | WsVideo | WsAudio} WsElement
 */

/**
 * @typedef {Object} WsLayer
 * @property {string}      id       - Layer identifier
 * @property {string}      [label]  - Human-readable display name; optional, falls back to id in UIs
 * @property {number}      z        - Layer z-index
 * @property {number}      opacity  - Layer-level opacity (multiplied with element opacity)
 * @property {WsElement[]} elements
 */

/**
 * A semantic character entity within the scene.
 * Not rendered — consumed by authoring tools, AI agents, players, and compilers.
 * Stored in the <ws-cast> section of the scene document.
 * @typedef {Object} WsCharacter
 * @property {string}  id           - Unique character identifier
 * @property {string}  name         - Display name
 * @property {string}  [role]       - Role in the scene (e.g. "host", "narrator")
 * @property {string}  [description] - Free-form description or notes
 * @property {string}  [avatarUrl]  - URL to avatar/reference image
 */

/**
 * Root scene document — the parsed, validated in-memory representation.
 * @typedef {Object} WityScene
 * @property {string}        version    - Schema version, e.g. "1.0"
 * @property {number}        width      - Canvas width in pixels
 * @property {number}        height     - Canvas height in pixels
 * @property {number}        dur        - Total duration in seconds
 * @property {WsLayer[]}     layers
 * @property {WsCharacter[]} cast       - Semantic character entities (non-rendered metadata)
 */

/**
 * A single element's fully computed state at time t.
 * All unit values resolved to pixels; opacity includes layer opacity.
 * @typedef {Object} ComputedElement
 * @property {string}      id
 * @property {string}      tag
 * @property {number}      x
 * @property {number}      y
 * @property {number}      opacity     - Effective opacity (element × layer × animation)
 * @property {number}      z
 * @property {boolean}     visible     - False when outside [begin, begin+dur]
 * @property {Object}      props       - Tag-specific resolved props (fontSize px, etc.)
 * @property {string|null} content     - Text content (ws-text only)
 */

/**
 * Output of evaluate(scene, t): the full render frame at time t.
 * @typedef {Object} ComputedFrame
 * @property {number}            t        - The time this frame was computed for
 * @property {number}            width
 * @property {number}            height
 * @property {ComputedElement[]} elements - Sorted by effective z (layer.z * 1000 + element.z)
 */

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
function setXmlParser(parserInstance) {
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
  };
}

/** @param {Element} el @returns {import('../schema/types.js').WsAudio} */
function parseAudio(el) {
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
function parse(xml) {
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

/**
 * @file serializer/serialize.js
 * Serialize a WityScene object back to a canonical XML string.
 * Round-trips cleanly with parse() — no information lost.
 *
 * @module serializer/serialize
 */

// ─── Attribute helpers ────────────────────────────────────────────────────────

/**
 * Format a key/value pair as an XML attribute string.
 * Skips null, undefined, and values equal to their defaults.
 * @param {string} name
 * @param {string|number|boolean|null|undefined} value
 * @param {string|number|boolean|null} [defaultValue] - omit the attr if value === default
 */
function attrib(name, value, defaultValue = undefined) {
  if (value == null) return '';
  if (defaultValue !== undefined && value === defaultValue) return '';
  return ` ${name}="${escapeAttr(String(value))}"`;
}

/** Escape XML attribute special chars */
function escapeAttr(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape XML text content */
function escapeText(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function ind(depth) {
  return '  '.repeat(depth);
}

// ─── Element serializers ─────────────────────────────────────────────────────

/**
 * Serialize the common WsElementBase attributes (visual elements).
 * @param {import('../schema/types.js').WsElementBase} el
 */
function baseAttribs(el) {
  return [
    attrib('id',          el.id),
    attrib('x',           el.x,          0),
    attrib('y',           el.y,          0),
    attrib('anchor',      el.anchor,     'top-left'),
    attrib('begin',       el.begin,      0),
    attrib('dur',         Number.isFinite(el.dur) ? el.dur : undefined),
    attrib('z',           el.z,          0),
    attrib('opacity',     el.opacity,    1),
    attrib('animate-in',  el.animateIn,  'none'),
    attrib('animate-out', el.animateOut, 'none'),
    attrib('animate-dur', el.animateDur, 0.4),
  ].join('');
}

/** @param {import('../schema/types.js').WsText} el @param {number} depth */
function serializeText(el, depth) {
  const attrs = baseAttribs(el) + [
    attrib('font-size',      el.fontSize,      '3%'),
    attrib('font-family',    el.fontFamily,    'sans-serif'),
    attrib('font-weight',    el.fontWeight,    'normal'),
    attrib('color',          el.color,         '#ffffff'),
    attrib('text-align',     el.textAlign,     'center'),
    attrib('line-height',    el.lineHeight,    1.4),
    attrib('max-width',      el.maxWidth       ?? undefined),
    attrib('letter-spacing', el.letterSpacing, 0),
  ].join('');

  if (!el.content) {
    return `${ind(depth)}<ws-text${attrs} />`;
  }
  return `${ind(depth)}<ws-text${attrs}>${escapeText(el.content)}</ws-text>`;
}

/** @param {import('../schema/types.js').WsRect} el @param {number} depth */
function serializeRect(el, depth) {
  const attrs = baseAttribs(el) + [
    attrib('width',        el.width,       '100%'),
    attrib('height',       el.height,      '100%'),
    attrib('fill',         el.fill,        'transparent'),
    attrib('stroke',       el.stroke       ?? undefined),
    attrib('stroke-width', el.strokeWidth, 1),
    attrib('rx',           el.rx,          0),
  ].join('');
  return `${ind(depth)}<ws-rect${attrs} />`;
}

/** @param {import('../schema/types.js').WsImage} el @param {number} depth */
function serializeImage(el, depth) {
  const attrs = baseAttribs(el) + [
    attrib('src',    el.src),
    attrib('width',  el.width,  '100%'),
    attrib('height', el.height, '100%'),
    attrib('fit',    el.fit,    'cover'),
  ].join('');
  return `${ind(depth)}<ws-image${attrs} />`;
}

/** @param {import('../schema/types.js').WsVideo} el @param {number} depth */
function serializeVideo(el, depth) {
  const attrs = baseAttribs(el) + [
    attrib('src',      el.src),
    attrib('width',    el.width,   '100%'),
    attrib('height',   el.height,  '100%'),
    attrib('fit',      el.fit,     'cover'),
    attrib('volume',   el.volume,  1),
    attrib('trim-in',  el.trimIn,  0),
    attrib('trim-out', el.trimOut  ?? undefined),
    attrib('muted',    el.muted,   false),
  ].join('');
  return `${ind(depth)}<ws-video${attrs} />`;
}

/** @param {import('../schema/types.js').WsAudio} el @param {number} depth */
function serializeAudio(el, depth) {
  const attrs = [
    attrib('id',       el.id),
    attrib('begin',    el.begin,  0),
    attrib('dur',      Number.isFinite(el.dur) ? el.dur : undefined),
    attrib('src',      el.src),
    attrib('volume',   el.volume, 1),
    attrib('loop',     el.loop,   false),
    attrib('trim-in',  el.trimIn, 0),
    attrib('trim-out', el.trimOut ?? undefined),
  ].join('');
  return `${ind(depth)}<ws-audio${attrs} />`;
}

/** @param {import('../schema/types.js').WsElement} el @param {number} depth */
function serializeElement(el, depth) {
  switch (el.tag) {
    case 'ws-text':  return serializeText(el, depth);
    case 'ws-rect':  return serializeRect(el, depth);
    case 'ws-image': return serializeImage(el, depth);
    case 'ws-video': return serializeVideo(el, depth);
    case 'ws-audio': return serializeAudio(el, depth);
    default:         return '';
  }
}

// ─── Cast serializer ──────────────────────────────────────────────────────────

/** @param {import('../schema/types.js').WsCharacter} char @param {number} depth */
function serializeCharacter(char, depth) {
  const attrs = [
    attrib('id',          char.id),
    attrib('name',        char.name),
    attrib('role',        char.role        ?? undefined),
    attrib('description', char.description ?? undefined),
    attrib('avatar-url',  char.avatarUrl   ?? undefined),
  ].join('');
  return `${ind(depth)}<ws-character${attrs} />`;
}

/**
 * @param {import('../schema/types.js').WsCharacter[]} cast
 * @param {number} depth
 */
function serializeCast(cast, depth) {
  if (cast.length === 0) return '';
  const children = cast.map((c) => serializeCharacter(c, depth + 1)).join('\n');
  return `${ind(depth)}<ws-cast>\n${children}\n${ind(depth)}</ws-cast>`;
}

// ─── Layer serializer ─────────────────────────────────────────────────────────

/** @param {import('../schema/types.js').WsLayer} layer @param {number} depth */
function serializeLayer(layer, depth) {
  const attrs = [
    attrib('id',      layer.id),
    attrib('label',   layer.label || undefined),
    attrib('z',       layer.z,       0),
    attrib('opacity', layer.opacity, 1),
  ].join('');

  if (layer.elements.length === 0) {
    return `${ind(depth)}<ws-layer${attrs} />`;
  }

  const children = layer.elements
    .map((el) => serializeElement(el, depth + 1))
    .filter(Boolean)
    .join('\n');

  return `${ind(depth)}<ws-layer${attrs}>\n${children}\n${ind(depth)}</ws-layer>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Serialize a WityScene object to a canonical XML string.
 *
 * @param {import('../schema/types.js').WityScene} scene
 * @returns {string} UTF-8 XML string, indented with 2-space nesting
 */
function serialize(scene) {
  const rootAttribs = [
    attrib('version', scene.version, ''),
    attrib('width',   scene.width),
    attrib('height',  scene.height),
    attrib('dur',     scene.dur),
  ].join('');

  const cast   = scene.cast   ?? [];
  const layers = scene.layers ?? [];

  const castXml   = serializeCast(cast, 1);
  const layersXml = layers.map((l) => serializeLayer(l, 1)).join('\n');

  const bodyParts = [castXml, layersXml].filter(Boolean);

  if (bodyParts.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<wity-scene${rootAttribs} />`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<wity-scene${rootAttribs}>\n${bodyParts.join('\n')}\n</wity-scene>`;
}

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
function resolveUnit(value, containerSize) {
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
function resolveX(value, sceneWidth) {
  return resolveUnit(value, sceneWidth);
}

/**
 * Resolve y using scene height as the container.
 * @param {string | number} value
 * @param {number}          sceneHeight
 * @returns {number}
 */
function resolveY(value, sceneHeight) {
  return resolveUnit(value, sceneHeight);
}

/**
 * @file evaluator/easing.js
 * Pure easing functions used by the animation evaluator.
 * All functions take a normalised progress value p ∈ [0, 1] and return a
 * value in [0, 1] (or slightly outside for overshoot easings).
 */


/** Ease out cubic — snappy entrance, gentle stop */
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);

/** Ease in cubic — slow start, accelerating exit */
const easeInCubic = (p) => p * p * p;

/**
 * Clamp p to [0, 1] then apply easeOutCubic.
 * Safe to call with any float.
 * @param {number} p
 * @returns {number}
 */
const safeEaseOut = (p) => easeOutCubic(Math.min(1, Math.max(0, p)));

/**
 * Clamp p to [0, 1] then apply easeInCubic.
 * @param {number} p
 * @returns {number}
 */
const safeEaseIn = (p) => easeInCubic(Math.min(1, Math.max(0, p)));

/**
 * @file evaluator/evaluate.js
 * Core evaluator: f(scene, t) → ComputedFrame
 *
 * Given a parsed WityScene and a time t (seconds), returns the complete
 * render state for that instant. Pure function — no side effects, no DOM.
 *
 * @module evaluator/evaluate
 */


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
function evaluate(scene, t) {
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

/**
 * @file validator/validate.js
 * Structural validator for WityScene objects.
 *
 * Validates a parsed (or hand-constructed) WityScene and returns a result
 * object rather than throwing, so callers can surface errors granularly.
 *
 * @module validator/validate
 */


/**
 * @typedef {Object} ValidationResult
 * @property {boolean}  valid
 * @property {string[]} errors  - Human-readable error messages
 * @property {string[]} warnings
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isFinitePositive(n) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function isNonNegative(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

function isUnitValue(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v !== 'string') return false;
  if (v.endsWith('%') || v.endsWith('px')) return Number.isFinite(parseFloat(v));
  return Number.isFinite(parseFloat(v));
}

function isOpacity(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

function isVolume(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

// ─── Base element validator ───────────────────────────────────────────────────

/**
 * @param {import('../schema/types.js').WsElementBase} el
 * @param {string} path
 * @param {string[]} errors
 * @param {string[]} warnings
 */
function validateBase(el, path, errors, warnings) {
  if (typeof el.id !== 'string' || !el.id) {
    errors.push(`${path}: id must be a non-empty string`);
  }
  if (!isUnitValue(el.x)) errors.push(`${path}: x is not a valid unit value`);
  if (!isUnitValue(el.y)) errors.push(`${path}: y is not a valid unit value`);
  if (!ANCHOR_VALUES.includes(el.anchor)) {
    errors.push(`${path}: anchor "${el.anchor}" is not valid. Allowed: ${ANCHOR_VALUES.join(', ')}`);
  }
  if (!isNonNegative(el.begin)) errors.push(`${path}: begin must be a non-negative number`);
  if (el.dur !== Infinity && !isNonNegative(el.dur)) {
    errors.push(`${path}: dur must be a non-negative number or Infinity`);
  }
  if (!isNonNegative(el.z)) warnings.push(`${path}: z is negative — may render behind layer background`);
  if (!isOpacity(el.opacity)) errors.push(`${path}: opacity must be in [0, 1]`);
  if (!ANIMATE_IN_VALUES.includes(el.animateIn)) {
    errors.push(`${path}: animate-in "${el.animateIn}" is not valid`);
  }
  if (!ANIMATE_OUT_VALUES.includes(el.animateOut)) {
    errors.push(`${path}: animate-out "${el.animateOut}" is not valid`);
  }
  if (!isNonNegative(el.animateDur)) {
    errors.push(`${path}: animate-dur must be a non-negative number`);
  }
}

// ─── Element validators ───────────────────────────────────────────────────────

/** @param {import('../schema/types.js').WsText} el @param {string} path */
function validateText(el, path, errors, warnings) {
  validateBase(el, path, errors, warnings);
  if (typeof el.content !== 'string') errors.push(`${path}: content must be a string`);
  if (!isUnitValue(el.fontSize)) errors.push(`${path}: font-size is not a valid unit value`);
  if (typeof el.fontFamily !== 'string') errors.push(`${path}: font-family must be a string`);
  if (typeof el.color !== 'string') errors.push(`${path}: color must be a string`);
  if (!['left', 'center', 'right'].includes(el.textAlign)) {
    errors.push(`${path}: text-align must be left, center, or right`);
  }
  if (!isFinitePositive(el.lineHeight)) errors.push(`${path}: line-height must be a positive number`);
  if (el.maxWidth !== null && !isUnitValue(el.maxWidth)) {
    errors.push(`${path}: max-width is not a valid unit value`);
  }
  if (!isUnitValue(el.letterSpacing)) errors.push(`${path}: letter-spacing is not a valid unit value`);
}

/** @param {import('../schema/types.js').WsRect} el @param {string} path */
function validateRect(el, path, errors, warnings) {
  validateBase(el, path, errors, warnings);
  if (!isUnitValue(el.width))  errors.push(`${path}: width is not a valid unit value`);
  if (!isUnitValue(el.height)) errors.push(`${path}: height is not a valid unit value`);
  if (typeof el.fill !== 'string') errors.push(`${path}: fill must be a string`);
  if (el.stroke !== null && typeof el.stroke !== 'string') {
    errors.push(`${path}: stroke must be a string or null`);
  }
  if (!isNonNegative(el.strokeWidth)) errors.push(`${path}: stroke-width must be non-negative`);
  if (!isNonNegative(el.rx)) errors.push(`${path}: rx must be non-negative`);
}

/** @param {import('../schema/types.js').WsImage} el @param {string} path */
function validateImage(el, path, errors, warnings) {
  validateBase(el, path, errors, warnings);
  if (typeof el.src !== 'string' || !el.src) {
    errors.push(`${path}: src must be a non-empty string`);
  }
  if (!isUnitValue(el.width))  errors.push(`${path}: width is not a valid unit value`);
  if (!isUnitValue(el.height)) errors.push(`${path}: height is not a valid unit value`);
  if (!MEDIA_FIT_VALUES.includes(el.fit)) {
    errors.push(`${path}: fit must be one of: ${MEDIA_FIT_VALUES.join(', ')}`);
  }
}

/** @param {import('../schema/types.js').WsVideo} el @param {string} path */
function validateVideo(el, path, errors, warnings) {
  validateBase(el, path, errors, warnings);
  if (typeof el.src !== 'string' || !el.src) {
    errors.push(`${path}: src must be a non-empty string`);
  }
  if (!isUnitValue(el.width))  errors.push(`${path}: width is not a valid unit value`);
  if (!isUnitValue(el.height)) errors.push(`${path}: height is not a valid unit value`);
  if (!MEDIA_FIT_VALUES.includes(el.fit)) {
    errors.push(`${path}: fit must be one of: ${MEDIA_FIT_VALUES.join(', ')}`);
  }
  if (!isVolume(el.volume)) errors.push(`${path}: volume must be in [0, 1]`);
  if (!isNonNegative(el.trimIn)) errors.push(`${path}: trim-in must be non-negative`);
  if (el.trimOut !== null && !isNonNegative(el.trimOut)) {
    errors.push(`${path}: trim-out must be non-negative or null`);
  }
  if (typeof el.muted !== 'boolean') errors.push(`${path}: muted must be a boolean`);
}

/** @param {import('../schema/types.js').WsAudio} el @param {string} path */
function validateAudio(el, path, errors, warnings) {
  if (typeof el.id !== 'string' || !el.id) {
    errors.push(`${path}: id must be a non-empty string`);
  }
  if (!isNonNegative(el.begin)) errors.push(`${path}: begin must be a non-negative number`);
  if (el.dur !== Infinity && !isNonNegative(el.dur)) {
    errors.push(`${path}: dur must be a non-negative number or Infinity`);
  }
  if (typeof el.src !== 'string' || !el.src) {
    errors.push(`${path}: src must be a non-empty string`);
  }
  if (!isVolume(el.volume)) errors.push(`${path}: volume must be in [0, 1]`);
  if (typeof el.loop !== 'boolean') errors.push(`${path}: loop must be a boolean`);
  if (!isNonNegative(el.trimIn)) errors.push(`${path}: trim-in must be non-negative`);
  if (el.trimOut !== null && !isNonNegative(el.trimOut)) {
    errors.push(`${path}: trim-out must be non-negative or null`);
  }
}

// ─── Cast validator ───────────────────────────────────────────────────────────

/**
 * @param {import('../schema/types.js').WsCharacter[]} cast
 * @param {string[]} errors
 * @param {string[]} warnings
 */
function validateCast(cast, errors, warnings) {
  if (!Array.isArray(cast)) {
    errors.push('scene.cast must be an array');
    return;
  }

  const seenIds = new Set();
  for (let i = 0; i < cast.length; i++) {
    const char = cast[i];
    const path = `cast[${i}]`;

    if (!char || typeof char !== 'object') {
      errors.push(`${path}: must be an object`);
      continue;
    }
    if (typeof char.id !== 'string' || !char.id) {
      errors.push(`${path}: id must be a non-empty string`);
    } else if (seenIds.has(char.id)) {
      errors.push(`${path}: id "${char.id}" is not unique within the cast`);
    } else {
      seenIds.add(char.id);
    }
    if (typeof char.name !== 'string' || !char.name) {
      errors.push(`${path}: name must be a non-empty string`);
    }
    if (char.role        !== undefined && typeof char.role        !== 'string') errors.push(`${path}: role must be a string`);
    if (char.description !== undefined && typeof char.description !== 'string') errors.push(`${path}: description must be a string`);
    if (char.avatarUrl   !== undefined && typeof char.avatarUrl   !== 'string') errors.push(`${path}: avatar-url must be a string`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate a WityScene object. Returns errors and warnings without throwing.
 *
 * @param {import('../schema/types.js').WityScene} scene
 * @returns {ValidationResult}
 */
function validate(scene) {
  const errors   = [];
  const warnings = [];

  if (!scene || typeof scene !== 'object') {
    return { valid: false, errors: ['scene must be an object'], warnings: [] };
  }

  // Root
  if (scene.version !== SCHEMA_VERSION) {
    warnings.push(`scene.version is "${scene.version}", expected "${SCHEMA_VERSION}"`);
  }
  if (!isFinitePositive(scene.width))  errors.push('scene.width must be a positive number');
  if (!isFinitePositive(scene.height)) errors.push('scene.height must be a positive number');
  if (!isFinitePositive(scene.dur))    errors.push('scene.dur must be a positive number');
  if (!Array.isArray(scene.layers))    errors.push('scene.layers must be an array');

  // Cast (optional — treated as empty if absent)
  if (scene.cast !== undefined) {
    validateCast(scene.cast, errors);
  }

  if (!Array.isArray(scene.layers)) {
    return { valid: errors.length === 0, errors, warnings };
  }

  // Collect element ids for uniqueness check across all layers
  const seenIds = new Set();

  for (let li = 0; li < scene.layers.length; li++) {
    const layer = scene.layers[li];
    const lPath = `layers[${li}]`;

    if (!layer || typeof layer !== 'object') {
      errors.push(`${lPath}: must be an object`);
      continue;
    }
    if (typeof layer.id !== 'string' || !layer.id) {
      errors.push(`${lPath}: id must be a non-empty string`);
    }
    if (layer.label !== undefined && typeof layer.label !== 'string') {
      warnings.push(`${lPath}: label must be a string if provided`);
    }
    if (!isOpacity(layer.opacity)) {
      errors.push(`${lPath}: opacity must be in [0, 1]`);
    }
    if (!Array.isArray(layer.elements)) {
      errors.push(`${lPath}: elements must be an array`);
      continue;
    }

    for (let ei = 0; ei < layer.elements.length; ei++) {
      const el    = layer.elements[ei];
      const ePath = `${lPath}.elements[${ei}]`;

      if (!el || typeof el !== 'object') {
        errors.push(`${ePath}: must be an object`);
        continue;
      }
      if (!ELEMENT_TAGS.includes(el.tag)) {
        errors.push(`${ePath}: unknown tag "${el.tag}". Allowed: ${ELEMENT_TAGS.join(', ')}`);
        continue;
      }

      // Duplicate id check (ws-audio uses id directly)
      const elId = el.id;
      if (elId && seenIds.has(elId)) {
        errors.push(`${ePath}: id "${elId}" is not unique within the scene`);
      } else if (elId) {
        seenIds.add(elId);
      }

      switch (el.tag) {
        case 'ws-text':  validateText(el,  ePath, errors, warnings); break;
        case 'ws-rect':  validateRect(el,  ePath, errors, warnings); break;
        case 'ws-image': validateImage(el, ePath, errors, warnings); break;
        case 'ws-video': validateVideo(el, ePath, errors, warnings); break;
        case 'ws-audio': validateAudio(el, ePath, errors); break;
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export { ANCHOR_VALUES, ANIMATE_IN_VALUES, ANIMATE_OUT_VALUES, ELEMENT_TAGS, SCHEMA_VERSION, evaluate, parse, resolveUnit, serialize, setXmlParser, validate };
//# sourceMappingURL=scene-core.esm.js.map
