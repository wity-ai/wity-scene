/**
 * @file downloader.js
 * Parallel download of remote media files (HTTPS or S3) to /tmp.
 * Returns local paths alongside original metadata.
 */

import fs    from 'fs';
import https from 'https';
import http  from 'http';
import path  from 'path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a sensible extension from a URL, defaulting to .bin */
function extFromUrl(url) {
  const clean = url.split('?')[0];
  const ext   = path.extname(clean).toLowerCase();
  // Allowed media extensions only — avoids '.com' etc.
  const ALLOWED = new Set(['.mp4', '.mov', '.webm', '.avi',
                           '.mp3', '.wav', '.aac', '.ogg', '.m4a',
                           '.jpg', '.jpeg', '.png', '.webp', '.gif']);
  return ALLOWED.has(ext) ? ext : '.bin';
}

/** Derive S3 bucket + key from an s3:// or virtual-hosted / path-style HTTPS URL. */
function parseS3Url(url) {
  // s3://bucket/key
  const s3Protocol = url.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (s3Protocol) return { bucket: s3Protocol[1], key: s3Protocol[2] };

  // https://bucket.s3.amazonaws.com/key           (virtual-hosted, global)
  // https://bucket.s3.ap-south-1.amazonaws.com/key (virtual-hosted, regional)
  // (?:\.[^.]+)* matches zero or more dot-separated region segments between .s3 and .amazonaws
  const virtualHosted = url.match(/^https?:\/\/([^.]+)\.s3(?:\.[^.]+)*\.amazonaws\.com\/(.+)$/);
  if (virtualHosted) return { bucket: virtualHosted[1], key: virtualHosted[2].split('?')[0] };

  // https://s3.amazonaws.com/bucket/key           (path-style, global)
  // https://s3.ap-south-1.amazonaws.com/bucket/key (path-style, regional)
  const pathStyle = url.match(/^https?:\/\/s3(?:\.[^.]+)*\.amazonaws\.com\/([^/]+)\/(.+)$/);
  if (pathStyle) return { bucket: pathStyle[1], key: pathStyle[2].split('?')[0] };

  return null;
}

function streamToFile(stream, filePath) {
  return new Promise((resolve, reject) =>
    stream.pipe(fs.createWriteStream(filePath))
          .on('finish', resolve)
          .on('error', reject)
  );
}

function httpGetToFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow one redirect
        httpGetToFile(res.headers.location, filePath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(fs.createWriteStream(filePath))
         .on('finish', resolve)
         .on('error', reject);
    }).on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Download a single URL to /tmp.
 *
 * @param {string} url
 * @param {string} [hint]  Label used in the tmp filename for easier debugging.
 * @returns {Promise<string>} Local file path.
 */
export async function downloadToTmp(url, hint = 'media') {
  const ext      = extFromUrl(url);
  const slug     = hint.replace(/[^a-z0-9]/gi, '_').slice(0, 20);
  const filePath = `/tmp/${slug}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;

  const s3Coords = parseS3Url(url);
  if (s3Coords) {
    const data = await s3.send(new GetObjectCommand({ Bucket: s3Coords.bucket, Key: s3Coords.key }));
    await streamToFile(data.Body, filePath);
  } else {
    await httpGetToFile(url, filePath);
  }

  return filePath;
}

/**
 * Download multiple URLs concurrently.
 *
 * @param {Array<{ url: string, hint?: string }>} items
 * @returns {Promise<Array<{ url: string, localPath: string }>>}
 */
export async function downloadAll(items) {
  return Promise.all(
    items.map(async ({ url, hint }) => ({
      url,
      localPath: await downloadToTmp(url, hint),
    }))
  );
}

/**
 * Remove a list of local paths, ignoring errors (best-effort cleanup).
 */
export function cleanupPaths(paths) {
  for (const p of paths) {
    try { fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
