type EventListenerCallback = (event: Event) => void;
type ConditionFunction = (event: Event) => boolean;
type EventType = keyof HTMLElementEventMap;
type EventDetail = {
  node: Node;
  eventType: EventType;
  condition?: ConditionFunction;
};
type EventName = string;
type EventMap = Map<EventName, EventDetail>;

/** Class to handle custom event binding and triggering. */
export class EventManager {
  /** Map of event listeners by event name. */
  private listeners: Map<string, EventListenerCallback[]>;

  /** Map of event details by event name. */
  private eventMap: EventMap;

  /** Constructs a new event manager instance. */
  constructor() {
    this.listeners = new Map();
    this.eventMap = new Map();
  }

  /**
   * Binds an event listener to a node for a specific event type.
   * @param eventName - The unique name for the custom event.
   * @param node - The DOM node to listen for the event on.
   * @param eventType - The type of the event to listen for.
   * @param condition - An optional function to conditionally handle the event.
   */
  public bind(eventName: EventName, node: Node, eventType: EventType, condition?: ConditionFunction) {
    if (this.eventMap.has(eventName)) {
      console.warn(`Event name '${eventName}' is already used.`);
      return;
    }

    let existingEventType = false;
    for (const detail of this.eventMap.values()) {
      if (detail.node === node && detail.eventType === eventType) {
        existingEventType = true;
        break;
      }
    }

    if (existingEventType) {
      this.eventMap.set(eventName, { node, eventType, condition });
    } else {
      node.addEventListener(eventType, (event) => this.callbackHandler(eventType, event));
      this.eventMap.set(eventName, { node, eventType, condition });
    }
  }

  /**
   * Internal handler for DOM events, which invokes callbacks based on event type.
   * @param eventType - The type of the event that was triggered.
   * @param e - The event object.
   */
  private callbackHandler(eventType: EventType, e: Event) {
    for (const [name, detail] of this.eventMap) {
      if (detail.node === e.currentTarget && detail.eventType === eventType) {
        const conditionPassed = !detail.condition || detail.condition(e);
        if (conditionPassed) {
          this.emit(name, e);
        }
      }
    }
  }

  /**
   * Emits a custom event, triggering all associated callbacks.
   * @param eventName - The name of the custom event to emit.
   * @param event - The event object to pass to the callbacks.
   */
  public emit(eventName: EventName, event: Event) {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  /**
   * Registers a callback for a custom event.
   * @param eventName - The name of the custom event.
   * @param callback - The callback function to register.
   */
  public on(eventName: EventName, callback: EventListenerCallback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)?.push(callback);
  }
}
