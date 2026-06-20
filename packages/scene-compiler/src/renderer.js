/**
 * @file src/renderer.js
 * Render a parsed WityScene to a PNG frame sequence using node-canvas (Cairo).
 *
 * Position semantics (from evaluate.js):
 *   ws-rect / ws-image : el.x, el.y = top-left corner (anchor offset already applied)
 *   ws-text            : el.x, el.y = raw position; ctx.textAlign drives horizontal origin
 *                        ctx.textBaseline = 'top' so y is the top of the first line
 *
 * @module scene-compiler/renderer
 */

import { evaluate }                from '@wity/scene-core';
import { createCanvas, loadImage } from 'canvas';
import { writeFile }               from 'fs/promises';
import { join }                    from 'path';

// ─── Image pre-loading ────────────────────────────────────────────────────────

/**
 * Walk the scene and pre-load all unique ws-image src URLs into a cache.
 * Failures are warned and skipped — a missing image leaves blank space rather
 * than aborting the entire compile.
 *
 * @param {import('@wity/scene-core').WityScene} scene
 * @returns {Promise<Map<string, import('canvas').Image>>}
 */
async function preloadImages(scene) {
  const urls = new Set();
  for (const layer of scene.layers) {
    for (const el of layer.elements) {
      if (el.tag === 'ws-image' && el.src) urls.add(el.src);
    }
  }

  const cache = new Map();
  await Promise.all([...urls].map(async url => {
    try {
      cache.set(url, await loadImage(url));
    } catch (e) {
      console.warn(`[scene-compiler] WARN: Could not load image "${url}": ${e.message}`);
    }
  }));
  return cache;
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

/**
 * Draw a rectangle path with optional corner radius.
 * Caller is responsible for fill/stroke after calling this.
 */
function pathRoundedRect(ctx, x, y, w, h, rx) {
  const r = Math.min(rx, w / 2, h / 2);
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

/**
 * Draw a ws-image element respecting the `fit` property.
 *
 * fit values:
 *   fill    – stretch to fill bounds (default canvas behaviour)
 *   contain – letterbox, maintain aspect ratio, fit within bounds
 *   cover   – crop to fill bounds, maintain aspect ratio, clip to bounds
 *   none    – draw at natural size from top-left
 */
function drawImage(ctx, img, x, y, w, h, fit) {
  const iw = img.naturalWidth  || img.width;
  const ih = img.naturalHeight || img.height;

  switch (fit) {
    case 'none':
      ctx.drawImage(img, x, y);
      break;

    case 'contain': {
      const scale = Math.min(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      break;
    }

    case 'cover': {
      const scale = Math.max(w / iw, h / ih);
      const dw    = iw * scale;
      const dh    = ih * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      ctx.restore();
      break;
    }

    case 'fill':
    default:
      ctx.drawImage(img, x, y, w, h);
  }
}

// ─── Element renderers ────────────────────────────────────────────────────────

function renderRect(ctx, el) {
  const { width, height, fill, stroke, strokeWidth, rx } = el.props;
  pathRoundedRect(ctx, el.x, el.y, width, height, rx);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke && strokeWidth > 0) {
    ctx.strokeStyle  = stroke;
    ctx.lineWidth    = strokeWidth;
    ctx.stroke();
  }
}

function renderImage(ctx, el, imageCache) {
  const { src, width, height, fit } = el.props;
  const img = imageCache.get(src);
  if (!img) return; // already warned at preload time
  drawImage(ctx, img, el.x, el.y, width, height, fit);
}

/**
 * ws-text rendering.
 *
 * el.x, el.y is the raw position from the scene document (anchor offset = 0
 * for text since evaluate.js only applies anchor offsets for sized elements).
 * ctx.textAlign = el.props.textAlign so the horizontal origin matches intent.
 * ctx.textBaseline = 'top' so y is the top of the first line.
 * Multi-line text is handled by splitting on \n with lineHeight spacing.
 */
function renderText(ctx, el) {
  const {
    fontSize, fontFamily, fontWeight, color,
    textAlign, lineHeight, maxWidth, letterSpacing
  } = el.props;

  ctx.font         = `${fontWeight} ${fontSize}px "${fontFamily}"`;
  ctx.fillStyle    = color;
  ctx.textAlign    = textAlign;
  ctx.textBaseline = 'top';

  // letterSpacing is supported in node-canvas >=2.11
  if (letterSpacing != null && ctx.letterSpacing !== undefined) {
    ctx.letterSpacing = `${letterSpacing}px`;
  }

  const lines  = (el.content || '').split('\n');
  const lineH  = fontSize * lineHeight;

  lines.forEach((line, i) => {
    const drawArgs = [line, el.x, el.y + i * lineH];
    if (maxWidth != null) drawArgs.push(maxWidth);
    ctx.fillText(...drawArgs);
  });
}

// ─── Frame renderer ───────────────────────────────────────────────────────────

/**
 * Render a single ComputedFrame onto ctx.
 * Elements are already sorted by z (painters algorithm) by evaluate().
 */
function renderFrame(ctx, frame, imageCache) {
  ctx.clearRect(0, 0, frame.width, frame.height);

  for (const el of frame.elements) {
    if (!el.visible) continue;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, el.opacity));

    switch (el.tag) {
      case 'ws-rect':  renderRect(ctx, el);              break;
      case 'ws-image': renderImage(ctx, el, imageCache); break;
      case 'ws-text':  renderText(ctx, el);              break;
      default:
        console.warn(`[scene-compiler] Unknown element tag: ${el.tag}`);
    }

    ctx.restore();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Render all frames of a scene to PNG files in framesDir.
 *
 * Files are named frame_00000.png, frame_00001.png, ... matching the
 * input pattern expected by ffmpeg.js.
 *
 * @param {import('@wity/scene-core').WityScene} scene
 * @param {string} framesDir   - Writable directory for PNG output
 * @param {object} [options]
 * @param {number} [options.fps=30]
 * @returns {Promise<number>} Total frame count
 */
export async function renderFrames(scene, framesDir, { fps = 30 } = {}) {
  const imageCache  = await preloadImages(scene);
  const canvas      = createCanvas(scene.width, scene.height);
  const ctx         = canvas.getContext('2d');
  const totalFrames = Math.ceil(scene.dur * fps);

  console.debug(`[scene-compiler] Rendering ${totalFrames} frames at ${fps}fps (${scene.dur}s)`);

  for (let i = 0; i < totalFrames; i++) {
    const t     = i / fps;
    const frame = evaluate(scene, t);
    renderFrame(ctx, frame, imageCache);

    const buf      = canvas.toBuffer('image/png');
    const filename = `frame_${String(i).padStart(5, '0')}.png`;
    await writeFile(join(framesDir, filename), buf);
  }

  return totalFrames;
}
