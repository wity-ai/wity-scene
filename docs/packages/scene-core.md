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
// → { version: '1.0', width: 1920, height: 1080, dur: 8, layers: [...] }
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
  version: string,    // "1.0"
  width:   number,    // canvas width px
  height:  number,    // canvas height px
  dur:     number,    // total duration seconds
  layers:  WsLayer[],
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
  tag:     'ws-text' | 'ws-rect' | 'ws-image',
  x:       number,    // pixels, anchor-adjusted + animation offset
  y:       number,
  opacity: number,    // element × layer × animation opacity
  z:       number,    // layer.z * 1000 + el.z
  visible: boolean,   // false outside [begin, begin+dur]
  props:   object,    // tag-specific resolved props
  content: string | null,  // text content (ws-text only)
}
```
