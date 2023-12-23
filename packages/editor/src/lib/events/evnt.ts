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

export class Evnt {
  private listeners: Map<string, EventListenerCallback[]>;
  private eventMap: EventMap;

  constructor() {
    this.listeners = new Map();
    this.eventMap = new Map();
  }

  public bind(eventName: EventName, node: Node, eventType: EventType, condition?: ConditionFunction) {
    if (this.eventMap.has(eventName)) {
      console.warn(`Event name '${eventName}' is already used.`);
      return;
    }

    this.addEventListener(node, eventType, eventName);
    if (!this.eventMap.has(eventName)) {
      this.eventMap.set(eventName, { node, eventType, condition });
    }
  }

  private addEventListener(node: Node, eventType: EventType, eventName: EventName) {
    for (const [name, event] of this.eventMap) {
      if (event.node === node && event.eventType === eventType && name === eventName) {
        return;
      }
    }
    node.addEventListener(eventType, (event) => this.callbackHandler(eventName, event));
  }

  private callbackHandler(eventName: EventName, e: Event) {
    const event = this.eventMap.get(eventName);
    if (event && (!event.condition || event.condition(e))) {
      this.emit(eventName, e);
    }
  }

  public emit(eventName: EventName, event: Event) {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  public on(eventName: EventName, callback: EventListenerCallback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)?.push(callback);
  }
}
