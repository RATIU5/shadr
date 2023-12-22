type EventListenerCallback = (event: Event) => void;
type ConditionFunction = (event: Event) => boolean;

export class Evnt {
  private listeners: Map<string, EventListenerCallback[]>;
  private nodeEventMap: Map<Node, Map<string, { condition?: ConditionFunction; eventName: string }[]>>;

  constructor() {
    this.listeners = new Map();
    this.nodeEventMap = new Map();
  }

  public bind(node: Node, eventType: string, eventName: string, condition?: ConditionFunction) {
    // Create a new inner map for the node if it doesn't exist
    if (!this.nodeEventMap.has(node)) {
      this.nodeEventMap.set(node, new Map());
    }

    // Get the inner map for the node
    const nodeEventMap = this.nodeEventMap.get(node);

    // Create a new array for the event type if it doesn't exist
    if (!nodeEventMap?.has(eventType)) {
      nodeEventMap?.set(eventType, []);
    }

    // Get the array for the event type
    const eventArray = nodeEventMap?.get(eventType);

    // Check if the event name already exists
    if (eventArray?.some((event) => event.eventName === eventName)) {
      return console.warn(`Event ${eventName} already exists for node ${node} and event type ${eventType}`);
    }

    // Add the event to the array
    eventArray?.push({ condition, eventName });

    // Add the event listener
    node.addEventListener(eventType, (e) => {
      // Get the array of events for the node and event type
      const events = this.nodeEventMap.get(node)?.get(eventType);

      // Emit all events that match the condition
      for (const { eventName, condition } of events ?? []) {
        if (!condition || condition(e)) {
          this.emit(eventName, e);
        }
      }
    });

    console.log(this.nodeEventMap);
  }

  public emit(eventName: string, e: Event) {
    // Get the array of listeners for the event name
    const listeners = this.listeners.get(eventName);

    // Call all listeners
    for (const listener of listeners ?? []) {
      listener(e);
    }
  }

  public on(eventName: string, listener: EventListenerCallback) {
    // Check if the event name already exists
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    // Get the array of listeners for the event name
    const listeners = this.listeners.get(eventName);

    // Add the listener to the array
    listeners?.push(listener);
  }
}
