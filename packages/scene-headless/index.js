/**
 * @wity/scene-headless
 * Headless authoring state for wity-scene editors.
 *
 * Primitives, not workflows. Extensible, not constraining.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  SceneStore        mutable document, element type registry│
 * │  SelectionManager  ID-based selection                    │
 * │  HistoryManager    open command stack (apply / revert)   │
 * │  TransformState    bounding boxes, resize handles (math) │
 * │  SnapState         pluggable snap strategies             │
 * │  TimelineState     playhead, play / pause / seek         │
 * │  Clipboard         copy / cut / paste                    │
 * │  EventBus          open pub/sub (base class)             │
 * └─────────────────────────────────────────────────────────┘
 *
 * Built-in commands (extend freely):
 *   MoveElementCommand, UpdateElementCommand,
 *   AddElementCommand, RemoveElementCommand,
 *   AddLayerCommand, UpdateLayerCommand, ReorderLayersCommand
 *
 * Built-in snap strategies (register your own):
 *   gridSnapStrategy(gridSize)
 *   alignmentSnapStrategy(elements, excludeIds, threshold?)
 */

// Core
export { EventBus }           from './core/EventBus.js';
export { SceneStore }         from './core/SceneStore.js';

// Selection
export { SelectionManager }   from './selection/SelectionManager.js';

// History
export { HistoryManager }     from './history/HistoryManager.js';
export {
  MoveElementCommand,
  UpdateElementCommand,
  AddElementCommand,
  RemoveElementCommand,
  AddLayerCommand,
  UpdateLayerCommand,
  ReorderLayersCommand,
} from './history/commands.js';

// Transform (pure functions)
export {
  getSelectionBounds,
  getResizeHandles,
  getRotationHandle,
  getAnchorPoint,
  pointInBounds,
  elementAtPoint,
} from './transform/TransformState.js';

// Snap
export { SnapState, gridSnapStrategy, alignmentSnapStrategy } from './snap/SnapState.js';

// Timeline
export { TimelineState }      from './timeline/TimelineState.js';

// Clipboard
export { Clipboard }          from './clipboard/Clipboard.js';
