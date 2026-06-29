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

export const SCHEMA_VERSION = '1.0';

// ─── Animation types ─────────────────────────────────────────────────────────

/** @type {readonly string[]} */
export const ANIMATE_IN_VALUES  = /** @type {const} */ (['none', 'fade', 'fade-up', 'fade-down', 'slide-left', 'slide-right']);
/** @type {readonly string[]} */
export const ANIMATE_OUT_VALUES = /** @type {const} */ (['none', 'fade', 'fade-up', 'fade-down', 'slide-left', 'slide-right']);

// ─── Anchor types ────────────────────────────────────────────────────────────

/** @type {readonly string[]} */
export const ANCHOR_VALUES = /** @type {const} */ ([
  'top-left', 'top', 'top-right',
  'left',     'center', 'right',
  'bottom-left', 'bottom', 'bottom-right',
]);

// ─── Media fit types ─────────────────────────────────────────────────────────

/** @type {readonly string[]} */
export const MEDIA_FIT_VALUES = /** @type {const} */ (['cover', 'contain', 'fill', 'none']);

// ─── Element tags ────────────────────────────────────────────────────────────
// Visual elements (rendered inside ws-layer).
// ws-audio has no visual output but is temporal and lives in layers.

export const ELEMENT_TAGS = /** @type {const} */ (['ws-text', 'ws-rect', 'ws-image', 'ws-video', 'ws-audio']);

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
 * @property {string}      [name]      - Optional human-readable display name
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
 * @property {string}        [name] - Optional human-readable display name
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
