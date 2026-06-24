/**
 * @file validator/validate.js
 * Structural validator for WityScene objects.
 *
 * Validates a parsed (or hand-constructed) WityScene and returns a result
 * object rather than throwing, so callers can surface errors granularly.
 *
 * @module validator/validate
 */

import {
  SCHEMA_VERSION,
  ANIMATE_IN_VALUES,
  ANIMATE_OUT_VALUES,
  ANCHOR_VALUES,
  ELEMENT_TAGS,
  MEDIA_FIT_VALUES,
} from '../schema/types.js';

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
export function validate(scene) {
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
    validateCast(scene.cast, errors, warnings);
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
        case 'ws-audio': validateAudio(el, ePath, errors, warnings); break;
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
