/**
 * Type definition for a callback function.
 * @param data - Optional data of generic type DataType.
 */
type CallbackFunction<DataType> = (data?: DataType) => void;

/**
 * Type definition for a transformer function.
 * @param e - Event object of a type from the GlobalEventHandlersEventMap.
 */
type TransformFunction<DataType, E extends Event> = (e: E) => DataType;

/**
 * Type definition for a filter function.
 * @param e - Event object of a type from the GlobalEventHandlersEventMap.
 */
type FilterFunction<E extends Event> = (event: E) => boolean;

/**
 * Type definition for event listener options.
 */
type EventListenerOptions<DataType, E extends Event = Event> = {
  transform?: TransformFunction<DataType, E>;
  filter?: FilterFunction<E>;
};

/**
 * Interface for maintaining a set of callback functions.
 */
interface Callbacks<DataType> {
  callbacks: Set<CallbackFunction<DataType>>;
}

/**
 * Interface extending Callbacks to include event listening details.
 */
interface EventListener<DataType, E extends Event = Event> extends Callbacks<DataType> {
  node: Node;
  eventType: keyof GlobalEventHandlersEventMap;
  options?: EventListenerOptions<DataType, E>;
}

/**
 * Union type for event options, which can either be an EventListener or Callbacks.
 */
type EventOptions<DataType, E extends Event> = EventListener<DataType, E> | Callbacks<DataType>;

/**
 * Type for mapping event names to their respective options.
 */
export type EventRegistry<TypeList, E extends Event = Event> = {
  [K in keyof TypeList]?: EventOptions<TypeList[K], E>;
};

/**
 * Class representing an event manager to handle custom events.
 */
export class EventManager<T> {
  #eventRegistry: EventRegistry<T>;

  constructor() {
    this.#eventRegistry = {};
  }

  /**
   * Registers a callback for a specific event.
   * @param event - The event name.
   * @param callback - The callback function to execute when the event is emitted.
   */
  public on<K extends keyof T>(event: K, callback: CallbackFunction<T[K]>) {
    if (!this.#eventRegistry[event]) {
      this.#eventRegistry[event] = { callbacks: new Set() };
    }

    this.#eventRegistry[event]?.callbacks.add(callback);
  }

  /**
   * Emits an event, triggering all registered callbacks for this event.
   * @param event - The event to emit.
   * @param data - Optional data to pass to the callbacks.
   */
  public emit<K extends keyof T>(event: K, data?: T[K]) {
    const callbacks = this.#eventRegistry[event]?.callbacks;
    if (callbacks && callbacks.size > 0) {
      for (const callback of callbacks) {
        callback(data);
      }
    }
  }

  /**
   * Binds an event listener to a DOM node with transformation logic.
   * @param event - The name of the event to bind.
   * @param node - The DOM node to bind the event listener to.
   * @param eventType - The type of the DOM event to listen for.
   * @param options - Options for filtering or transforming the event.
   */
  public bind<K extends keyof T, E extends Event>(
    event: K,
    node: Node,
    eventType: keyof GlobalEventHandlersEventMap,
    options?: EventListenerOptions<T[K], E>,
  ) {
    if (event in this.#eventRegistry) {
      return console.warn(`Event ${String(event)} already bound`);
    }

    const eventExists = this.#doesNodeAndEventTypeExist(node, eventType);
    if (!eventExists) {
      this.#eventRegistry[event] = {
        node,
        eventType,
        options,
        callbacks: new Set(),
      } as EventOptions<T[K], E>;
      node.addEventListener(eventType, (e: Event) => {
        this.#handleEvent<E>(e as E, event);
      });
    }
  }

  /**
   * Internal method to handle an event and trigger associated callbacks.
   * @param event - The DOM event object.
   * @param eventName - The name of the custom event.
   */
  #handleEvent<E extends Event>(event: E, eventName: keyof T) {
    const eventOptions = this.#eventRegistry[eventName];
    if (eventOptions && "options" in eventOptions) {
      const filter = eventOptions.options?.filter;
      if (!filter || filter(event)) {
        const data = eventOptions.options?.transform?.(event);
        this.emit(eventName, data);
      }
    }
  }

  /**
   * Checks if a node and event type already exist in the event registry.
   * @param node - The DOM node to check.
   * @param eventType - The type of the DOM event to check.
   * @returns A boolean indicating whether the node and event type exist.
   */
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
