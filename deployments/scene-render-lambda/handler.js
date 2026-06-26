/**
 * @file handler.js
 * witySceneRender — render gateway Lambda.
 *
 * Single public entry point for all scene-to-output compilation. Inspects the
 * scene document, decides which downstream Lambdas to invoke, and returns the
 * final output URL. Callers never need to know about the internal pipeline.
 *
 * Input (event.body JSON):
 *   {
 *     sceneXml:      string,          // raw <wity-scene> XML
 *     outputFormat?: "mp4",           // default "mp4"; extensible for future formats
 *     options?: {
 *       fps?:          number,         // default 30
 *       sceneWidth?:   number,         // default 1280
 *       sceneHeight?:  number,         // default 720
 *       fontManifest?: Record<string,string>,  // { 'FontName': 'https://...' }
 *     }
 *   }
 *
 * Output (response body JSON):
 *   { url: string, fileSize: number, pipeline: string[] }
 *
 *   `pipeline` lists which downstream Lambdas were invoked, e.g.:
 *     ["witySceneToVideo"]                         — graphics-only scene
 *     ["witySceneToVideo", "witySceneCompose"]     — mixed scene
 *     ["witySceneCompose"]                         — media-only scene
 *
 * Environment variables:
 *   SCENE_TO_VIDEO_FUNCTION   — name of the graphics Lambda  (default: witySceneToVideo)
 *   SCENE_COMPOSE_FUNCTION    — name of the compose Lambda   (default: witySceneCompose)
 *   AWS_REGION                — AWS region                   (default: ap-south-1)
 *
 * Adding a new output format (e.g. PDF):
 *   1. Deploy a new specialized Lambda (e.g. witySceneToPdf).
 *   2. Add "pdf" to PIPELINE_REGISTRY below with its routing function.
 *   3. Add SCENE_TO_PDF_FUNCTION env var.
 *   Done — no changes to any other Lambda.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { parse }                        from '@wity/scene-core';

const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'ap-south-1' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FN = {
  sceneToVideo: process.env.SCENE_TO_VIDEO_FUNCTION || 'witySceneToVideo',
  sceneCompose: process.env.SCENE_COMPOSE_FUNCTION  || 'witySceneCompose',
};

// ---------------------------------------------------------------------------
// Scene content detection
// ---------------------------------------------------------------------------

const GRAPHIC_TAGS = new Set(['ws-rect', 'ws-text', 'ws-image']);
const MEDIA_TAGS   = new Set(['ws-video', 'ws-audio']);

function detectContent(scene) {
  let hasGraphics = false;
  let hasMedia    = false;

  for (const layer of scene.layers ?? []) {
    for (const el of layer.elements ?? []) {
      if (GRAPHIC_TAGS.has(el.tag)) hasGraphics = true;
      if (MEDIA_TAGS.has(el.tag))   hasMedia    = true;
      if (hasGraphics && hasMedia)   return { hasGraphics, hasMedia }; // early exit
    }
  }

  return { hasGraphics, hasMedia };
}

// ---------------------------------------------------------------------------
// Lambda invocation helper
// ---------------------------------------------------------------------------

async function invokeLambda(functionName, payload) {
  const res = await lambda.send(new InvokeCommand({
    FunctionName:   functionName,
    InvocationType: 'RequestResponse',
    Payload:        JSON.stringify({ body: JSON.stringify(payload) }),
  }));

  // FunctionError is set when the Lambda itself threw an unhandled exception
  if (res.FunctionError) {
    const raw = Buffer.from(res.Payload).toString();
    let msg;
    try { msg = JSON.parse(raw).errorMessage ?? raw; } catch { msg = raw; }
    throw new Error(`${functionName} execution error: ${msg}`);
  }

  const outer = JSON.parse(Buffer.from(res.Payload).toString());
  const body  = typeof outer.body === 'string' ? JSON.parse(outer.body) : (outer.body ?? outer);

  if ((outer.statusCode ?? 200) !== 200) {
    throw new Error(`${functionName} returned ${outer.statusCode}: ${body.error ?? JSON.stringify(body)}`);
  }

  return body; // { url, fileSize }
}

// ---------------------------------------------------------------------------
// Pipeline registry — one entry per output format.
// Each entry is a function (sceneXml, { hasGraphics, hasMedia }, options)
// → Promise<{ url, fileSize, pipeline }>
// ---------------------------------------------------------------------------

const PIPELINE_REGISTRY = {

  mp4: async (sceneXml, { hasGraphics, hasMedia }, options) => {
    const {
      fps          = 30,
      sceneWidth   = 1280,
      sceneHeight  = 720,
      fontManifest = {},
    } = options;

    if (!hasGraphics && !hasMedia) {
      throw new Error('Scene contains no renderable elements (ws-rect/ws-text/ws-image/ws-video/ws-audio)');
    }

    const pipeline = [];

    // Stage 1: graphics compiler — only when scene has graphic elements
    let graphicsMp4Url = null;
    if (hasGraphics) {
      const r1 = await invokeLambda(FN.sceneToVideo, { sceneXml, fontManifest, fps });
      graphicsMp4Url = r1.url;
      pipeline.push(FN.sceneToVideo);

      // Graphics-only scene — stage 1 output is the final result
      if (!hasMedia) {
        return { url: r1.url, fileSize: r1.fileSize, pipeline };
      }
    }

    // Stage 2: full compositor — always runs when scene has ws-video or ws-audio
    const r2 = await invokeLambda(FN.sceneCompose, {
      sceneXml,
      graphicsMp4Url,   // null when scene has no graphic elements
      fps,
      sceneWidth,
      sceneHeight,
    });
    pipeline.push(FN.sceneCompose);

    return { url: r2.url, fileSize: r2.fileSize, pipeline };
  },

  // Future formats drop in here without touching any other Lambda:
  //
  // pdf: async (sceneXml, { hasGraphics }, options) => {
  //   const r = await invokeLambda(process.env.SCENE_TO_PDF_FUNCTION || 'witySceneToPdf',
  //                                { sceneXml, fontManifest: options.fontManifest ?? {} });
  //   return { url: r.url, fileSize: r.fileSize, pipeline: ['witySceneToPdf'] };
  // },
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

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

  const { sceneXml, outputFormat = 'mp4', options = {} } = body;

  if (!sceneXml) {
    return { statusCode: 400, body: JSON.stringify({ error: 'sceneXml is required' }) };
  }

  const pipelineFn = PIPELINE_REGISTRY[outputFormat];
  if (!pipelineFn) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: `Unknown outputFormat "${outputFormat}". Supported: ${Object.keys(PIPELINE_REGISTRY).join(', ')}`,
      }),
    };
  }

  let scene;
  try {
    scene = parse(sceneXml);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: `Invalid sceneXml: ${e.message}` }) };
  }

  const content = detectContent(scene);

  try {
    const result = await pipelineFn(sceneXml, content, options);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    console.error('[witySceneRender] Pipeline failed:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
