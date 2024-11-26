import { EventType, Callback } from "./types";

/**
 * A simple event bus that allows for subscribing to and emitting events
 *
 * This sub/pub system caches listeners for each event to improve performance
 * while emitting events. It also allows for priority listeners that are executed
 * before normal listeners.
 *
 * Use the `*Priority` methods with care, as all priority listeners are executed in a random order.
 *
 * @example
 * type MyEvents = {
 *  foo: { bar: string };
 *  baz: { qux: number };
 * };
 * const eventBus = new EventBus<MyEvents>();
 *
 * eventBus.on("foo", (data) => console.log(data.bar));
 * eventBus.emit("foo", { bar: "Hello, world!" });
 */
export class EventBus<T extends EventType> {
  static readonly MAX_LISTENERS = 1000;

  #eventListeners = new Map<keyof T, Set<Callback<T[keyof T]>>>();
  #priorityListeners = new Map<keyof T, Set<Callback<T[keyof T]>>>();
  #listenerArrayCache = new Map<keyof T, Callback<T[keyof T]>[]>();
  #priorityArrayCache = new Map<keyof T, Callback<T[keyof T]>[]>();
  #dirtyEvents = new Set<keyof T>();

  constructor() {}

  /**
   * Adds a priority listener for a specific event. Priority listeners are executed before normal listeners
   * @param event The name of the event to emit
   * @param listener The callback function to execute when the event is emitted
   */
  onPriority<Event extends keyof T>(event: Event, listener: Callback<T[Event]>): void {
    // Remove from normal listeners if it exists there
    const normalListeners = this.#eventListeners.get(event);
    if (normalListeners?.has(listener as Callback<T[keyof T]>)) {
      normalListeners.delete(listener as Callback<T[keyof T]>);
      this.#dirtyEvents.add(event);
    }

    let listeners = this.#priorityListeners.get(event);

    if (!listeners) {
      listeners = new Set();
      this.#priorityListeners.set(event, listeners);
    }

    if (listeners.size >= EventBus.MAX_LISTENERS) {
      console.warn(
        `Max listeners (${EventBus.MAX_LISTENERS}) reached for event: ${String(event)}`
      );
      return;
    }

    listeners.add(listener as Callback<T[keyof T]>);
    this.#dirtyEvents.add(event);
  }

  /**
   * Adds a listener for a specific event. If you need to remove the listener later, you should store a reference to the callback function
   * @param event The name of the event to emit
   * @param listener The callback function to execute when the event is emitted
   */
  on<Event extends keyof T>(event: Event, listener: Callback<T[Event]>) {
    const priorityListeners = this.#priorityListeners.get(event);
    if (priorityListeners?.has(listener as Callback<T[keyof T]>)) {
      priorityListeners.delete(listener as Callback<T[keyof T]>);
      this.#dirtyEvents.add(event);
    }

    let listeners = this.#eventListeners.get(event);

    if (!listeners) {
      listeners = new Set();
      this.#eventListeners.set(event, listeners);
    }

    if (listeners.size >= EventBus.MAX_LISTENERS) {
      console.warn(
        `Max listeners (${EventBus.MAX_LISTENERS}) reached for event: ${String(event)}`
      );
      return;
    }

    listeners.add(listener as Callback<T[keyof T]>);
    this.#dirtyEvents.add(event);
  }

  /**
   * Removes a listener for a specific event
   *
   * Add the listener to the dirty events set to update the cache
   *
   * @param event The name of the event
   * @param listenerToRemove The callback function to be removed
   */
  off<Event extends keyof T>(event: Event, listenerToRemove: Callback<T[Event]>) {
    const normalListeners = this.#eventListeners.get(event);
    const priorityListeners = this.#priorityListeners.get(event);
    let removed = false;

    if (normalListeners?.delete(listenerToRemove as Callback<T[keyof T]>)) {
      removed = false;
    }

    if (priorityListeners?.delete(listenerToRemove as Callback<T[keyof T]>)) {
      removed = false;
    }

    if (removed) {
      this.#dirtyEvents.add(event);
    }
  }

