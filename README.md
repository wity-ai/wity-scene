# wity-scene

A headless, isomorphic XML scene-graph library for spatial overlays and compositing. Zero dependencies. Deterministic.

**[Full documentation → wity.ai/stack/scene-graph](https://www.wity.ai/stack/scene-graph/)**

---

## Overview

wity-scene defines a clean XML format for authoring spatial scene documents and a pure evaluation engine that resolves them to pixel-perfect render frames at any point in time:

```
f(scene, t) → ComputedFrame
```

The same document runs in the browser (authoring UI), on Node.js (video compilation backend), and in any player component — no platform-specific code anywhere.

| Package | Purpose | Environment |
|---|---|---|
| [`@wity/scene-core`](https://www.wity.ai/stack/scene-graph/packages/scene-core) | Parse · evaluate · serialize · validate | Browser + Node.js |
| [`@wity/scene-headless`](https://www.wity.ai/stack/scene-graph/packages/scene-headless) | Authoring state — selection, history, snap, timeline | Browser + Node.js |
| [`@wity/scene-player`](https://www.wity.ai/stack/scene-graph/packages/scene-player) | `HeadlessPlayer` — drives evaluate() at playback rate via RAF | Browser + Node.js |
| [`@wity/scene-to-video`](https://www.wity.ai/stack/scene-graph/packages/scene-to-video) | Graphics compiler — ws-rect/ws-text/ws-image → MP4 (node-canvas + FFmpeg) | Node.js / Lambda |
| [`@wity/scene-compose`](https://www.wity.ai/stack/scene-graph/packages/scene-compose) | Full compositor — ws-video + ws-audio + graphics overlay → final MP4 (FFmpeg filter_complex) | Node.js / Lambda |
| [`@wity/scene`](https://www.wity.ai/stack/scene-graph/packages/scene) | Convenience re-export of scene-core | Browser + Node.js |

## Quick start

```bash
npm install @wity/scene-core
# Node.js only:
npm install @xmldom/xmldom
```

```js
import { parse, evaluate } from '@wity/scene-core';

const scene = parse(`
  <wity-scene version="1.0" width="1920" height="1080" dur="6.0">
    <ws-layer id="title" z="10">
      <ws-text x="50%" y="40%" anchor="center"
               font-size="5%" color="#ffffff"
               animate-in="fade-up" animate-dur="0.6">
        Opening Night
      </ws-text>
    </ws-layer>
  </wity-scene>
`);

const frame = evaluate(scene, 1.0);

for (const el of frame.elements) {
  if (el.visible) console.log(el.tag, el.x, el.y, el.content);
}
```

## Design principles

- **Deterministic.** `evaluate(scene, t)` is a pure function — same input, same output, always. No playback state, no mutation.
- **Isomorphic.** Parses with native `DOMParser` in browser; `@xmldom/xmldom` in Node.js. No platform-specific code in scene-core.
- **XML-native.** Scenes are human-readable, diffable, and trivial to generate programmatically or author by hand.
- **Zero dependencies.** No bundled parsers. No framework coupling. The platform's own DOMParser is the only parser.
- **Rendering-agnostic.** `ComputedFrame` gives you resolved pixel coordinates and props. Wire it to HTML/CSS, Canvas 2D, SVG, or FFmpeg — your choice.

## Documentation

Full schema reference, API docs, and rendering examples:
**https://www.wity.ai/stack/scene-graph/**

For AI coding agents: [llms.txt](https://www.wity.ai/stack/scene-graph/llms.txt) · [llms-full.txt](https://www.wity.ai/stack/scene-graph/llms-full.txt) · [llms-api.txt](https://www.wity.ai/stack/scene-graph/llms-api.txt)

---

Built by [Wity AI](https://www.wity.ai)
