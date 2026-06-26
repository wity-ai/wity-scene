# @wity/scene-compose

Server-side full compositing pass. Blends `ws-video` clips, `ws-audio` tracks, and an optional graphics overlay MP4 into a single output using FFmpeg `filter_complex`. Node.js / Lambda only.

This is step 2 of the [two-step pipeline](/guide/deployment) — it takes the graphics MP4 produced by [`@wity/scene-to-video`](/packages/scene-to-video) and composites it on top of the video/audio content derived from the same scene document.

## Install

```bash
npm install @wity/scene-compose
# peer dep:
npm install @wity/scene-core
```

FFmpeg must be available in `PATH` (or set `FFMPEG_PATH` env var).

---

## `compose(sceneXml, graphicsMp4Url, options)`

```ts
compose(
  sceneXml:       string,
  graphicsMp4Url: string | null,
  options:        ComposeOptions
): Promise<ComposeResult>
```

| Argument          | Type             | Description |
|-------------------|------------------|-------------|
| `sceneXml`        | `string`         | Raw `<wity-scene>` XML — same document passed to `scene-to-video` |
| `graphicsMp4Url`  | `string \| null` | URL of the graphics overlay MP4 from `scene-to-video`. Pass `null` if the scene has no graphic elements. |
| `options`         | `ComposeOptions` | See below |

### ComposeOptions

| Option          | Type     | Default              | Description |
|-----------------|----------|----------------------|-------------|
| `outputBucket`  | `string` | `OUTPUT_BUCKET` env  | S3 bucket for the output file |
| `outputPrefix`  | `string` | `"scene-composed/"`  | S3 key prefix |
| `fps`           | `number` | `30`                 | Output frame rate |
| `sceneWidth`    | `number` | `1280`               | Canvas width px |
| `sceneHeight`   | `number` | `720`                | Canvas height px |

### ComposeResult

```ts
{ url: string, fileSize: number }
```

`url` is the public S3 URL of the finished MP4.

---

## What is composited

| Element type | Handled? |
|---|---|
| `ws-video` | Yes — each clip is scaled, positioned (x/y/width/height/fit), trimmed (trimIn), and overlaid at the correct scene time (begin/dur) |
| `ws-audio` | Yes — each track is delayed to begin time, volume-scaled, and mixed |
| `ws-video` embedded audio | Yes — extracted and mixed unless `muted: true` or `volume: 0` |
| `ws-rect` / `ws-text` / `ws-image` | Via `graphicsMp4Url` overlay (from `scene-to-video`) |

---

## Example

```js
import { compose } from '@wity/scene-compose';

const result = await compose(sceneXml, graphicsMp4Url, {
  outputBucket: 'my-s3-bucket',
  fps:          30,
  sceneWidth:   1920,
  sceneHeight:  1080,
});

console.log(result.url);       // https://my-s3-bucket.s3.ap-south-1.amazonaws.com/scene-composed/...
console.log(result.fileSize);  // bytes
```

---

## FFmpeg pipeline internals

The compositing pass builds a `filter_complex` with the following input layout:

```
[0]   — lavfi color=black base canvas (scene resolution, scene duration)
[1…V] — ws-video clip files (one per element, pre-seeked to trimIn)
[V+1] — graphics overlay MP4 (if provided)
[V+2…] — ws-audio track files (one per element)
```

**Video path:** base → scale+fit each clip → `setpts` to shift to begin time → `overlay=x:y:enable='between(t,begin,end)'` → overlay graphics on top.

**Audio path:** each track/clip audio is resampled to 48 kHz, delayed via `adelay` to begin time, volume-scaled, then merged with `amix=normalize=0:dropout_transition=0`.

**Output:** single `libx264` / `aac` MP4, uploaded to S3 via streaming (no full-file buffer in memory).

---

## Lambda deployment

The `witySceneCompose` Lambda wraps this package. It accepts:

```json
{
  "sceneXml":       "<wity-scene>...</wity-scene>",
  "graphicsMp4Url": "https://...",
  "fps":            30,
  "sceneWidth":     1920,
  "sceneHeight":    1080
}
```

And returns:

```json
{ "url": "https://...", "fileSize": 1234567 }
```

`graphicsMp4Url` is optional — omit it when the scene contains no graphic elements.

See [`deployments/scene-compose-lambda/`](https://github.com/wity-ai/wity-scene/tree/master/deployments/scene-compose-lambda) for the handler and config.

| Config | Value |
|--------|-------|
| Function name | `witySceneCompose` |
| Memory | 2048 MB |
| Timeout | 300 s |
| Ephemeral storage | 4096 MB |
| Runtime | Node.js 20 |

---

## Two-step pipeline

```
sceneXml
  │
  ├──▶  witySceneToVideo  ──▶  graphicsMp4Url
  │
  └──▶  witySceneCompose  ◀──  graphicsMp4Url
              │
              ▼
        final composited MP4
```

Both Lambda invocations receive the same `sceneXml`. The caller (your backend) orchestrates the two calls and passes the graphics URL from step 1 into step 2.

See the [Deployment guide](/guide/deployment) for the full architecture.
