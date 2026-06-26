/**
 * @module @wity/scene-compose
 *
 * Full compositing pass for wity-scene documents.
 *
 * Given:
 *   - sceneXml        — raw <wity-scene> XML string
 *   - graphicsMp4Url  — URL of the graphics overlay MP4 produced by @wity/scene-to-video
 *                       (may be null/undefined when the scene has no graphic elements)
 *   - options         — { outputBucket, outputPrefix, fps, sceneWidth, sceneHeight }
 *
 * Produces a fully composited MP4 (ws-video clips + ws-audio tracks + graphics overlay)
 * uploaded to S3, and returns its public URL.
 */

import ffmpeg          from 'fluent-ffmpeg';
import { S3Client,
         PutObjectCommand } from '@aws-sdk/client-s3';
import { stat }            from 'fs/promises';
import { createReadStream } from 'fs';
import { parse }           from '@wity/scene-core';
import { downloadAll,
         downloadToTmp,
         cleanupPaths }    from './src/downloader.js';
import { buildFilterGraph } from './src/filterGraph.js';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all ws-video elements across all layers (ordered by layer then insertion). */
function extractVideos(scene) {
  const results = [];
  for (const layer of scene.layers ?? []) {
    for (const el of layer.elements ?? []) {
      if (el.tag === 'ws-video') results.push(el);
    }
  }
  return results;
}

/** Collect all ws-audio elements across all layers. */
function extractAudios(scene) {
  const results = [];
  for (const layer of scene.layers ?? []) {
    for (const el of layer.elements ?? []) {
      if (el.tag === 'ws-audio') results.push(el);
    }
  }
  return results;
}

/**
 * Derive the finite scene duration.
 * Falls back to the maximum end-point of all video/audio elements.
 */
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
  return max || 30; // last-resort 30s
}

/** Probe a local file and return true if it contains at least one audio stream. */
function probeHasAudio(localPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(localPath, (err, data) => {
      if (err) { resolve(false); return; }
      const hasAudio = (data.streams ?? []).some(s => s.codec_type === 'audio');
      resolve(hasAudio);
    });
  });
}

