/**
 * @file analyzer.js
 * FFmpeg audio decode and RMS loudness measurement.
 */

import ffmpeg from 'fluent-ffmpeg';

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

/**
 * Decode audio from a local media file to raw 32-bit float mono PCM.
 *
 * @param {string} localPath  Path to a local media file (video or audio).
 * @param {Object} opts
 * @param {number} [opts.sampleRate=16000]  Decode sample rate.
 * @param {number} [opts.trimIn=0]          Start offset in source (seconds).
 * @param {number} [opts.trimOut]           End offset in source (seconds); omit = full file.
 * @returns {Promise<Buffer>}  Raw PCM buffer (f32le, mono).
 */
export function decodeToRawPCM(localPath, { sampleRate = 16000, trimIn = 0, trimOut } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    const ff = ffmpeg(localPath)
      .inputOptions(trimIn > 0 ? [`-ss ${trimIn}`] : [])
      .noVideo()
      .audioChannels(1)
      .audioFrequency(sampleRate)
      .format('f32le')
      .outputOptions(trimOut != null ? [`-to ${trimOut}`] : []);

    const stream = ff.pipe();
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    ff.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Measure
// ---------------------------------------------------------------------------

/**
 * Compute RMS loudness per time window from a raw PCM buffer.
 *
 * @param {Buffer} pcmBuffer   Raw f32le mono PCM.
 * @param {Object} opts
 * @param {number} [opts.sampleRate=16000]  Sample rate of the PCM data.
 * @param {number} [opts.windowMs=100]      Window size in milliseconds.
 * @returns {number[]}  Array of linear RMS values (0.0–1.0), one per window.
 */
export function measureRMS(pcmBuffer, { sampleRate = 16000, windowMs = 100 } = {}) {
  const samples    = new Float32Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 4);
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  if (windowSize === 0) return [];

  const windows = [];
  for (let i = 0; i < samples.length; i += windowSize) {
    const end = Math.min(i + windowSize, samples.length);
    let sumSq = 0;
    for (let j = i; j < end; j++) {
      sumSq += samples[j] * samples[j];
    }
    windows.push(Math.sqrt(sumSq / (end - i)));
  }
  return windows;
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

/**
 * Check whether a local file contains at least one audio stream.
 *
 * @param {string} localPath
 * @returns {Promise<boolean>}
 */
export function probeHasAudio(localPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(localPath, (err, data) => {
      if (err) { resolve(false); return; }
      resolve((data.streams ?? []).some(s => s.codec_type === 'audio'));
    });
  });
}

/**
 * Get the duration of a media file in seconds via ffprobe.
 *
 * @param {string} localPath
 * @returns {Promise<number>}  Duration in seconds, or 0 on error.
 */
export function probeDuration(localPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(localPath, (err, data) => {
      if (err) { resolve(0); return; }
      resolve(data.format?.duration ?? 0);
    });
  });
}
