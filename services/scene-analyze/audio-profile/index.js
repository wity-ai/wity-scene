/**
 * @module audio-profile
 *
 * Analyze actual audio loudness over time from a wity-scene document.
 *
 * Downloads all ws-video and ws-audio media files, decodes their audio tracks
 * via FFmpeg, measures RMS loudness per time window, applies XML volume
 * multipliers, and returns per-element + mixed loudness profiles.
 */

import { parse }           from '@wity/scene-core';
import { downloadAll,
         cleanupPaths }    from '@wity/scene-compose/src/downloader.js';
import { decodeToRawPCM,
         measureRMS,
         probeHasAudio,
         probeDuration }   from './analyzer.js';

// ---------------------------------------------------------------------------
// Helpers (adapted from scene-compose — unexported there)
// ---------------------------------------------------------------------------

function extractVideos(scene) {
  const results = [];
  for (const layer of scene.layers ?? []) {
    for (const el of layer.elements ?? []) {
      if (el.tag === 'ws-video') results.push(el);
    }
  }
  return results;
}

function extractAudios(scene) {
  const results = [];
  for (const layer of scene.layers ?? []) {
    for (const el of layer.elements ?? []) {
      if (el.tag === 'ws-audio') results.push(el);
    }
  }
  return results;
}

function resolveSceneDuration(scene, videos, audios) {
  if (scene.dur && isFinite(scene.dur)) return scene.dur;
  let max = 0;
  for (const v of videos) {
    const end = (v.begin ?? 0) + (isFinite(v.dur) ? v.dur : 0);
    if (end > max) max = end;
  }
  for (const a of audios) {
    const end = (a.begin ?? 0) + (isFinite(a.dur) ? a.dur : 0);
    if (end > max) max = end;
  }
  return max || 30;
}

// ---------------------------------------------------------------------------
// dBFS conversion
// ---------------------------------------------------------------------------

function linearToDbfs(linear) {
  return linear > 0 ? 20 * Math.log10(linear) : -Infinity;
}

function buildLoudnessProfile(rmsLinear, startTime, windowMs) {
  const rmsDbfs = rmsLinear.map(linearToDbfs);
  let peak = -Infinity;
  let sumPower = 0;
  let count = 0;
  for (let i = 0; i < rmsLinear.length; i++) {
    if (rmsDbfs[i] > peak) peak = rmsDbfs[i];
    sumPower += rmsLinear[i] * rmsLinear[i];
    count++;
  }
  const avgDbfs = count > 0 ? linearToDbfs(Math.sqrt(sumPower / count)) : -Infinity;

  return {
    startTime,
    windowCount: rmsLinear.length,
    windowMs,
    rmsLinear,
    rmsDbfs,
    peakDbfs: peak,
    avgDbfs,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Analyze audio loudness profile for a wity-scene document.
 *
 * @param {string} sceneXml   Raw <wity-scene> XML.
 * @param {Object} [options]
 * @param {number} [options.windowMs=100]      RMS window size in ms.
 * @param {number} [options.sampleRate=16000]   Decode sample rate.
 * @returns {Promise<Object>}  Structured loudness profile.
 */
export async function analyzeAudioProfile(sceneXml, options = {}) {
  const { windowMs = 100, sampleRate = 16000 } = options;

  // ── 1. Parse scene ──────────────────────────────────────────────────────
  const scene  = parse(sceneXml);
  const videos = extractVideos(scene);
  const audios = extractAudios(scene);

  const sceneDur = resolveSceneDuration(scene, videos, audios);

  // All media elements to process
  const mediaElements = [
    ...videos.map((v, i) => ({ ...v, _hint: `video_${i}` })),
    ...audios.map((a, i) => ({ ...a, _hint: `audio_${i}` })),
  ];

  // Short-circuit: no media at all
  if (mediaElements.length === 0) {
    const numWindows = Math.ceil(sceneDur * 1000 / windowMs);
    return {
      sceneDuration: sceneDur,
      windowMs,
      sampleRate,
      elements: [],
      mixed: buildLoudnessProfile(new Array(numWindows).fill(0), 0, windowMs),
    };
  }

  // ── 2. Download all media in parallel ───────────────────────────────────
  const downloads = await downloadAll(
    mediaElements.map(el => ({ url: el.src, hint: el._hint }))
  );
  const localPaths = downloads.map(d => d.localPath);

  try {
    // ── 3. Decode & measure each element ──────────────────────────────────
    const elementProfiles = [];

    for (let i = 0; i < mediaElements.length; i++) {
      const el        = mediaElements[i];
      const localPath = downloads[i].localPath;

      // Skip muted videos
      const isMuted = el.tag === 'ws-video' && el.muted;

      const hasAudio = isMuted ? false : await probeHasAudio(localPath);

      const profile = {
        id:       el.id,
        tag:      el.tag,
        src:      el.src,
        begin:    el.begin ?? 0,
        dur:      isFinite(el.dur) ? el.dur : null,
        volume:   el.volume ?? 1,
        hasAudio,
        profile:  null,
      };

      if (!hasAudio) {
        elementProfiles.push(profile);
        continue;
      }

      // Resolve effective duration for elements with infinite dur
      let effectiveDur = profile.dur;
      if (effectiveDur == null) {
        const mediaDur = await probeDuration(localPath);
        const trimIn   = el.trimIn ?? 0;
        const sourceDur = (el.trimOut != null ? el.trimOut : mediaDur) - trimIn;
        effectiveDur = Math.min(sourceDur, sceneDur - profile.begin);
        profile.dur = effectiveDur;
      }

      try {
        const pcm = await decodeToRawPCM(localPath, {
          sampleRate,
          trimIn:  el.trimIn ?? 0,
          trimOut: el.trimOut ?? undefined,
        });

        const rawRms = measureRMS(pcm, { sampleRate, windowMs });

        // Apply volume multiplier (linear scale)
        const vol = el.volume ?? 1;
        const adjustedRms = rawRms.map(v => v * vol);

        profile.profile = buildLoudnessProfile(adjustedRms, profile.begin, windowMs);
      } catch (err) {
        console.warn(`[audio-profile] Failed to decode ${el.tag} ${el.id}:`, err.message);
        // Leave profile as null — element included with hasAudio: true but no data
      }

      elementProfiles.push(profile);
    }

    // ── 4. Build mixed profile ────────────────────────────────────────────
    const numWindows = Math.ceil(sceneDur * 1000 / windowMs);
    const mixedPower = new Float64Array(numWindows); // sum of squared amplitudes

    for (const ep of elementProfiles) {
      if (!ep.profile) continue;
      const startWindow = Math.floor(ep.begin * 1000 / windowMs);
      const rms = ep.profile.rmsLinear;
      for (let j = 0; j < rms.length; j++) {
        const idx = startWindow + j;
        if (idx < numWindows) {
          mixedPower[idx] += rms[j] * rms[j];
        }
      }
    }

    const mixedRms = Array.from(mixedPower, p => Math.sqrt(p));
    const mixed = buildLoudnessProfile(mixedRms, 0, windowMs);

    return {
      sceneDuration: sceneDur,
      windowMs,
      sampleRate,
      elements: elementProfiles,
      mixed,
    };

  } finally {
    cleanupPaths(localPaths);
  }
}
