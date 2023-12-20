export type Callback<T = unknown> = (data?: T) => void;
export type EventListeners<T> = {
  [Event in keyof T]?: Array<Callback<T[Event]>>;
};

/**
 * A simple event bus that allows for subscribing to and emitting events
 * @template T The type of events that can be emitted
 */
export class EventBus<T> {
  #eventListeners: EventListeners<T>;
  #domEventListeners: Map<string, Set<keyof T>>;

  /**
   * Initializes the event bus by creating an empty object for storing event listeners
   * @constructor
   */
  constructor() {
    this.#eventListeners = {} as EventListeners<T>;
    this.#domEventListeners = new Map();
  }

  attach(element: Element, eventType: string, eventName: keyof T, eventDetail: EventDetail = {}) {
    // Generate a unique key for the element-event combination
    const elementId = element.id || `unique-id-${Math.random().toString(36).substr(2, 9)}`;
    const eventKey = elementId + eventType;

    if (!this.#domEventListeners.has(eventKey)) {
      this.#domEventListeners.set(eventKey, {} as Record<keyof T, EventDetail>);
      element.addEventListener(eventType, (event) => {
        const eventsMap = this.#domEventListeners.get(eventKey);
        for (const [name, detail] of Object.entries(eventsMap)) {
          if (!detail.condition || detail.condition(event)) {
            this.emit(name as keyof T);
          }
        }
      });
    }

    const eventsMap = this.#domEventListeners.get(eventKey);
    // Duplicate event name, skip attaching again
    if (eventsMap && eventName in eventsMap) {
      return;
    }

    eventsMap[eventName] = eventDetail;
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
  emit<Event extends keyof T>(event: Event, data?: T[Event]) {
    if (!this.#eventListeners[event]) {
      return;
    }
    for (const listener of this.#eventListeners[event] ?? []) {
      listener(data);
    }
  }
}
