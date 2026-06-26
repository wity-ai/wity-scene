/**
 * @file filterGraph.js
 * Builds an FFmpeg filter_complex string for full scene composition:
 *
 *   [0]  — lavfi color=black base (canvas at scene resolution/fps)
 *   [1..V]   — ws-video clips  (one input each, ordered by appearance)
 *   [V+1]    — graphics overlay MP4 (from witySceneToVideo, optional)
 *   [V+2..N] — ws-audio tracks (one input each)
 *
 * Output streams: [vout] (video) + [aout] (audio)
 *
 * Fit modes (ws-video.fit):
 *   "cover"   → scale+crop to fill target rect (no letterbox)
 *   "contain" → scale to fit within rect, pad remainder (letterbox)
 *   "fill"    → stretch to exact rect (default)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a UnitValue (number | "50%" | "720px") to pixels given a container size.
 * Bare numbers and "Npx" strings are treated as pixels; "N%" is relative.
 */
function resolveUnit(value, containerSize) {
  if (value === undefined || value === null) return containerSize;
  if (typeof value === 'number') return value;
  const s = String(value).trim();
  if (s.endsWith('%'))  return Math.round((parseFloat(s) / 100) * containerSize);
  if (s.endsWith('px')) return Math.round(parseFloat(s));
  return Math.round(Number(s));
}

/**
 * Build the scale+fit filter chain for a single video clip.
 * Returns the filterGraph segment string that reads from `inputLabel`
 * and writes to `outputLabel`.
 */
