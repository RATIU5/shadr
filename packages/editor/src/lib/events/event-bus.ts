export type Callback = (data?: unknown) => void;
export type EventListeners = {
  [event in EventType]?: Array<Callback>;
};
export type EventType = "editor:ready" | "editor:start";

/**
 * A simple event bus that allows for subscribing to and emitting events.
 */
export class EventBus {
  #eventListeners: EventListeners;

  /**
   * Initializes the event bus by creating an empty object for storing event listeners.
   * @constructor
   */
  constructor() {
    this.#eventListeners = {};
  }

  /**
   * Adds a listener for a specific event.
   * @param {string} event - The name of the event to emit.
   * @param {Callback} listener - The callback function to execute when the event is emitted.
   */
  on(event: EventType, listener: Callback) {
    if (!this.#eventListeners[event]) {
      this.#eventListeners[event] = [];
    }
    this.#eventListeners[event]?.push(listener);
  }

  /**
   * Removes a listener for a specific event.
   * @param {string} event - The name of the event.
   * @param {Callback} listenerToRemove - The callback function to be removed.
   */
  off(event: EventType, listenerToRemove: Callback) {
    if (!this.#eventListeners[event]) {
      return;
    }
    this.#eventListeners[event] = this.#eventListeners[event]?.filter((listener) => listener !== listenerToRemove);
  }

  /**
   * Emits an event to all registered listeners.
   * @param {string} event - The name of the event to emit.
   * @param {any} data - The data to pass to each listener's callback function.
   */
  emit(event: EventType, data?: unknown) {
    if (!this.#eventListeners[event]) {
      return;
    }
    for (const listener of this.#eventListeners[event] ?? []) {
      listener(data);
    }
  }
}
