/**
 * @file index.js
 * @module @wity/scene-to-video
 *
 * Server-side compiler: <wity-scene> XML → MP4.
 *
 * Pipeline:
 *   parse(sceneXml)           — scene-core: XML → WityScene
 *   loadFonts(fontManifest)   — fetch font URLs → registerFont() for node-canvas
 *   renderFrames(scene)       — evaluate() per frame → node-canvas → PNG sequence
 *   framesToVideo(framesDir)  — FFmpeg: PNG sequence → MP4
 *
 * Usage:
 *   import { compile } from '@wity/scene-to-video';
 *
 *   const { videoPath, cleanup } = await compile(sceneXml, fontManifest, { fps: 30 });
 *   // → upload videoPath to storage
 *   await cleanup(); // removes temp directory
 *
 * NODE.JS / SERVER / LAMBDA ONLY — requires node-canvas (native addon) and FFmpeg.
 */

import { DOMParser }     from '@xmldom/xmldom';
import { parse,
         setXmlParser }  from '@wity/scene-core';
import { loadFonts }     from './src/fonts.js';
import { renderFrames }  from './src/renderer.js';
import { framesToVideo } from './src/ffmpeg.js';
import { mkdtemp, rm }   from 'fs/promises';
import { tmpdir }        from 'os';
import { join }          from 'path';

/**
 * Compile a wity-scene XML document to an MP4 video file.
 *
 * @param {string} sceneXml
 *   Serialized `<wity-scene>` XML string.
 *
 * @param {Record<string, string>} [fontManifest={}]
 *   Map of fontFamily name → public URL of the font file (.ttf / .otf / .woff).
 *   Must cover every fontFamily referenced in ws-text elements.
 *   Example: { "Inter": "https://fonts.gstatic.com/s/inter/v13/Inter.ttf" }
 *
 * @param {object}  [options={}]
 * @param {number}  [options.fps=30]         - Output frame rate
 * @param {string}  [options.outputPath]     - Override output .mp4 path (defaults to tmp dir)
 *
 * @returns {Promise<{ videoPath: string, cleanup: () => Promise<void> }>}
 *   videoPath — absolute path to the compiled .mp4 (in a temp dir unless outputPath set)
 *   cleanup   — call after you have uploaded/copied the file to remove the temp dir
 */
// Register @xmldom/xmldom as the XML parser for this Node.js-only package.
// scene-core is isomorphic and uses native DOMParser in the browser;
// here we inject the Node.js implementation once at module load time.
setXmlParser(new DOMParser());

export async function compile(sceneXml, fontManifest = {}, options = {}) {
  const { fps = 30, outputPath } = options;

  const scene  = parse(sceneXml);
  const tmpDir = await mkdtemp(join(tmpdir(), 'wity-compile-'));
  const cleanup = () => rm(tmpDir, { recursive: true, force: true });

  try {
    await loadFonts(fontManifest, tmpDir);
    await renderFrames(scene, tmpDir, { fps });

    const videoPath = outputPath || join(tmpDir, 'output.mp4');
    await framesToVideo(tmpDir, videoPath, { fps });

    return { videoPath, cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
