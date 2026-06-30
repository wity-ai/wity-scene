# scene-render-lambda

AWS Lambda deployment for the wity-scene rendering gateway.

**Function name:** `witySceneRender`

## What it does

Single **public entry point** for all scene rendering. Parses the scene XML, detects what element types are present, and routes to the appropriate downstream Lambdas. Callers send one request and receive one URL -- they never invoke downstream Lambdas directly.

## Pipeline position

```
caller --> witySceneRender  <-- this Lambda (gateway)
                |
                | parse + detect content
                |
                +-- hasGraphics? --> witySceneToVideo --> graphicsMp4Url
                |
                +-- hasMedia?    --> witySceneCompose(graphicsMp4Url) --> final URL
```

## Routing logic

| Scene content | Route |
|---|---|
| Graphics only (`ws-rect`/`ws-text`/`ws-image`) | `witySceneToVideo` --> done |
| Mixed (graphics + `ws-video`/`ws-audio`) | `witySceneToVideo` --> `witySceneCompose` |
| Media only (`ws-video`/`ws-audio`, no graphics) | `witySceneCompose` (`graphicsMp4Url: null`) |

## Input

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

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sceneXml` | string | required | Raw `<wity-scene>` XML |
| `outputFormat` | string | `"mp4"` | Output format (extensible via `PIPELINE_REGISTRY`) |
| `options.fps` | number | `30` | Frame rate |
| `options.sceneWidth` | number | `1280` | Canvas width px |
| `options.sceneHeight` | number | `720` | Canvas height px |
| `options.fontManifest` | `Record<string, string>` | `{}` | Font family to TTF URL |

## Output

```json
{
  "url": "https://...",
  "fileSize": 9876543,
  "pipeline": ["witySceneToVideo", "witySceneCompose"]
}
```

`pipeline` lists which downstream Lambdas were invoked (useful for observability and cost attribution).

## Lambda config

| Setting | Value |
|---------|-------|
| Memory | 512 MB |
| Timeout | 660 s (accommodates two sequential 300s downstream calls) |
| Ephemeral storage | 512 MB |
| Runtime | Node.js 20 |
| Architecture | x86_64 |
| No FFmpeg layer | This Lambda only parses and routes -- no media processing |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCENE_TO_VIDEO_FUNCTION` | `witySceneToVideo` | Downstream graphics compiler Lambda |
| `SCENE_COMPOSE_FUNCTION` | `witySceneCompose` | Downstream compositor Lambda |

IAM: execution role needs `lambda:InvokeFunction` on both downstream Lambdas.

## Extending with new output formats

Add a new format without touching any existing Lambda:

1. Deploy a specialized Lambda (e.g. `witySceneToPdf`)
2. Add an entry in `PIPELINE_REGISTRY` in `handler.js`
3. Add the corresponding env var (e.g. `SCENE_TO_PDF_FUNCTION`)
