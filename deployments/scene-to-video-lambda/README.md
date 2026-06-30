# scene-to-video-lambda

AWS Lambda deployment for `@wity/scene-to-video` -- the graphics compiler stage of the wity-scene rendering pipeline.

**Function name:** `witySceneToVideo`

## What it does

Renders graphic elements (`ws-rect`, `ws-text`, `ws-image`) from a `<wity-scene>` XML document into a silent MP4. `ws-video` and `ws-audio` elements are ignored -- they are handled by `witySceneCompose` in the next pipeline stage.

## Pipeline position

This is an **internal downstream Lambda**. Do not invoke directly -- call `witySceneRender` (the gateway), which routes here automatically when the scene contains graphic elements.

```
witySceneRender (gateway)
    |
    +--> witySceneToVideo  <-- this Lambda
    |         |
    |         v
    |    graphicsMp4Url (S3)
    |         |
    +--> witySceneCompose (if scene also has ws-video/ws-audio)
              |
              v
         final MP4 (S3)
```

## Input

```json
{
  "sceneXml":      "<wity-scene>...</wity-scene>",
  "fontManifest":  { "Inter": "https://cdn.example.com/Inter.ttf" },
  "fps":           30
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sceneXml` | string | required | Raw `<wity-scene>` XML |
| `fontManifest` | `Record<string, string>` | `{}` | Font family name to TTF URL mapping |
| `fps` | number | `30` | Output frame rate |

## Output

```json
{ "url": "https://...", "fileSize": 1234567 }
```

## Lambda config

| Setting | Value |
|---------|-------|
| Memory | 3008 MB |
| Timeout | 300 s |
| Ephemeral storage | 4096 MB |
| Runtime | Node.js 20 |
| Architecture | x86_64 |
| FFmpeg layer | `arn:aws:lambda:ap-south-1:175033217214:layer:ffmpeg:1` |

## Environment variables

| Variable | Description |
|----------|-------------|
| `OUTPUT_BUCKET` | S3 bucket for compiled video output |
| `OUTPUT_PREFIX` | S3 key prefix (default: `scene-compiled/`) |
| `FFMPEG_PATH` | Override FFmpeg binary path (optional) |

## Deploy

```bash
./deployments/scene-to-video-lambda/deploy.sh
# or from repo root:
npm run deploy:lambda
```

Requires: `aws-cli` (profile: `lambda-devops`), `jq`, `node`, `npm`.

## Package

Wraps [`@wity/scene-to-video`](../../packages/scene-to-video) -- the `compile()` function. See that package for rendering internals.