function runFfmpeg(ff) {
  return new Promise((resolve, reject) =>
    ff.on('end', resolve).on('error', reject).run()
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ComposeOptions
 * @property {string}  outputBucket   - S3 bucket for the output file
 * @property {string}  [outputPrefix] - S3 key prefix (default "scene-composed/")
 * @property {number}  [fps]          - Output frame rate (default 30)
 * @property {number}  [sceneWidth]   - Canvas width in px (default 1280)
 * @property {number}  [sceneHeight]  - Canvas height in px (default 720)
 */

/**
 * @typedef {Object} ComposeResult
 * @property {string} url       - Public S3 URL of the composed video
 * @property {number} fileSize  - Output file size in bytes
 */

/**
 * Compose a wity-scene into a fully rendered MP4.
 *
 * @param {string}        sceneXml        - Raw <wity-scene> XML
 * @param {string|null}   graphicsMp4Url  - URL of graphics overlay (null if none)
 * @param {ComposeOptions} options
 * @returns {Promise<ComposeResult>}
 */
export async function compose(sceneXml, graphicsMp4Url, options = {}) {
  const {
    outputBucket  = process.env.OUTPUT_BUCKET,
    outputPrefix  = process.env.OUTPUT_PREFIX || 'scene-composed/',
    fps           = 30,
    sceneWidth    = 1280,
    sceneHeight   = 720,
  } = options;

  if (!outputBucket) throw new Error('outputBucket is required (or set OUTPUT_BUCKET env var)');

  // ── 1. Parse scene ────────────────────────────────────────────────────────
  const scene   = parse(sceneXml);
  const videos  = extractVideos(scene);
  const audios  = extractAudios(scene);

  if (videos.length === 0 && audios.length === 0 && !graphicsMp4Url) {
    throw new Error('Scene has no ws-video, ws-audio, or graphics content to compose');
  }

  const sceneDur    = resolveSceneDuration(scene, videos, audios);
  const hasGraphics = !!graphicsMp4Url;

  // ── 2. Download all media in parallel ────────────────────────────────────
  const [videoDownloads, audioDownloads] = await Promise.all([
    downloadAll(videos.map((v, i) => ({ url: v.src, hint: `video_${i}` }))),
    downloadAll(audios.map((a, i) => ({ url: a.src, hint: `audio_${i}` }))),
  ]);

  let graphicsLocalPath = null;
  if (hasGraphics) {
    graphicsLocalPath = await downloadToTmp(graphicsMp4Url, 'graphics');
  }

  const allLocalPaths = [
    ...videoDownloads.map(d => d.localPath),
    ...audioDownloads.map(d => d.localPath),
    ...(graphicsLocalPath ? [graphicsLocalPath] : []),
  ];

  const outputPath = `/tmp/composed_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
  allLocalPaths.push(outputPath);

  try {
    // ── 3. Probe audio presence for each video clip ───────────────────────
    // Prevents [idx:a] references for silent video files (FFmpeg crashes on missing streams).
    const videoHasAudio = await Promise.all(
      videoDownloads.map(d => probeHasAudio(d.localPath))
    );

    const videoElems = videos.map((v, i) => ({
      ...v,
      localPath: videoDownloads[i].localPath,
      hasAudio:  videoHasAudio[i],
    }));
    const audioElems = audios.map((a, i) => ({
      ...a,
      localPath: audioDownloads[i].localPath,
    }));

    // ── 4. Build filter graph ──────────────────────────────────────────────
    const { filterComplex, videoMap, audioMap } = buildFilterGraph({
      videos:      videoElems,
      audios:      audioElems,
      hasGraphics,
      sceneWidth,
      sceneHeight,
      sceneDur,
      fps,
    });

    // ── 5. Assemble FFmpeg command ─────────────────────────────────────────
    const ff = ffmpeg();

    // Input 0: black base canvas (lavfi)
    ff.input(`color=black:size=${sceneWidth}x${sceneHeight}:rate=${fps}`)
      .inputFormat('lavfi');

    // Inputs 1…V: video clips (pre-seek to trimIn for efficiency)
    for (const v of videoElems) {
      const trimIn  = v.trimIn ?? 0;
      const clipDur = isFinite(v.dur) ? v.dur : sceneDur;
      ff.input(v.localPath)
        .inputOptions([`-ss ${trimIn}`, `-t ${clipDur}`]);
    }

    // Input V+1: graphics overlay (if any)
    if (hasGraphics && graphicsLocalPath) {
      ff.input(graphicsLocalPath);
    }

    // Inputs V+2…N: audio tracks
    for (const a of audioElems) {
      ff.input(a.localPath);
    }

    ff.complexFilter(filterComplex)
      .outputOptions([
        `-map ${videoMap}`,
        ...(audioMap ? [`-map ${audioMap}`] : []),
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-pix_fmt yuv420p',
        ...(audioMap ? ['-c:a aac', '-b:a 192k'] : ['-an']),
        '-movflags +faststart',
      ])
      .output(outputPath);

    await runFfmpeg(ff);

    // ── 6. Stream upload to S3 (avoids loading full video into memory) ─────
    const fileStat = await stat(outputPath);
    const key      = `${outputPrefix}${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;

    await s3.send(new PutObjectCommand({
      Bucket:        outputBucket,
      Key:           key,
      Body:          createReadStream(outputPath),
      ContentLength: fileStat.size,
      ContentType:   'video/mp4',
      CacheControl:  'public, max-age=31536000',
    }));

    const region = process.env.AWS_REGION || 'ap-south-1';
    const url    = `https://${outputBucket}.s3.${region}.amazonaws.com/${key}`;
    return { url, fileSize: fileStat.size };

  } finally {
    cleanupPaths(allLocalPaths);
  }
}
