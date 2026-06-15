---
layout: home

hero:
  name: wity-scene
  tagline: Headless, isomorphic XML scene-graph for spatial overlays and compositing. Zero dependencies. Pure determinism.
  actions:
    - theme: brand
      text: Schema v1.0
      link: /guide/schema
    - theme: alt
      text: API Reference
      link: /packages/scene-core

features:
  - title: Deterministic
    details: f(scene, t) → ComputedFrame. Given a scene document and a time value, the output is always identical. No global state, no side effects.
  - title: Isomorphic
    details: Runs identically in the browser (DOMParser) and Node.js (@xmldom/xmldom). Author in the UI, compile on the server, play anywhere.
  - title: XML-native
    details: Scenes are authored in a clean, human-readable XML format. Easy to version-control, diff, generate programmatically, or hand-edit.
  - title: Zero dependencies
    details: scene-core has no runtime dependencies. The XML parser is the platform's own DOMParser — no bundled parsers, no surprises.
---

# wity-scene

A spatial scene-graph format for rendering layered visual overlays — title cards, film credits, lower thirds, motion graphics — into any rendering target.

> For AI coding agents:
> [llms.txt](/stack/scene-graph/llms.txt) ·
> [llms-full.txt](/stack/scene-graph/llms-full.txt) ·
> [llms-api.txt](/stack/scene-graph/llms-api.txt)

## Packages

| Package | Purpose |
|---|---|
| [`@wity/scene-core`](/packages/scene-core) | Parse, evaluate, serialize, validate — the full headless engine |
| [`@wity/scene`](/packages/scene) | Convenience re-export |

## Quick start

```js
import { parse, evaluate } from '@wity/scene-core';

const xml = `
<wity-scene version="1.0" width="1920" height="1080" dur="6.0">
  <ws-layer id="overlay" z="10">
    <ws-text x="50%" y="40%" anchor="center"
             font-size="5%" color="#ffffff"
             animate-in="fade-up" animate-dur="0.6">
      Opening Night
    </ws-text>
  </ws-layer>
</wity-scene>`;

const scene = parse(xml);
const frame = evaluate(scene, 1.0); // t = 1 second

for (const el of frame.elements) {
  if (el.visible) {
    console.log(el.tag, el.x, el.y, el.opacity, el.content);
  }
}
```
