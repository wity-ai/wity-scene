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

All elements share these attributes:

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
<ws-image src="https://..." width="100%" height="100%" fit="cover" />
```

| Attribute | Type   | Default   |
|-----------|--------|-----------|
| `src`     | string | required  |
| `width`   | unit   | `"100%"`  |
| `height`  | unit   | `"100%"`  |
| `fit`     | enum   | `"cover"` |

`fit` values: `cover` · `contain` · `fill` · `none`

---

## Full example — film credits overlay

```xml
<?xml version="1.0" encoding="UTF-8"?>
<wity-scene version="1.0" width="1920" height="1080" dur="8.0">

  <!-- Dark scrim -->
  <ws-layer id="scrim" z="0">
    <ws-rect x="0" y="0" width="100%" height="100%"
             fill="#000000" opacity="0.65" />
  </ws-layer>

  <!-- Title card -->
  <ws-layer id="title" z="10">
    <ws-text x="50%" y="38%" anchor="center"
             font-size="6%" font-weight="bold" color="#ffffff"
             animate-in="fade-up" animate-dur="0.7">
      Nocturne
    </ws-text>
    <ws-text x="50%" y="50%" anchor="center"
             font-size="2.5%" color="#cccccc" letter-spacing="0.2em"
             animate-in="fade" begin="0.4" animate-dur="0.6">
      A film by Apratim
    </ws-text>
  </ws-layer>

</wity-scene>
```
