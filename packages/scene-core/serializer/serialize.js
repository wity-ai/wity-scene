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
export function serialize(scene) {
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
