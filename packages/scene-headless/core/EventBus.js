/**
 * @file core/EventBus.js
 * Open pub/sub event bus. No fixed event enum — emit and subscribe to any string.
 * The same instance is extended by SceneStore, SelectionManager, TimelineState.
 */

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   * @param {string}   event
   * @param {Function} handler
   * @returns {() => void}
   */
  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe once — auto-removed after first emission.
   * @param {string}   event
   * @param {Function} handler
   * @returns {() => void}
   */
  once(event, handler) {
    const wrapper = (payload) => {
      handler(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe a specific handler.
   * @param {string}   event
   * @param {Function} handler
   */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event
   * @param {unknown} [payload]
   */
  emit(event, payload) {
    for (const handler of this._listeners.get(event) ?? []) {
      handler(payload);
    }
  }

  /**
   * Remove all handlers for one event, or all events if omitted.
   * @param {string} [event]
   */
  clear(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  /**
   * Destroy — remove all listeners.
   */
  destroy() {
    this._listeners.clear();
  }
}
