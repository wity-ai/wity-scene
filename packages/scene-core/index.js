/**
 * @wity/scene-core
 * Headless, isomorphic XML scene-graph library.
 *
 * Public API surface:
 *
 *   parse(xml)           → WityScene
 *   serialize(scene)     → XML string
 *   evaluate(scene, t)   → ComputedFrame
 *   validate(scene)      → { valid, errors, warnings }
 *
 * Utils:
 *   resolveUnit(value, containerSize)  → number (px)
 *
 * Schema constants & types are in schema/types.js and re-exported here
 * for consumers who need them without importing internals directly.
 */

export { parse }        from './parser/parse.js';
export { serialize }    from './serializer/serialize.js';
export { evaluate }     from './evaluator/evaluate.js';
export { validate }     from './validator/validate.js';
export { resolveUnit }  from './utils/units.js';

export {
  SCHEMA_VERSION,
  ANIMATE_IN_VALUES,
  ANIMATE_OUT_VALUES,
  ANCHOR_VALUES,
  ELEMENT_TAGS,
} from './schema/types.js';
