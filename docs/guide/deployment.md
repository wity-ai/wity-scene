# Deployment — Server-Side Video Pipeline

wity-scene scenes that contain `ws-video` or `ws-audio` elements require a two-step server-side pipeline to produce a final MP4. Scenes with only graphic elements (`ws-rect`, `ws-text`, `ws-image`) only need step 1.

---

## Two-step pipeline overview

```
sceneXml
  │
  ├──▶  Step 1: witySceneToVideo   (graphics compiler)
  │         ws-rect + ws-text + ws-image
  │         → PNG frame sequence → silent MP4
  │         → returns: graphicsMp4Url
  │
  └──▶  Step 2: witySceneCompose   (full compositor)
            ws-video clips + ws-audio tracks + graphicsMp4Url
            → FFmpeg filter_complex
            → final composited MP4
            → returns: { url, fileSize }
```

The two steps are separate Lambda functions. The caller orchestrates them and passes the output of step 1 into step 2.

---

## Step 1 — `witySceneToVideo`

Renders the **graphic layers** only (ws-rect, ws-text, ws-image). ws-video and ws-audio elements are ignored.

**Package:** [`@wity/scene-to-video`](/packages/scene-to-video)

**Lambda:** `witySceneToVideo`

### Invocation

```json
{
  "sceneXml":     "<wity-scene>...</wity-scene>",
  "fontManifest": { "Inter": "https://cdn.example.com/Inter.ttf" },
  "fps":          30
}
```

`fontManifest` is optional — pass `{}` if no custom fonts.

### Response

```json
{ "url": "https://wity-user-generated-content.s3.ap-south-1.amazonaws.com/scene-compiled/...", "fileSize": 123456 }
```

If the scene has no graphic elements (only ws-video/ws-audio), you may skip step 1 and pass `graphicsMp4Url: null` to step 2.

### Lambda config

| Setting | Value |
|---------|-------|
| Memory | 3008 MB |
| Timeout | 300 s |
| Ephemeral storage | 4096 MB |
| Runtime | Node.js 20 |
| FFmpeg layer | `arn:aws:lambda:ap-south-1:175033217214:layer:ffmpeg:1` |

### Environment variables

| Variable | Description |
|----------|-------------|
| `OUTPUT_BUCKET` | S3 bucket for compiled graphics MP4 |
| `OUTPUT_PREFIX` | S3 key prefix (default: `scene-compiled/`) |
| `FFMPEG_PATH` | Override FFmpeg binary path (optional) |

---

## Step 2 — `witySceneCompose`

Composites **everything** — ws-video clips, ws-audio tracks, and the graphics overlay — into the final MP4 using FFmpeg `filter_complex`.

**Package:** [`@wity/scene-compose`](/packages/scene-compose)

**Lambda:** `witySceneCompose`

### Invocation

```json
{
  "sceneXml":       "<wity-scene>...</wity-scene>",
  "graphicsMp4Url": "https://wity-user-generated-content.s3.ap-south-1.amazonaws.com/scene-compiled/...",
  "fps":            30,
  "sceneWidth":     1920,
  "sceneHeight":    1080
}
```

`graphicsMp4Url` is optional. `fps`/`sceneWidth`/`sceneHeight` default to `30` / `1280` / `720`.

### Response

```json
{ "url": "https://wity-user-generated-content.s3.ap-south-1.amazonaws.com/scene-composed/...", "fileSize": 9876543 }
```

### Lambda config

| Setting | Value |
|---------|-------|
| Memory | 2048 MB |
| Timeout | 300 s |
| Ephemeral storage | 4096 MB |
| Runtime | Node.js 20 |
| FFmpeg layer | `arn:aws:lambda:ap-south-1:175033217214:layer:ffmpeg:1` |

### Environment variables

| Variable | Description |
|----------|-------------|
| `OUTPUT_BUCKET` | S3 bucket for composed MP4 output |
| `OUTPUT_PREFIX` | S3 key prefix (default: `scene-composed/`) |
| `FFMPEG_PATH` | Override FFmpeg binary path (optional) |

---

## Caller orchestration (pseudo-code)

```js
// Step 1 — graphics
const { url: graphicsMp4Url } = await invokeLambda('witySceneToVideo', {
  sceneXml,
  fontManifest: {},
  fps: 30,
});

// Step 2 — full composite
const { url: finalMp4Url } = await invokeLambda('witySceneCompose', {
  sceneXml,
  graphicsMp4Url,   // null if scene has no graphic elements
  fps:         30,
  sceneWidth:  1920,
  sceneHeight: 1080,
});

// finalMp4Url is the delivery URL
```

Both Lambda invocations receive the **same `sceneXml`**. Step 2 re-parses it to extract ws-video and ws-audio — it does not depend on the rendered frame output of step 1, only the URL.

---

## Graphics-only scenes

If a scene contains no `ws-video` or `ws-audio` — for example, a lower-third overlay or a slideshow of images with no audio — you can stop at step 1 and use the graphics MP4 directly, or skip to step 2 with `graphicsMp4Url: null` to get a plain black-canvas video with audio.

| Scene content | Step 1 needed? | Step 2 needed? |
|---|---|---|
| ws-rect / ws-text / ws-image only | Yes | No |
| ws-video / ws-audio only | No | Yes (pass `graphicsMp4Url: null`) |
| Mixed (graphics + video/audio) | Yes | Yes |

---

## Why two separate Lambdas

- **Different bottlenecks.** Step 1 is CPU-bound (canvas frame rendering). Step 2 is I/O-bound (downloading media) then CPU-bound (FFmpeg mux). Separate functions allow independent tuning.
- **Memory ceiling.** `witySceneToVideo` is already at the Lambda memory ceiling (3008 MB). Adding multi-file download + filter_complex compositing to the same function would exceed both memory and timeout limits for long scenes.
- **Independent scaling.** Short graphic-only renders don't incur the cost of a compositing Lambda. Long multi-clip scenes can run step 2 with more timeout headroom.
