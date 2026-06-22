# @wity/scene-core

The full headless engine. Parse, evaluate, serialize, and validate wity-scene documents.

## Install

```bash
npm install @wity/scene-core
```

For Node.js environments, also install the optional XML peer:

```bash
npm install @xmldom/xmldom
```

---

## `parse(xml)`

Parse a wity-scene XML string into a `WityScene` object.

```ts
parse(xml: string): WityScene
```

Throws if the XML is malformed or the root element is not `<wity-scene>`.

```js
import { parse } from '@wity/scene-core';
const scene = parse(xmlString);
// → { version: '1.0', width: 1920, height: 1080, dur: 8, layers: [...], cast: [...] }
```

---

## `evaluate(scene, t)`

Evaluate a scene at time `t` (seconds), returning the full render frame.

```ts
evaluate(scene: WityScene, t: number): ComputedFrame
```

`t` is clamped to `[0, scene.dur]`. Pure function — no mutation.

```js
import { evaluate } from '@wity/scene-core';
const frame = evaluate(scene, 1.5);
// → { t: 1.5, width: 1920, height: 1080, elements: [...] }
```

Note: `ws-audio` elements appear in `frame.elements` with `visible` set correctly for their temporal window but produce no pixel output. `ws-character` entities are not in `elements` — access them via `scene.cast`.

---

## `serialize(scene)`

Serialize a `WityScene` back to a canonical XML string. Round-trips cleanly with `parse()`.

```ts
serialize(scene: WityScene): string
```

```js
import { serialize } from '@wity/scene-core';
const xml = serialize(scene);
// → '<?xml version="1.0" encoding="UTF-8"?>\n<wity-scene ...'
```

The `<ws-cast>` section is serialized before layers if `scene.cast` is non-empty.

---

## `validate(scene)`

Validate a `WityScene` object without throwing.

```ts
validate(scene: WityScene): { valid: boolean, errors: string[], warnings: string[] }
```

```js
import { validate } from '@wity/scene-core';
const result = validate(scene);
if (!result.valid) {
  console.error(result.errors);
}
```

---

## `resolveUnit(value, containerSize)`

Resolve a unit value string to pixels.

```ts
resolveUnit(value: string | number, containerSize: number): number
```

```js
import { resolveUnit } from '@wity/scene-core';
resolveUnit('50%', 1920)  // → 960
resolveUnit('120px', 0)   // → 120
resolveUnit(80, 0)        // → 80
```

---

## Types

All JSDoc types are in `schema/types.js` and re-exported from the package root.

### `WityScene`

```js
{
  version:  string,       // "1.0"
  width:    number,       // canvas width px
  height:   number,       // canvas height px
  dur:      number,       // total duration seconds
  layers:   WsLayer[],
  cast:     WsCharacter[], // semantic entities (non-rendered)
}
```

### `WsLayer`

```js
{
  id:       string,
  z:        number,
  opacity:  number,   // 0–1
  elements: WsElement[],
}
```

### `WsElement`

```
WsText | WsRect | WsImage | WsVideo | WsAudio
```

All visual elements (`WsText`, `WsRect`, `WsImage`, `WsVideo`) share `WsElementBase`:

```js
{
  id, x, y, anchor, begin, dur, z, opacity, animateIn, animateOut, animateDur
}
```

`WsAudio` has a minimal base: `{ id, begin, dur }` — no spatial attributes.

### `WsVideo`

```js
WsElementBase & {
  tag:     'ws-video',
  src:     string,
  width:   string | number,
  height:  string | number,
  fit:     'cover' | 'contain' | 'fill' | 'none',
  volume:  number,         // 0–1
  trimIn:  number,         // seconds into source file
  trimOut: number | null,  // seconds into source file; null = no trim
  muted:   boolean,
}
```

### `WsAudio`

```js
{
  tag:     'ws-audio',
  id:      string,
  begin:   number,
  dur:     number,
  src:     string,
  volume:  number,         // 0–1
  loop:    boolean,
  trimIn:  number,
  trimOut: number | null,
}
```

### `WsCharacter`

```js
{
  id:           string,
  name:         string,
  role?:        string,
  description?: string,
  avatarUrl?:   string,
}
```

### `ComputedFrame`

```js
{
  t:        number,             // time this frame was computed for
  width:    number,
  height:   number,
  elements: ComputedElement[],  // sorted by z ascending
}
```

### `ComputedElement`

```js
{
  id:      string,
  tag:     'ws-text' | 'ws-rect' | 'ws-image' | 'ws-video' | 'ws-audio',
  x:       number,    // pixels, anchor-adjusted + animation offset (visual elements)
  y:       number,
  opacity: number,    // element × layer × animation opacity
  z:       number,    // layer.z * 1000 + el.z
  visible: boolean,   // false outside [begin, begin+dur]
  props:   object,    // tag-specific resolved props
  content: string | null,  // text content (ws-text only)
}
```
