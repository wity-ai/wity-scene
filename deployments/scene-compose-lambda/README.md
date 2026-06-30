# scene-compose-lambda

AWS Lambda deployment for `@wity/scene-compose` -- the full compositor stage of the wity-scene rendering pipeline.

**Function name:** `witySceneCompose`

## What it does

Composites `ws-video` clips, `ws-audio` tracks, and an optional graphics overlay MP4 into a single output MP4 using FFmpeg `filter_complex`. Downloads all media in parallel, builds the filter graph, runs FFmpeg, and streams the result to S3.

## Pipeline position

This is an **internal downstream Lambda**. Do not invoke directly -- call `witySceneRender` (the gateway), which routes here automatically when the scene contains `ws-video` or `ws-audio` elements.

```
witySceneRender (gateway)
    |
    +--> witySceneToVideo (if scene has graphics)
    |         |
    |         v
    |    graphicsMp4Url (S3)
    |         |
    +--> witySceneCompose  <-- this Lambda
              |
              v
         final MP4 (S3)
```

When the scene has no graphic elements, `graphicsMp4Url` is `null` and this Lambda composites video/audio only.

## Input

```json
{
  "sceneXml":       "<wity-scene>...</wity-scene>",
  "graphicsMp4Url": "https://...",
  "fps":            30,
  "sceneWidth":     1920,
  "sceneHeight":    1080
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sceneXml` | string | required | Raw `<wity-scene>` XML (same document used in step 1) |
| `graphicsMp4Url` | `string \| null` | `null` | Graphics overlay MP4 URL from `witySceneToVideo` |
| `fps` | number | `30` | Output frame rate |
| `sceneWidth` | number | `1280` | Canvas width px |
| `sceneHeight` | number | `720` | Canvas height px |

## Output

```json
{ "url": "https://...", "fileSize": 1234567 }
```

## Lambda config

| Setting | Value |
|---------|-------|
| Memory | 2048 MB |
| Timeout | 300 s |
| Ephemeral storage | 4096 MB |
| Runtime | Node.js 20 |
| Architecture | x86_64 |
| FFmpeg layer | `arn:aws:lambda:ap-south-1:175033217214:layer:ffmpeg:1` |

## Environment variables

| Variable | Description |
|----------|-------------|
| `OUTPUT_BUCKET` | S3 bucket for composed video output |
| `OUTPUT_PREFIX` | S3 key prefix (default: `scene-composed/`) |
| `FFMPEG_PATH` | Override FFmpeg binary path (optional) |

## Package

Wraps [`@wity/scene-compose`](../../packages/scene-compose) -- the `compose()` function. See that package for compositing internals.
