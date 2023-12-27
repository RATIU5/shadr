export type Callback<T> = (data: T) => void;
export type EventListeners<T> = {
  [Event in keyof T]?: Array<Callback<T[Event]>>;
};

/**
 * A simple event bus that allows for subscribing to and emitting events
 * @template T The type of events that can be emitted
 */
export class EventBus<T> {
  #eventListeners: EventListeners<T>;

  /**
   * Initializes the event bus by creating an empty object for storing event listeners
   * @constructor
   */
  constructor() {
    this.#eventListeners = {} as EventListeners<T>;
  }

  /**
   * Adds a listener for a specific event. If you need to remove the listener later, you should store a reference to the callback function
   * @param {Event} event - The name of the event to emit
   * @param {Callback<T[Event]>} listener - The callback function to execute when the event is emitted
   */
  on<Event extends keyof T>(event: Event, listener: Callback<T[Event]>) {
    if (!this.#eventListeners[event]) {
      this.#eventListeners[event] = [];
    }
    this.#eventListeners[event]?.push(listener);
  }

  /**
   * Removes a listener for a specific event
   * @param {Event} event - The name of the event
   * @param {Callback<T[Event]>} listenerToRemove - The callback function to be removed
   */
  off<Event extends keyof T>(event: Event, listenerToRemove: Callback<T[Event]>) {
    if (!this.#eventListeners[event]) {
      return;
    }
    this.#eventListeners[event] = this.#eventListeners[event]?.filter((listener) => listener !== listenerToRemove);
  }

  /**
   * Emits an event to all registered listeners
   * @param {Event} event - The name of the event to emit
   * @param {T[Event]} data - The data to pass to each listener's callback function
   */
  emit<Event extends keyof T>(event: Event, data: T[Event]) {
    if (!this.#eventListeners[event]) {
      return;
    }
    for (const listener of this.#eventListeners[event] ?? []) {
      listener(data);
    }
  }
}
