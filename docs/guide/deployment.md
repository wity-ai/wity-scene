# Deployment — Server-Side Video Pipeline

wity-scene provides a single public Lambda entry point (`witySceneRender`) that accepts a scene XML document and returns a rendered output URL. Internally it inspects the scene content and routes to the appropriate specialized Lambdas — callers never need to know about the internal pipeline.

---

## Public entry point — `witySceneRender`

```
caller → witySceneRender (gateway)
              │ parse + detect content
              ├─ hasGraphics? → witySceneToVideo → graphicsMp4Url
              └─ hasMedia?    → witySceneCompose(graphicsMp4Url) → final URL
```

### Input

```json
{
  "sceneXml":      "<wity-scene>...</wity-scene>",
  "outputFormat":  "mp4",
  "options": {
    "fps":          30,
    "sceneWidth":   1920,
    "sceneHeight":  1080,
    "fontManifest": { "Inter": "https://cdn.example.com/Inter.ttf" }
  }
}
```

`outputFormat` defaults to `"mp4"`. `options` fields all have defaults (see below). `fontManifest` is only relevant if the scene contains `ws-text` elements with custom fonts.

### Response

```json
{ "url": "https://...", "fileSize": 9876543, "pipeline": ["witySceneToVideo", "witySceneCompose"] }
```

`pipeline` tells the caller which downstream Lambdas were invoked. Useful for observability and cost attribution.

### Lambda config

| Setting | Value |
|---------|-------|
| Function name | `witySceneRender` |
| Memory | 512 MB |
| Timeout | 660 s (11 min — accommodates two sequential 300s downstream calls) |
| Ephemeral storage | 512 MB |
| Runtime | Node.js 20 |
| No FFmpeg layer needed | This Lambda only parses and routes — no media processing |

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCENE_TO_VIDEO_FUNCTION` | `witySceneToVideo` | Name of the graphics compiler Lambda |
| `SCENE_COMPOSE_FUNCTION` | `witySceneCompose` | Name of the compositor Lambda |

> **IAM note:** The execution role must have `lambda:InvokeFunction` permission on both downstream Lambdas.

---

## Routing logic

The gateway parses the scene and checks element tags across all layers:

| Scene content | Route |
|---|---|
| Only `ws-rect` / `ws-text` / `ws-image` | `witySceneToVideo` only → done |
| `ws-video` / `ws-audio` with graphic elements | `witySceneToVideo` → `witySceneCompose` |
| `ws-video` / `ws-audio` with no graphic elements | `witySceneCompose` only (`graphicsMp4Url: null`) |

This routing is entirely internal. The caller provides `sceneXml` and receives a URL.

---

## Adding a new output format

The gateway uses a `PIPELINE_REGISTRY` keyed by `outputFormat`. To add a future format (e.g. PDF):

1. Deploy a specialized Lambda (e.g. `witySceneToPdf`).
2. Add `"pdf"` to `PIPELINE_REGISTRY` in `handler.js` — a single function `(sceneXml, content, options) → { url, fileSize, pipeline }`.
3. Add `SCENE_TO_PDF_FUNCTION` env var to the gateway config.

No changes to any other Lambda. Existing `"mp4"` routing is untouched.

```js
// Example future entry in PIPELINE_REGISTRY:
pdf: async (sceneXml, { hasGraphics }, options) => {
  const r = await invokeLambda(process.env.SCENE_TO_PDF_FUNCTION || 'witySceneToPdf', {
    sceneXml,
    fontManifest: options.fontManifest ?? {},
  });
  return { url: r.url, fileSize: r.fileSize, pipeline: ['witySceneToPdf'] };
},
```

---

## Downstream Lambdas (internal)

These are internal infrastructure. Callers should not invoke them directly — use `witySceneRender`.

### `witySceneToVideo` — graphics compiler

Renders `ws-rect`, `ws-text`, `ws-image` → PNG frame sequence → silent MP4. `ws-video` and `ws-audio` are ignored.

**Package:** [`@wity/scene-to-video`](/packages/scene-to-video)

| Setting | Value |
|---------|-------|
| Memory | 3008 MB |
| Timeout | 300 s |
| Ephemeral storage | 4096 MB |
| FFmpeg layer | `arn:aws:lambda:ap-south-1:175033217214:layer:ffmpeg:1` |

Input: `{ sceneXml, fontManifest?, fps? }` → `{ url, fileSize }`

### `witySceneCompose` — full compositor

Blends `ws-video` clips + `ws-audio` tracks + optional graphics overlay via FFmpeg `filter_complex`.

**Package:** [`@wity/scene-compose`](/packages/scene-compose)

| Setting | Value |
|---------|-------|
| Memory | 2048 MB |
| Timeout | 300 s |
| Ephemeral storage | 4096 MB |
| FFmpeg layer | `arn:aws:lambda:ap-south-1:175033217214:layer:ffmpeg:1` |

Input: `{ sceneXml, graphicsMp4Url?, fps?, sceneWidth?, sceneHeight? }` → `{ url, fileSize }`

---

## S3 bucket setup

Both downstream Lambdas write to the same bucket (`wity-user-generated-content`) under different prefixes:

| Lambda | Prefix | Example key |
|--------|--------|-------------|
| `witySceneToVideo` | `scene-compiled/` | `scene-compiled/1234-abc.mp4` |
| `witySceneCompose` | `scene-composed/` | `scene-composed/5678-def.mp4` |

The gateway Lambda does not write to S3 — it only orchestrates.
