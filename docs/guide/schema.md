# Schema v1.0

## Root element

```xml
<wity-scene version="1.0" width="1920" height="1080" dur="8.0">
  ...
</wity-scene>
```

| Attribute | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `version` | string | yes      | Must be `"1.0"` |
| `width`   | number | yes      | Canvas width in pixels |
| `height`  | number | yes      | Canvas height in pixels |
| `dur`     | number | yes      | Total duration in seconds |

## Document children

The root `<wity-scene>` element accepts two types of direct children:

- `<ws-cast>` — optional; contains `<ws-character>` metadata entities
- `<ws-layer>` — one or more visual/audio composition layers

## Layers

```xml
<ws-layer id="title" z="10" opacity="1">
  ...
</ws-layer>
```

| Attribute | Type   | Default | Description |
|-----------|--------|---------|-------------|
| `id`      | string | —       | Unique layer identifier |
| `z`       | number | `0`     | Layer z-index (stacking order) |
| `opacity` | number | `1`     | Layer-level opacity (0–1), multiplied with element opacity |

## Common element attributes

Visual elements (`ws-text`, `ws-rect`, `ws-image`, `ws-video`) share all of these. `ws-audio` shares only the temporal subset (`id`, `begin`, `dur`).

| Attribute      | Type        | Default    | Description |
|----------------|-------------|------------|-------------|
| `id`           | string      | auto       | Unique element identifier |
| `x`            | unit        | `0`        | Horizontal position |
| `y`            | unit        | `0`        | Vertical position |
| `anchor`       | enum        | `top-left` | Origin point for x/y |
| `begin`        | number      | `0`        | Start time in seconds |
| `dur`          | number      | ∞          | Duration in seconds |
| `z`            | number      | `0`        | Z-index within layer |
| `opacity`      | number      | `1`        | Element opacity (0–1) |
| `animate-in`   | enum        | `none`     | Entrance animation |
| `animate-out`  | enum        | `none`     | Exit animation |
| `animate-dur`  | number      | `0.4`      | Anim duration in seconds |

### Anchor values

`top-left` · `top` · `top-right` · `left` · `center` · `right` · `bottom-left` · `bottom` · `bottom-right`

### Animation values

`none` · `fade` · `fade-up` · `fade-down` · `slide-left` · `slide-right`

### Unit values

| Form    | Example  | Resolves to |
|---------|----------|-------------|
| percent | `"50%"`  | 50% of canvas width or height |
| px      | `"120px"`| 120px |
| bare    | `120`    | 120px |

---

## `<ws-text>`

```xml
<ws-text
  x="50%" y="40%" anchor="center"
  font-size="5%" color="#ffffff" font-weight="bold"
  animate-in="fade-up" animate-dur="0.6">
  Opening Night
</ws-text>
```

| Attribute       | Type   | Default       |
|-----------------|--------|---------------|
| `font-size`     | unit   | `"3%"`        |
| `font-family`   | string | `"sans-serif"` |
| `font-weight`   | string | `"normal"`    |
| `color`         | string | `"#ffffff"`   |
| `text-align`    | enum   | `"center"`    |
| `line-height`   | number | `1.4`         |
| `max-width`     | unit   | none          |
| `letter-spacing`| unit   | `0`           |

Text content is the element's text node.

---

## `<ws-rect>`

```xml
<ws-rect x="0" y="0" width="100%" height="100%" fill="#000000" opacity="0.6" />
```

| Attribute      | Type   | Default         |
|----------------|--------|-----------------|
| `width`        | unit   | `"100%"`        |
| `height`       | unit   | `"100%"`        |
| `fill`         | string | `"transparent"` |
| `stroke`       | string | none            |
| `stroke-width` | number | `1`             |
| `rx`           | number | `0`             |

---

## `<ws-image>`

```xml
<ws-image src="https://..." width="100%" height="100%" fit="cover" begin="2" dur="4" />
```

| Attribute | Type   | Default   |
|-----------|--------|-----------|
| `src`     | string | required  |
| `width`   | unit   | `"100%"`  |
| `height`  | unit   | `"100%"`  |
| `fit`     | enum   | `"cover"` |

`fit` values: `cover` · `contain` · `fill` · `none`

---

## `<ws-video>`

A video clip element — positioned and temporally placed within a layer. Extends all common element attributes.

```xml
<ws-video
  src="https://cdn.example.com/clip.mp4"
  width="100%" height="100%" fit="cover"
  begin="0" dur="8"
  volume="0.8" trim-in="2.5" />
```

