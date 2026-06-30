/**
 * @file src/fonts.js
 * Fetch font files from public URLs and register them with node-canvas.
 *
 * Called once before rendering begins. Writes each font to a temp file
 * (node-canvas requires a file path, not a URL or buffer) then calls
 * registerFont() which makes the family available to the 2D context.
 *
 * @module scene-to-video/fonts
 */

import { createWriteStream } from 'fs';
import { pipeline }          from 'stream/promises';
import { join }              from 'path';
import { GlobalFonts }       from '@napi-rs/canvas';

/**
 * Fetch and register all fonts in the manifest.
 *
 * @param {Record<string, string>} fontManifest - { "Inter": "https://..." }
 * @param {string} tmpDir - Writable temp directory (already created by caller)
 * @returns {Promise<void>}
 */
export async function loadFonts(fontManifest, tmpDir) {
  const entries = Object.entries(fontManifest || {});
  if (!entries.length) return;

  await Promise.all(entries.map(async ([family, url]) => {
    const ext      = (url.split('?')[0].split('.').pop() || 'ttf').toLowerCase();
    const safeName = family.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const fontPath = join(tmpDir, `font_${safeName}.${ext}`);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch font "${family}" from ${url} — HTTP ${res.status}`);
    }

    const fileStream = createWriteStream(fontPath);
    await pipeline(res.body, fileStream);

    GlobalFonts.registerFromPath(fontPath, family);
    console.debug(`[scene-to-video] Registered font: "${family}" from ${url}`);
  }));
}
