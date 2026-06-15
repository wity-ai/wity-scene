# @wity/scene-headless

Headless authoring state for wity-scene editors. Extensible primitives — open event bus, pluggable commands, registerable element types and snap strategies. Zero DOM, zero framework.

**[Full documentation → wity.ai/stack/scene-graph](https://www.wity.ai/stack/scene-graph/)**

---

The authoring layer of [wity-scene](https://github.com/wity-ai/wity-scene). Sits between `@wity/scene-core` (the document model) and your UI component.

```bash
npm install @wity/scene-headless
```

```js
import {
  SceneStore, SelectionManager, HistoryManager,
  SnapState, TimelineState, Clipboard,
  AddElementCommand, MoveElementCommand,
  getSelectionBounds, getResizeHandles,
} from '@wity/scene-headless';

// Create store from a parsed scene (or empty)
const store     = new SceneStore(scene);
const selection = new SelectionManager(store);
const history   = new HistoryManager();
const snap      = new SnapState({ gridSize: 8 });
const timeline  = new TimelineState(store);
const clipboard = new Clipboard(store);

// Add a custom element type — extends without modifying scene-core
store.registerElementType('ws-video', {
  label:    'Video',
  defaults: { x: 0, y: 0, width: '100%', height: '100%', src: '', fit: 'cover' },
});

// Commit a command — undoable
history.commit(new AddElementCommand(store, 'my-layer', {
  tag: 'ws-text', content: 'Hello', x: '50%', y: '50%', anchor: 'center',
}));

// Undo / redo
history.undo();
history.redo();

// Register a custom snap strategy
snap.registerStrategy('center-of-scene', (x, y, ctx) => ({
  x: Math.abs(x - ctx.sceneWidth / 2) < 10 ? ctx.sceneWidth / 2 : x,
  y: Math.abs(y - ctx.sceneHeight / 2) < 10 ? ctx.sceneHeight / 2 : y,
  guides: [],
}));
```

Built by [Wity AI](https://www.wity.ai)