function buildFitFilter(inputLabel, outputLabel, dstW, dstH, fit = 'fill') {
  switch (fit) {
    case 'cover':
      return `${inputLabel}scale=${dstW}:${dstH}:force_original_aspect_ratio=increase,crop=${dstW}:${dstH}${outputLabel}`;
    case 'contain':
      return `${inputLabel}scale=${dstW}:${dstH}:force_original_aspect_ratio=decrease,pad=${dstW}:${dstH}:(ow-iw)/2:(oh-ih)/2${outputLabel}`;
    case 'fill':
    default:
      return `${inputLabel}scale=${dstW}:${dstH}${outputLabel}`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} VideoElement
 * @property {string}          localPath  - Downloaded file path
 * @property {number}          begin      - Start time in scene seconds
 * @property {number}          dur        - Clip display duration in seconds
 * @property {number}          trimIn     - Source trim-in point (seconds)
 * @property {number}          [x]        - Left position (px or UnitValue) default 0
 * @property {number}          [y]        - Top position (px or UnitValue) default 0
 * @property {number|string}   [width]    - Width (px or UnitValue) default sceneWidth
 * @property {number|string}   [height]   - Height (px or UnitValue) default sceneHeight
 * @property {string}          [fit]      - "cover"|"contain"|"fill"
 * @property {number}          [volume]   - Audio volume scalar (default 1, 0 = muted)
 * @property {boolean}         [muted]    - If true, suppress embedded audio
 * @property {boolean}         hasAudio   - Whether the file actually has an audio stream
 */

/**
 * @typedef {Object} AudioElement
 * @property {string}  localPath  - Downloaded file path
 * @property {number}  begin      - Start time in scene seconds
 * @property {number}  dur        - Duration in seconds (Infinity = full scene)
 * @property {number}  [volume]   - Volume scalar (default 1)
 */

/**
 * @typedef {Object} FilterGraphResult
 * @property {string}   filterComplex  - Full -filter_complex value
 * @property {string}   videoMap       - -map value for video output stream  ("[vout]")
 * @property {string}   audioMap       - -map value for audio output stream  ("[aout]") or null
 * @property {string[]} inputArgs      - Flat array of ffmpeg input args (each clip/track)
 *                                       already includes -ss / -t for trim.
 *                                       Callers prepend the lavfi base and append graphics.
 */

/**
 * Build the full FFmpeg input arg list and filter_complex string.
 *
 * Input index layout (zero-based):
 *   0          — lavfi black base  (added by caller as first ffmpeg.input())
 *   1 … V      — ws-video clips    (one per element, with -ss trimIn -t dur)
 *   V+1        — graphics MP4      (added when graphicsMp4Path is provided)
 *   V+2 … V+2+A-1 — ws-audio tracks
 *
 * @param {object}         opts
 * @param {VideoElement[]} opts.videos
 * @param {AudioElement[]} opts.audios
 * @param {boolean}        opts.hasGraphics   - Whether a graphics overlay input is present
 * @param {number}         opts.sceneWidth
 * @param {number}         opts.sceneHeight
 * @param {number}         opts.sceneDur      - Total scene duration in seconds
 * @param {number}         [opts.fps]         - Output frame rate (default 30)
 * @returns {FilterGraphResult}
 */
export function buildFilterGraph({
  videos,
  audios,
  hasGraphics,
  sceneWidth,
  sceneHeight,
  sceneDur,
  fps = 30,
}) {
  const W = sceneWidth;
  const H = sceneHeight;
  const parts = [];   // filter_complex segments

  // ── Index layout ──────────────────────────────────────────────────────────
  const videoBaseIdx  = 1;                            // first video clip input
  const graphicsIdx   = videoBaseIdx + videos.length; // graphics overlay (if present)
  const audioBaseIdx  = graphicsIdx + (hasGraphics ? 1 : 0);

  // ── [0] Base canvas ───────────────────────────────────────────────────────
  // Normalise the lavfi source to the right size/fps/duration and give it a label.
  parts.push(`[0]fps=${fps},scale=${W}:${H},trim=duration=${sceneDur},setpts=PTS-STARTPTS[base]`);

  // ── Video clips ───────────────────────────────────────────────────────────
  let prevVideoLabel = '[base]';

  videos.forEach((v, i) => {
    const idx    = videoBaseIdx + i;
    // x/y default to 0, not containerSize — use explicit fallback before resolveUnit
    const dstX   = (v.x  != null) ? resolveUnit(v.x, W) : 0;
    const dstY   = (v.y  != null) ? resolveUnit(v.y, H) : 0;
    const dstW   = (v.width  != null) ? resolveUnit(v.width,  W) : W;
    const dstH   = (v.height != null) ? resolveUnit(v.height, H) : H;
    const begin  = v.begin ?? 0;
    const end    = begin + (v.dur ?? sceneDur);

    const scaledLabel  = `[v${i}s]`;
    const ptsLabel     = `[v${i}p]`;
    const overlayLabel = `[ov${i}]`;

    // Scale/fit to destination rect
    parts.push(buildFitFilter(`[${idx}:v]`, scaledLabel, dstW, dstH, v.fit ?? 'fill'));

    // Shift PTS so the clip starts at `begin` seconds in the output
    parts.push(`${scaledLabel}setpts=PTS-STARTPTS+${begin}/TB${ptsLabel}`);

    // Overlay onto previous composite, enabled only within the clip's window
    parts.push(
      `${prevVideoLabel}${ptsLabel}overlay=${dstX}:${dstY}:enable='between(t,${begin},${end})'${overlayLabel}`
    );

    prevVideoLabel = overlayLabel;
  });

  // ── Graphics overlay ──────────────────────────────────────────────────────
  if (hasGraphics) {
    parts.push(`${prevVideoLabel}[${graphicsIdx}:v]overlay=0:0[vout]`);
  } else {
    // No graphics — just pass the composited video through with the final label
    parts.push(`${prevVideoLabel}null[vout]`);
  }

  // ── Audio tracks ─────────────────────────────────────────────────────────
  const audioOutputLabels = [];

  audios.forEach((a, i) => {
    const idx    = audioBaseIdx + i;
    const begin  = a.begin ?? 0;
    const vol    = a.volume ?? 1;
    const delayMs = Math.round(begin * 1000);

    const aLabel = `[a${i}]`;
    // adelay shifts the track; aresample ensures consistent sample rate;
    // volume scales amplitude
    parts.push(`[${idx}:a]adelay=${delayMs}|${delayMs},volume=${vol}${aLabel}`);
    audioOutputLabels.push(aLabel);
  });

  // Mix in embedded audio from video clips that are not muted and have an audio stream.
  // hasAudio is probed by the caller (index.js) before building the filter graph —
  // referencing [idx:a] for a silent video file would crash FFmpeg.
  videos.forEach((v, i) => {
    if (v.muted || !v.hasAudio) return;
    const vol    = v.volume ?? 1;
    if (vol === 0) return;
    const idx    = videoBaseIdx + i;
    const begin  = v.begin ?? 0;
    const delayMs = Math.round(begin * 1000);
    const aLabel = `[va${i}]`;
    parts.push(`[${idx}:a]adelay=${delayMs}|${delayMs},volume=${vol}${aLabel}`);
    audioOutputLabels.push(aLabel);
  });

  let audioMap = null;
  if (audioOutputLabels.length > 0) {
    if (audioOutputLabels.length === 1) {
      // No need for amix when there's a single track
      parts.push(`${audioOutputLabels[0]}anull[aout]`);
    } else {
      parts.push(
        `${audioOutputLabels.join('')}amix=inputs=${audioOutputLabels.length}:normalize=0[aout]`
      );
    }
    audioMap = '[aout]';
  }

  return {
    filterComplex: parts.join(';\n'),
    videoMap:  '[vout]',
    audioMap,
  };
}
