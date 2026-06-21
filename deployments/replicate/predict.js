/**
 * @file predict.js
 * Replicate-compatible HTTP prediction server for @wity/scene-to-video.
 *
 * Implements Replicate's Cog HTTP interface:
 *   POST /predictions  — start a prediction (synchronous in this impl)
 *   GET  /health-check — liveness probe
 *
 * Input schema:
 *   scene_xml     {string}  — serialized <wity-scene> XML (required)
 *   font_manifest {string}  — JSON string of { fontFamily: url } (optional)
 *   fps           {number}  — output frame rate, default 30 (optional)
 *
 * Output:
 *   A FileOutput (binary MP4 sent as multipart or base64 depending on Replicate version)
 *   In this impl: returns the MP4 as a base64-encoded string for simplicity.
 *   Adapt to replicate.com/docs/reference/http#predictions.create output format as needed.
 */

import { createServer }    from 'http';
import { readFile }        from 'fs/promises';
import { compile }         from '@wity/scene-to-video';

const PORT = process.env.PORT || 5000;

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health-check') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ready' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/predictions') {
    let body = '';
    for await (const chunk of req) body += chunk;

    let input;
    try {
      const parsed = JSON.parse(body);
      input = parsed.input || parsed;
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const {
      scene_xml,
      font_manifest = '{}',
      fps = 30,
    } = input;

    if (!scene_xml) {
      res.writeHead(422, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'scene_xml is required' }));
      return;
    }

    let fontManifest = {};
    try {
      fontManifest = typeof font_manifest === 'string'
        ? JSON.parse(font_manifest)
        : font_manifest;
    } catch {
      res.writeHead(422, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'font_manifest must be valid JSON' }));
      return;
    }

    let cleanup;
    try {
      const result = await compile(scene_xml, fontManifest, { fps });
      cleanup = result.cleanup;

      const buf    = await readFile(result.videoPath);
      const output = `data:video/mp4;base64,${buf.toString('base64')}`;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'succeeded', output }));
    } catch (e) {
      console.error('[predict] Compilation error:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'failed', error: e.message }));
    } finally {
      if (cleanup) await cleanup();
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[wity-scene-to-video] Replicate prediction server listening on :${PORT}`);
});
