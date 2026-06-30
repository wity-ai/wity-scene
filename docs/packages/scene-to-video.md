# @wity/scene-to-video

Server-side graphics compiler. Renders the **graphic layers** of a wity-scene document — `ws-rect`, `ws-text`, `ws-image` — to an MP4 using node-canvas and FFmpeg. Node.js / Lambda only, not browser-compatible.

> **Scope:** This package renders graphics only. `ws-video` and `ws-audio` elements are not processed — they are handled by the separate [`@wity/scene-compose`](/packages/scene-compose) compositing pass.

## Install

```bash
npm install @wity/scene-to-video
# peer deps:
npm install @wity/scene-core @xmldom/xmldom
```

FFmpeg must be available in `PATH` (or set `FFMPEG_PATH` env var). In Lambda, use the FFmpeg layer.

---

## `compile(sceneXml, fontManifest, options)`

Render graphic elements to an MP4 file on disk.

```ts
compile(
  sceneXml:     string,
  fontManifest: Record<string, string>,
  options:      { fps?: number }
): Promise<{ videoPath: string, cleanup: () => Promise<void> }>
```

| Argument       | Type                        | Description |
|----------------|-----------------------------|-------------|
| `sceneXml`     | `string`                    | Raw `<wity-scene>` XML |
| `fontManifest` | `Record<string, string>`    | Map of font family name → URL. Fonts are fetched and registered before rendering. Pass `{}` if no custom fonts. |
| `options.fps`  | `number` (default `30`)     | Output frame rate |

**Returns** a promise resolving to:

| Field       | Description |
|-------------|-------------|
| `videoPath` | Absolute path of the rendered MP4 in `/tmp` |
| `cleanup`   | Call after you're done with the file to remove it from disk |

**Throws** if the XML is malformed, FFmpeg is not found, or rendering fails.

```js
import { compile } from '@wity/scene-to-video';

const { videoPath, cleanup } = await compile(sceneXml, {}, { fps: 30 });

// use videoPath — upload to S3, pass to scene-compose, etc.

await cleanup();
```

---

## What is rendered

| Element type | Rendered? |
|---|---|
| `ws-rect`  | Yes — filled rectangles with optional stroke and border-radius |
| `ws-text`  | Yes — text with font, color, animation |
| `ws-image` | Yes — image with fit modes (cover/contain/fill/none) |
| `ws-video` | **No** — ignored; handled by `@wity/scene-compose` |
| `ws-audio` | **No** — ignored; handled by `@wity/scene-compose` |

The output is a **silent MP4** containing only the graphic overlay track. It is designed to be passed as the `graphicsMp4Url` argument to `@wity/scene-compose`, which overlays it on top of the video/audio composition.

---

## Font manifest

Fonts are resolved by family name from the manifest. If a font used in the scene is not in the manifest, the renderer falls back to the system sans-serif.

```js
const fontManifest = {
  'Inter':         'https://cdn.example.com/fonts/Inter.ttf',
  'Playfair Display': 'https://cdn.example.com/fonts/PlayfairDisplay-Bold.ttf',
};

const { videoPath, cleanup } = await compile(sceneXml, fontManifest);
```

---

## Lambda deployment

The `witySceneToVideo` Lambda wraps this package. It accepts:

```json
{ "sceneXml": "<wity-scene>...</wity-scene>", "fontManifest": {}, "fps": 30 }
```

And returns:

```json
{ "url": "https://...", "fileSize": 1234567 }
```

See [`deployments/scene-to-video-lambda/`](https://github.com/wity-ai/wity-scene/tree/master/deployments/scene-to-video-lambda) for the handler and config.

| Config | Value |
|--------|-------|
| Function name | `witySceneToVideo` |
| Memory | 3008 MB |
| Timeout | 300 s |
| Ephemeral storage | 4096 MB |
| Runtime | Node.js 20 |

---

## Two-step pipeline

`scene-to-video` is step 1 of a two-step server-side pipeline:

```
sceneXml
  │
  ▼
witySceneToVideo  ──→  graphicsMp4Url   (graphics overlay only)
  │
  ▼
witySceneCompose  ←──  graphicsMp4Url + sceneXml
  │
  ▼
final composited MP4
```

See [`@wity/scene-compose`](/packages/scene-compose) for the full compositing pass.
