# wity-scene-to-video

Renders a `<wity-scene>` XML document to an MP4 video.

Part of the [wity-scene](https://github.com/wity-ai/wity-scene) open-source scene graph library.

---

## Input

| Field | Type | Default | Description |
|---|---|---|---|
| `scene_xml` | string | required | Serialized `<wity-scene>` XML document |
| `font_manifest` | string | `"{}"` | JSON string of `{ "FontFamily": "https://url-to-font.ttf" }` |
| `fps` | number | `30` | Output frame rate |

## Output

A base64-encoded MP4 video: `data:video/mp4;base64,...`

---

## Example

```json
{
  "scene_xml": "<wity-scene version=\"1.0\" width=\"1920\" height=\"1080\" dur=\"3.0\"><ws-layer id=\"bg\" z=\"0\"><ws-rect id=\"r\" x=\"0\" y=\"0\" width=\"1920\" height=\"1080\" fill=\"#1a1a2e\" begin=\"0\" dur=\"3\"/></ws-layer><ws-layer id=\"txt\" z=\"10\"><ws-text id=\"t\" x=\"50%\" y=\"50%\" anchor=\"center\" font-size=\"72\" color=\"#ffffff\" text-align=\"center\" animate-in=\"fade-up\" animate-dur=\"0.5\" begin=\"0\" dur=\"3\">Hello World</ws-text></ws-layer></wity-scene>",
  "fps": 30
}
```

---

## Scene format

A `<wity-scene>` document describes a composited video as a set of layers and elements with timing, position, and animation properties.

**Supported elements**

- `<ws-rect>` — filled/stroked rectangle with optional corner radius
- `<ws-image>` — image from a public URL, with `fit` modes: `cover`, `contain`, `fill`, `none`
- `<ws-text>` — text with font, size, color, alignment, letter spacing, multi-line support

**Animations**

`animate-in` / `animate-out` values: `fade`, `fade-up`, `fade-down`, `fade-left`, `fade-right`, `scale-up`, `none`

**Example document**

```xml
<wity-scene version="1.0" width="1920" height="1080" dur="5.0">

  <ws-layer id="background" z="0">
    <ws-rect id="bg" x="0" y="0" width="1920" height="1080"
             fill="#0f0f1a" begin="0" dur="5"/>
  </ws-layer>

  <ws-layer id="media" z="5">
    <ws-image id="hero" x="0" y="0" width="1920" height="1080"
              src="https://example.com/image.jpg"
              fit="cover" begin="0" dur="5"/>
  </ws-layer>

  <ws-layer id="overlay" z="10">
    <ws-text id="title"
             x="50%" y="45%"
             anchor="center"
             font-size="96"
             font-family="Inter"
             font-weight="bold"
             color="#ffffff"
             text-align="center"
             animate-in="fade-up"
             animate-dur="0.6"
             begin="0.3" dur="4.7">
      Your Title Here
    </ws-text>
  </ws-layer>

</wity-scene>
```

---

## Custom fonts

Pass a `font_manifest` to load custom fonts by URL:

```json
{
  "font_manifest": "{\"Inter\": \"https://fonts.gstatic.com/s/inter/v13/Inter-Regular.ttf\"}"
}
```

---

## Rendering

- **Canvas**: [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) (Skia)
- **Video encoding**: FFmpeg — H.264, yuv420p, crf 18