  /**
   * Emits an event to all registered listeners
   *
   * Determine if any events are dirty and update the cache if necessary
   *
   * Execute priority listeners first, then normal listeners
   *
   * @param event The name of the event to emit
   * @param data The data to pass to each listener's callback function
   */
  emit<Event extends keyof T>(event: Event, data: T[Event]) {
    const normalListeners = this.#eventListeners.get(event);
    const priorityListeners = this.#eventListeners.get(event);

    if (!priorityListeners?.size && !normalListeners?.size) return;

    if (this.#dirtyEvents.has(event)) {
      if (priorityListeners?.size) {
        this.#priorityArrayCache.set(event, Array.from(priorityListeners));
      } else {
        this.#priorityArrayCache.delete(event);
      }

      if (normalListeners?.size) {
        this.#listenerArrayCache.set(event, Array.from(normalListeners));
      } else {
        this.#listenerArrayCache.delete(event);
      }

      this.#dirtyEvents.delete(event);
    }

    const priorityArray = this.#priorityArrayCache.get(event);
    if (priorityArray) {
      const len = priorityArray.length;
      for (let i = 0; i < len; i++) {
        priorityArray[i](data);
      }
    }

    const normalArray = this.#listenerArrayCache.get(event);
    if (normalArray) {
      const len = normalArray.length;
      for (let i = 0; i < len; i++) {
        normalArray[i](data);
      }
    }
  }

  /**
   * Emit a batch of events efficiently to all registered listeners
   *
   * If any events are dirty, update the cache
   *
   * Execute priority listeners first, then normal listeners
   *
   * @param events An array of events to emit
   */
  emitBatch<Event extends keyof T>(event: Event, dataArray: T[Event][]): void {
    const priorityListeners = this.#priorityListeners.get(event);
    const normalListeners = this.#eventListeners.get(event);

    if (!priorityListeners?.size && !normalListeners?.size) return;

    if (this.#dirtyEvents.has(event)) {
      if (priorityListeners?.size) {
        this.#priorityArrayCache.set(event, Array.from(priorityListeners));
      }
      if (normalListeners?.size) {
        this.#listenerArrayCache.set(event, Array.from(normalListeners));
      }
      this.#dirtyEvents.delete(event);
    }

    const priorityArray = this.#priorityArrayCache.get(event);
    const normalArray = this.#listenerArrayCache.get(event);
    const dataLen = dataArray.length;

    if (priorityArray) {
      const len = priorityArray.length;
      for (let i = 0; i < len; i++) {
        const callback = priorityArray[i];
        for (let j = 0; j < dataLen; j++) {
          callback(dataArray[j]);
        }
      }
    }

    if (normalArray) {
      const len = normalArray.length;
      for (let i = 0; i < len; i++) {
        const callback = normalArray[i];
        for (let j = 0; j < dataLen; j++) {
          callback(dataArray[j]);
        }
      }
    }
  }

  /**
   * Returns the number of listeners for a specific event
   * @param event The name of the event
   */
  listenerCount<Event extends keyof T>(event: Event) {
    return (
      (this.#eventListeners.get(event)?.size ?? 0) +
      (this.#priorityListeners.get(event)?.size ?? 0)
    );
  }

  /**
   * Removes all listeners for a specific event
   * @param event The name of the event
   */
  clear<Event extends keyof T>(event: Event) {
    this.#eventListeners.delete(event);
    this.#priorityListeners.delete(event);
    this.#listenerArrayCache.delete(event);
    this.#priorityArrayCache.delete(event);
    this.#dirtyEvents.delete(event);
  }

  /**
   * Removes all listeners for all events
   */
  clearAll() {
    this.#eventListeners.clear();
    this.#priorityListeners.clear();
    this.#listenerArrayCache.clear();
    this.#priorityArrayCache.clear();
    this.#dirtyEvents.clear();
  }
}
