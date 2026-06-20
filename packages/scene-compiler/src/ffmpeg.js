/**
 * @file src/ffmpeg.js
 * Stitch a PNG frame sequence into an MP4 using fluent-ffmpeg.
 *
 * Expects frames named frame_00000.png, frame_00001.png ... in framesDir.
 * FFmpeg must be available in PATH (Lambda layer, Docker image, or system install).
 * Override binary path via FFMPEG_PATH env variable if needed.
 *
 * @module scene-compiler/ffmpeg
 */

import ffmpeg from 'fluent-ffmpeg';
import { join } from 'path';

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

/**
 * Compile a directory of PNG frames to an MP4 file.
 *
 * @param {string} framesDir  - Directory containing frame_NNNNN.png files
 * @param {string} outputPath - Destination .mp4 file path
 * @param {object} [options]
 * @param {number} [options.fps=30]
 * @returns {Promise<string>} Resolves with outputPath on success
 */
export function framesToVideo(framesDir, outputPath, { fps = 30 } = {}) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(join(framesDir, 'frame_%05d.png'))
      .inputOptions([`-framerate ${fps}`])
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',   // broadest compatibility (QuickTime, iOS, etc.)
        '-preset fast',
        '-crf 18',            // visually lossless
        '-movflags +faststart' // web-optimised: moov atom at front
      ])
      .output(outputPath)
      .on('start',  cmd  => console.debug('[scene-compiler] ffmpeg:', cmd))
      .on('end',    ()   => resolve(outputPath))
      .on('error',  err  => reject(new Error(`FFmpeg failed: ${err.message}`)))
      .run();
  });
}
