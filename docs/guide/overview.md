# Overview

wity-scene is a headless, isomorphic library for authoring and evaluating spatial-temporal scene-graph documents. It is designed to be the shared format layer between:

- **Authoring apps** — a drag-and-drop scene editor (browser)
- **Compilation backends** — a Node.js renderer that composites scene output onto video frames
- **Player components** — a React/Canvas/WebGL renderer that replays scenes in real-time

## Core model

A scene is a **pure function of time**:

```
f(scene: WityScene, t: number) → ComputedFrame
```

- `scene` is a parsed XML document (immutable)
- `t` is a time in seconds (0 ≤ t ≤ scene.dur)
- `ComputedFrame` is the complete render state at that instant

No interpolation state, no mutable timers, no side effects.

## Document structure

```
WityScene
├── WsCharacter[]   (ws-cast — semantic metadata entities, non-rendered)
└── WsLayer[]       (z-ordered planes)
    └── WsElement[] (ws-text | ws-rect | ws-image | ws-video | ws-audio)
```

Each visual element (`ws-text`, `ws-rect`, `ws-image`, `ws-video`) has:
- **Position**: `x`, `y`, `anchor`
- **Timing**: `begin`, `dur`
- **Appearance**: `opacity`, `z`
- **Animation**: `animate-in`, `animate-out`, `animate-dur`

`ws-audio` is temporal-only (no spatial position). `ws-character` entities live outside layers in a `<ws-cast>` section and carry semantic metadata consumed by authoring tools, AI agents, players, and compilers.

## Rendering targets

wity-scene is rendering-target-agnostic. `evaluate()` returns resolved pixel coordinates and props for visual elements. The renderer decides what to do with them:

| Target | How |
|---|---|
| HTML/CSS | Position `<div>` elements using `left`/`top`, apply CSS transforms for animation offsets |
| Canvas 2D | Use `fillText`, `fillRect`, `drawImage` at computed coordinates |
| SVG | Map elements to SVG primitives |
| FFmpeg / Node canvas | Rasterise frame-by-frame for video compilation |
| Video/audio players | Decode `ws-video` / `ws-audio` sources at computed begin/dur/trim offsets |
