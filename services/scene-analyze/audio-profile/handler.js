/**
 * @file handler.js
 * AWS Lambda handler — wraps the audio-profile analyzer for deployment.
 *
 * Input (event.body JSON):
 *   {
 *     sceneXml:    string,         // raw <wity-scene> XML
 *     options?: {
 *       windowMs?:   number,       // RMS window size in ms (default 100)
 *       sampleRate?: number,       // decode sample rate (default 16000)
 *     }
 *   }
 *
 * Output (response body JSON):
 *   {
 *     sceneDuration: number,
 *     windowMs:      number,
 *     sampleRate:    number,
 *     elements:      ElementProfile[],
 *     mixed:         LoudnessProfile,
 *   }
 *
 * Environment variables:
 *   FFMPEG_PATH  — override ffmpeg binary path (optional, for Lambda layer)
 *   AWS_REGION   — AWS region (default: ap-south-1)
 */

import { analyzeAudioProfile } from './index.js';

if (process.env.FFMPEG_PATH) {
  const ffmpeg = await import('fluent-ffmpeg');
  ffmpeg.default.setFfmpegPath(process.env.FFMPEG_PATH);
}

export const handler = async (event) => {
  let body;
  try {
    body = JSON.parse(
      typeof event.body === 'string'
        ? event.body
        : JSON.stringify(event.body ?? event)
    );
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { sceneXml, options } = body;

  if (!sceneXml) {
    return { statusCode: 400, body: JSON.stringify({ error: 'sceneXml is required' }) };
  }

  try {
    const result = await analyzeAudioProfile(sceneXml, options);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (e) {
    console.error('[audio-profile] Analysis failed:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
