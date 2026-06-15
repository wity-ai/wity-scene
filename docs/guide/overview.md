# Overview

wity-scene is a headless, isomorphic library for authoring and evaluating spatial scene-graph documents. It is designed to be the shared format layer between:

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
└── WsLayer[]       (z-ordered planes)
    └── WsElement[] (ws-text | ws-rect | ws-image)
```

Each element has:
- **Position**: `x`, `y`, `anchor`
- **Timing**: `begin`, `dur`
- **Appearance**: `opacity`, `z`
- **Animation**: `animate-in`, `animate-out`, `animate-dur`

## Rendering targets

wity-scene is rendering-target-agnostic. `evaluate()` returns resolved pixel coordinates and props. The renderer decides what to do with them:

| Target | How |
|---|---|
| HTML/CSS | Position `<div>` elements using `left`/`top`, apply CSS transforms for animation offsets |
| Canvas 2D | Use `fillText`, `fillRect`, `drawImage` at computed coordinates |
| SVG | Map elements to SVG primitives |
| FFmpeg / Node canvas | Rasterise frame-by-frame for video compilation |
