type CallbackFunction<DataType> = (data?: DataType) => void;
type Transformer<DataType> = (e: GlobalEventHandlersEventMap[keyof GlobalEventHandlersEventMap]) => DataType;

interface Callbacks<DataType> {
  callbacks: Set<CallbackFunction<DataType>>;
}
interface EventListener<DataType> extends Callbacks<DataType> {
  node: Node;
  eventType: keyof GlobalEventHandlersEventMap;
  transformer: Transformer<DataType>;
}

type EventOptions<DataType> = EventListener<DataType> | Callbacks<DataType>;
export type EventRegistry<TypeList> = { [K in keyof TypeList]?: EventOptions<TypeList[K]> };

// T is an object type, keys are string literals, values are type of data passed to the callback
// e.g. { "editor:ready": undefined; "editor:dragXY": FederatedPointerEvent; ... }

export class EventManager<T> {
  #eventRegistry: EventRegistry<T>;

  constructor() {
    this.#eventRegistry = {};
  }

  // Add a callback to be run when an event is emitted
  // Nothing specific to the node event happens here
  public on<K extends keyof T>(event: K, callback: CallbackFunction<T[K]>) {
    if (event in this.#eventRegistry) {
      return console.warn(`Event ${String(event)} already bound`);
    }
    if (!this.#eventRegistry[event]) {
      this.#eventRegistry[event] = { callbacks: new Set() };
    }

    this.#eventRegistry[event]?.callbacks.add(callback);
  }

  // Emit handles running all the callbacks from a given event name
  // Nothing specific to the node event happens here
  public emit<K extends keyof T>(event: K, data?: T[K]) {
    const callbacks = this.#eventRegistry[event]?.callbacks;
    if (callbacks && callbacks.size > 0) {
      for (const callback of callbacks) {
        callback(data);
      }
    }
  }

  public bind<K extends keyof T>(
    event: K,
    node: Node,
    eventType: keyof GlobalEventHandlersEventMap,
    transform: (e: GlobalEventHandlersEventMap[typeof eventType]) => T[K],
  ) {
    if (event in this.#eventRegistry) {
      return console.warn(`Event ${String(event)} already bound`);
    }

    const eventExists = this.#doesNodeAndEventTypeExist(node, eventType);
    if (!eventExists) {
      this.#eventRegistry[event] = {
        node,
        eventType,
        transformer: transform,
        callbacks: new Set(),
      };
      node.addEventListener(eventType, (e: GlobalEventHandlersEventMap[typeof eventType]) => {
        this.#handleEvent(e, event);
      });
    }
  }

  #handleEvent(event: Event, eventName: keyof T) {
    const eventOptions = this.#eventRegistry[eventName];
    if (eventOptions && "transformer" in eventOptions) {
      const data = eventOptions.transformer(event);
      this.emit(eventName, data);
    }
  }

  #doesNodeAndEventTypeExist(node: Node, eventType: keyof GlobalEventHandlersEventMap) {
    for (const index in this.#eventRegistry) {
      const event = this.#eventRegistry[index];
      if (event && "node" in event && event?.node === node && event?.eventType === eventType) {
        return true;
      }
    }
    return false;
  }
}
