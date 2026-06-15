# @wity/scene-headless

Headless authoring state for wity-scene editors. Extensible primitives — open event bus, pluggable commands, registerable element types and snap strategies. Zero DOM, zero framework.

## Install

```bash
npm install @wity/scene-headless
```

---

## Primitives

```js
import {
  SceneStore,
  SelectionManager,
  HistoryManager,
  SnapState,
  TimelineState,
  Clipboard,
  EventBus,
  // Commands
  AddElementCommand,
  RemoveElementCommand,
  MoveElementCommand,
  UpdateElementCommand,
  AddLayerCommand,
  UpdateLayerCommand,
  ReorderLayersCommand,
  // Transform math (pure functions)
  getSelectionBounds,
  getResizeHandles,
  getRotationHandle,
  getAnchorPoint,
  pointInBounds,
  elementAtPoint,
  // Snap strategies
  gridSnapStrategy,
  alignmentSnapStrategy,
} from '@wity/scene-headless';
```

---

## SceneStore

Mutable authoring state for a WityScene document. Wraps a parsed scene with granular mutation methods and a fine-grained event bus.

```js
const store = new SceneStore(scene);  // scene from parse()

// Layers
const id = store.addLayer({ label: 'Title', z: 10 });
store.updateLayer(id, { opacity: 0.8 });
store.removeLayer(id);
store.reorderLayers(['layer-1', 'layer-2']);

// Elements
const elId = store.addElement(layerId, {
  tag: 'ws-text', content: 'Hello', x: '50%', y: '50%', anchor: 'center',
});
store.updateElement(elId, { color: '#ff0000' });
store.removeElement(elId);
store.moveElement(elId, '60%', '40%');

// Register custom element types
store.registerElementType('ws-video', {
  label:    'Video',
  defaults: { x: 0, y: 0, width: '100%', height: '100%', src: '', fit: 'cover' },
});

// Read
const scene    = store.getScene();
const layers   = store.getLayers();
const elements = store.getElements(layerId);
```

### Events

`'scene:replaced'` · `'layer:added'` · `'layer:updated'` · `'layer:removed'` · `'layers:reordered'` · `'element:added'` · `'element:updated'` · `'element:removed'` · `'element:moved'` · `'element:layer-changed'`

---

## HistoryManager

Open command stack. Any object with `apply()` and `revert()` is a valid command.

```js
const history = new HistoryManager();

history.commit(new AddElementCommand(store, layerId, { tag: 'ws-text', content: 'Hello' }));
history.commit(new MoveElementCommand(store, elId, '60%', '40%', '50%', '50%'));
history.commitBatch([cmd1, cmd2, cmd3], 'Group move');

history.undo();
history.redo();

history.canUndo   // boolean
history.canRedo   // boolean
history.undoLabel // string | undefined
```

---

## SelectionManager

ID-based selection over any set of ids.

```js
const selection = new SelectionManager(store);

selection.select('layer-1');
selection.select('layer-2', { addToSelection: true });
selection.toggle('layer-3');
selection.clear();

selection.getSelected()   // string[]
selection.isSelected(id)  // boolean
selection.count           // number
selection.isMulti         // boolean
```

Event: `'selection:changed'` `{ selected, added, removed, isMulti }`

---

## SnapState

Pluggable snap strategies. Strategies compose — each receives the output of the previous.

```js
const snap = new SnapState({ gridSize: 8 });

// Built-in strategies (pre-registered)
// gridSnapStrategy — snaps to grid
// alignmentSnapStrategy — snaps to other elements

// Register custom strategy
snap.registerStrategy('center-of-scene', (x, y, ctx) => ({
  x: Math.abs(x - ctx.sceneWidth / 2) < 10 ? ctx.sceneWidth / 2 : x,
  y: Math.abs(y - ctx.sceneHeight / 2) < 10 ? ctx.sceneHeight / 2 : y,
  guides: [],
}));

const { x, y, guides } = snap.snap(rawX, rawY, context);
```

---

## TimelineState

Playhead with RAF loop. Drives the preview renderer.

```js
const timeline = new TimelineState(store);

timeline.play();
timeline.pause();
timeline.stop();
timeline.seek(2.5);

timeline.currentTime  // number (seconds)
timeline.isPlaying    // boolean
timeline.duration     // number
timeline.progress     // 0–1
```

Events: `'time:changed'` · `'playback:started'` · `'playback:paused'` · `'playback:stopped'` · `'playback:ended'`

---

## Clipboard

```js
const clipboard = new Clipboard(store);

clipboard.copy(['el-1', 'el-2']);
clipboard.cut(['el-1']);
const newIds = clipboard.paste(targetLayerId, { x: 10, y: 10 });
clipboard.hasContent  // boolean
```

---

## Transform (pure functions)

```js
getSelectionBounds(elements, ids)      → Bounds | null
getResizeHandles(bounds)               → ResizeHandle[]
getRotationHandle(bounds, offset?)     → { x, y }
getAnchorPoint(bounds, anchor)         → { x, y }
pointInBounds(px, py, bounds, pad?)    → boolean
elementAtPoint(px, py, elements, pad?) → ComputedElement | null
```
