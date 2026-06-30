/**
 * @file handler.js
 * AWS Lambda handler — wraps @wity/scene-compose for deployment.
 *
 * Input (event.body JSON):
 *   {
 *     sceneXml:       string,         // raw <wity-scene> XML
 *     graphicsMp4Url: string | null,  // URL from witySceneToVideo (may be omitted)
 *     fps?:           number,         // default 30
 *     sceneWidth?:    number,         // default 1280
 *     sceneHeight?:   number,         // default 720
 *   }
 *
 * Output (response body JSON):
 *   { url: string, fileSize: number }
 *
 * Environment variables:
 *   OUTPUT_BUCKET  — S3 bucket for composed video output
 *   OUTPUT_PREFIX  — S3 key prefix (default: "scene-composed/")
 *   AWS_REGION     — AWS region (default: ap-south-1)
 *   FFMPEG_PATH    — override ffmpeg binary path (optional)
 */

import { compose } from '@wity/scene-compose';

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

  const {
    sceneXml,
    graphicsMp4Url = null,
    fps         = 30,
    sceneWidth  = 1280,
    sceneHeight = 720,
  } = body;

  if (!sceneXml) {
    return { statusCode: 400, body: JSON.stringify({ error: 'sceneXml is required' }) };
  }

  try {
    const result = await compose(sceneXml, graphicsMp4Url, {
      fps,
      sceneWidth,
      sceneHeight,
    });
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (e) {
    console.error('[scene-compose-lambda] Composition failed:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
