# @wity/scene-player

Headless composition player for wity-scene. Drives `evaluate(scene, t)` at playback rate via RAF. Presentation-agnostic — wire any renderer to the `'frame'` event.

**[Full documentation → wity.ai/stack/scene-graph](https://www.wity.ai/stack/scene-graph/)**

---

```bash
npm install @wity/scene-player
```

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
player.on('frame', ({ frame, t }) => {
  for (const el of frame.elements) {
    if (el.visible) renderElement(el);
  }
});

player.play();
```

## Mutation at runtime

Mutations take effect on the next frame automatically — no reload required:

```js
// e.g. a generated video URL arrives from the backend
player.updateElement(elementId, { src: videoUrl });

// Reorder a layer in time
player.updateLayer(layerId, { begin: 2.0, dur: 4.0 });

// Add a new overlay
const layerId = player.addLayer({ label: 'Overlay', z: 20 });
player.addElement(layerId, {
  tag: 'ws-text', content: 'Now Live', x: '50%', y: '10%', anchor: 'center',
});

// Persist mutations
const xml = player.getXml();
```

## Events

| Event | Payload |
|---|---|
| `'frame'` | `{ frame: ComputedFrame, t: number }` |
| `'playback:started'` | `{ t: number }` |
| `'playback:paused'` | `{ t: number }` |
| `'playback:stopped'` | `{}` |
| `'playback:ended'` | `{ t: number }` |
| `'time:changed'` | `{ t: number }` |
| `'scene:loaded'` | `{ scene: WityScene }` |
| `'scene:mutated'` | `{ scene: WityScene }` |

## API

```js
// Loading
player.loadXml(xml)         // parse + load from XML string
player.loadScene(scene)     // load from already-parsed WityScene
player.replaceXml(xml)      // hot-swap scene; retains play state

// Playback
player.play()
player.pause()
player.stop()               // pause + seek to 0
player.seek(t)              // seek to seconds; emits 'frame' immediately

// State
player.currentTime          // number (seconds)
player.duration             // number (seconds)
player.isPlaying            // boolean
player.isLoaded             // boolean
player.progress             // 0–1

// Mutation
player.addLayer(data)       → layerId
player.updateLayer(id, patch)
player.removeLayer(id)
player.addElement(layerId, data)  → elementId
player.updateElement(id, patch)
player.removeElement(id)

// Advanced
player.getXml()             // serialize current scene → XML string
player.getStore()           // access raw SceneStore for history/snap/clipboard

// Teardown
player.destroy()
```

Built by [Wity AI](https://www.wity.ai)
