# @wity/scene-player

Headless composition player. Drives `evaluate(scene, t)` at playback rate via RAF. Presentation-agnostic — wire any renderer to the `'frame'` event.

## Install

```bash
npm install @wity/scene-player
```

---

## Quick start

```js
import { HeadlessPlayer } from '@wity/scene-player';

const player = new HeadlessPlayer();

player.loadXml(`
  <wity-scene version="1.0" width="1920" height="1080" dur="6.0">
    <ws-layer id="title" z="10">
      <ws-text x="50%" y="40%" anchor="center" animate-in="fade-up" animate-dur="0.6">
        Opening Night
      </ws-text>
    </ws-layer>
  </wity-scene>
`);

// Wire your renderer — Canvas 2D, WebGL, HTML/CSS, whatever
player.on('frame', ({ frame }) => {
  for (const el of frame.elements) {
    if (el.visible) renderElement(el);
  }
});

player.play();
```

---

## Design

```
HeadlessPlayer
  ├── SceneStore       — mutable scene document
  ├── TimelineState    — playhead, RAF loop
  └── evaluate()       — f(scene, t) → ComputedFrame
```

`HeadlessPlayer` is a thin coordinator. On each RAF tick, `TimelineState` advances `currentTime` and emits `'time:changed'`. The player calls `evaluate(scene, t)` and re-emits the result as `'frame'`. Your renderer subscribes to `'frame'` and draws — nothing else.

A **presentation skin** (`CompositionPlayer`, a Canvas renderer, a WebGL renderer) never needs to know about the scene document or playback timing. It only needs:

```js
player.on('frame', ({ frame, t }) => { /* draw */ });
player.on('playback:ended', () => { /* show replay button */ });
```

---

## Mutation at runtime

Call any mutation method while the player is loaded. The next frame automatically reflects it — no reload, no flicker:

```js
// A generated video URL arrives from the backend
player.updateElement(elementId, { src: videoUrl });

// Move a layer in time
player.updateLayer(layerId, { begin: 2.0, dur: 4.0 });

// Add a new overlay layer
const layerId = player.addLayer({ label: 'Lower Third', z: 20 });
player.addElement(layerId, {
  tag: 'ws-text', content: 'Now Live',
  x: '50%', y: '10%', anchor: 'center',
  animate-in: 'fade', animate-dur: 0.4,
});

// Hot-swap the whole scene (e.g. live edit from editor)
player.replaceXml(newXml);  // retains play/pause state

// Persist any mutations back
const xml = player.getXml();
```

---

## Events

| Event | Payload | When |
|---|---|---|
| `'frame'` | `{ frame: ComputedFrame, t }` | Every tick + after each mutation + after seek |
| `'playback:started'` | `{ t }` | `play()` called |
| `'playback:paused'` | `{ t }` | `pause()` called |
| `'playback:stopped'` | `{}` | `stop()` called |
| `'playback:ended'` | `{ t }` | Playhead reached `duration` |
| `'time:changed'` | `{ t }` | Every tick + after seek |
| `'scene:loaded'` | `{ scene }` | `loadXml()` / `loadScene()` / `replaceXml()` |
| `'scene:mutated'` | `{ scene }` | Any mutation method |

---

## API

### Loading

```js
player.loadXml(xml)          // parse + load from XML string
player.loadScene(scene)      // load from already-parsed WityScene object
player.replaceXml(xml)       // hot-swap scene; retains play/pause state
```

### Playback

```js
player.play()
player.pause()
player.stop()                // pause + seek to 0
player.seek(t)               // seek to seconds; emits 'frame' immediately
```

### State

```js
player.currentTime           // number (seconds)
player.duration              // number (seconds)
player.isPlaying             // boolean
player.isLoaded              // boolean
player.progress              // 0–1
```

### Mutation

```js
player.addLayer(data)            → layerId
player.updateLayer(id, patch)
player.removeLayer(id)
player.addElement(layerId, data)  → elementId
player.updateElement(id, patch)
player.removeElement(id)
```

### Serialization

```js
player.getXml()              // serialize current scene → XML string (after mutations)
```

### Advanced

```js
player.getStore()            // access raw SceneStore for history/snap/clipboard/selection
```

### Teardown

```js
player.destroy()             // stop playback, remove all listeners
```
