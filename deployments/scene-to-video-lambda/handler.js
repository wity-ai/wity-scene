/**
 * @file handler.js
 * AWS Lambda handler — wraps @wity/scene-to-video for deployment in
 * content-publisher-service's Lambda fleet.
 *
 * Invocation pattern mirrors existing Lambda utils in content-publisher-service
 * (double-JSON body, CDN→S3 input URL mapping handled by caller).
 *
 * Input (event.body JSON):
 *   { sceneXml: string, fontManifest?: Record<string,string>, fps?: number }
 *
 * Output (response body JSON):
 *   { url: string, fileSize: number }
 *
 * Environment variables:
 *   OUTPUT_BUCKET  — S3 bucket name for compiled video output
 *   OUTPUT_PREFIX  — S3 key prefix (default: "scene-compiled/")
 *   FFMPEG_PATH    — override ffmpeg binary path (optional, falls back to PATH)
 *   AWS_REGION     — AWS region (default: ap-south-1)
 */

import { compile }          from '@wity/scene-to-video';
import { S3Client,
         PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile, stat }   from 'fs/promises';
import { extname }          from 'path';

const s3     = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const BUCKET = process.env.OUTPUT_BUCKET;
const PREFIX = process.env.OUTPUT_PREFIX || 'scene-compiled/';

export const handler = async (event) => {
  let body;
  try {
    body = JSON.parse(typeof event.body === 'string' ? event.body : JSON.stringify(event.body || event));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { sceneXml, fontManifest = {}, fps = 30 } = body;

  if (!sceneXml) {
    return { statusCode: 400, body: JSON.stringify({ error: 'sceneXml is required' }) };
  }

  let cleanup;
  try {
    const result = await compile(sceneXml, fontManifest, { fps });
    cleanup = result.cleanup;

    const buf      = await readFile(result.videoPath);
    const fileStat = await stat(result.videoPath);
    const key      = `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;

    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        buf,
      ContentType: 'video/mp4',
    }));

    const url = `https://${BUCKET}.s3.amazonaws.com/${key}`;
    return {
      statusCode: 200,
      body: JSON.stringify({ url, fileSize: fileStat.size }),
    };
  } catch (e) {
    console.error('[wity-scene-lambda] Compilation failed:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  } finally {
    if (cleanup) await cleanup();
  }
};