| Attribute  | Type    | Default   | Description |
|------------|---------|-----------|-------------|
| `src`      | string  | required  | Video file URL |
| `width`    | unit    | `"100%"`  | Display width |
| `height`   | unit    | `"100%"`  | Display height |
| `fit`      | enum    | `"cover"` | Object-fit: `cover` · `contain` · `fill` · `none` |
| `volume`   | number  | `1`       | Playback volume 0–1 |
| `trim-in`  | number  | `0`       | Start offset within the source file (seconds) |
| `trim-out` | number  | none      | End offset within the source file (seconds); omit = play to end |
| `muted`    | boolean | `false`   | Mute audio track |

---

## `<ws-audio>`

A temporal audio track element — lives inside a `ws-layer` but has no visual output and no spatial attributes.

```xml
<ws-audio
  src="https://cdn.example.com/music.mp3"
  begin="0" dur="30"
  volume="0.4" loop="false" />
```

| Attribute  | Type    | Default  | Description |
|------------|---------|----------|-------------|
| `id`       | string  | auto     | Unique element identifier |
| `begin`    | number  | `0`      | Start time in seconds |
| `dur`      | number  | ∞        | Duration in seconds |
| `src`      | string  | required | Audio file URL |
| `volume`   | number  | `1`      | Playback volume 0–1 |
| `loop`     | boolean | `false`  | Loop the audio |
| `trim-in`  | number  | `0`      | Start offset within the source file (seconds) |
| `trim-out` | number  | none     | End offset within the source file (seconds); omit = play to end |

---

## `<ws-cast>` and `<ws-character>`

The optional `<ws-cast>` section contains semantic character entities. These are **not rendered** — they travel with the scene document and are consumed by authoring tools, AI agents, players, and compilers.

```xml
<ws-cast>
  <ws-character id="char1" name="Sarah" role="Host"
                description="Energetic, warm presenter"
                avatar-url="https://cdn.example.com/sarah.jpg" />
  <ws-character id="char2" name="Alex" role="Narrator" />
</ws-cast>
```

| Attribute     | Type   | Required | Description |
|---------------|--------|----------|-------------|
| `id`          | string | yes      | Unique character identifier |
| `name`        | string | yes      | Display name |
| `role`        | string | no       | Role in the scene (e.g. "Host", "Narrator") |
| `description` | string | no       | Free-form notes or personality description |
| `avatar-url`  | string | no       | URL to avatar or reference image |

In the parsed `WityScene` object, characters are accessed as `scene.cast: WsCharacter[]`.

---

## Full example — product video scene

```xml
<?xml version="1.0" encoding="UTF-8"?>
<wity-scene version="1.0" width="1080" height="1920" dur="15.0">

  <!-- Cast metadata (non-rendered) -->
  <ws-cast>
    <ws-character id="char1" name="Maya" role="Host"
                  description="Upbeat product presenter" />
  </ws-cast>

  <!-- Background video -->
  <ws-layer id="video" z="0">
    <ws-video src="https://cdn.example.com/bg-clip.mp4"
              width="100%" height="100%" fit="cover"
              begin="0" dur="15" volume="0" />
  </ws-layer>

  <!-- Music bed -->
  <ws-layer id="audio" z="1">
    <ws-audio src="https://cdn.example.com/music.mp3"
              begin="0" dur="15" volume="0.35" />
  </ws-layer>

  <!-- Poster image — appears mid-scene -->
  <ws-layer id="poster" z="2">
    <ws-image src="https://cdn.example.com/product.jpg"
              x="50%" y="45%" anchor="center"
              width="80%" height="60%" fit="contain"
              begin="4" dur="6"
              animate-in="fade" animate-dur="0.5" />
  </ws-layer>

  <!-- Text overlays -->
  <ws-layer id="graphics" z="10">
    <ws-rect x="0" y="0" width="100%" height="100%"
             fill="#000000" opacity="0.4"
             begin="0" dur="3" animate-out="fade" animate-dur="0.5" />
    <ws-text x="50%" y="38%" anchor="center"
             font-size="7%" font-weight="bold" color="#ffffff"
             animate-in="fade-up" animate-dur="0.6">
      New Collection
    </ws-text>
    <ws-text x="50%" y="52%" anchor="center"
             font-size="3%" color="#cccccc"
             animate-in="fade" begin="0.4" animate-dur="0.5">
      Spring 2026
    </ws-text>
  </ws-layer>

</wity-scene>
```
