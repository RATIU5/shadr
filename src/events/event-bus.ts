export type Callback = (data: any) => void;
export type EventListeners = {
  [event: string]: Array<Callback>;
};

let eventListeners: EventListeners | undefined = undefined;

/**
 * Initializes the event bus by creating an empty object for storing event listeners.
 */
export function initializeEventBus() {
  eventListeners = {};
}

/**
 * Registers a listener for a specific event.
 * @param {string} event - The name of the event to listen for.
 * @param {Callback} listener - The callback function to execute when the event is emitted.
 * @throws Will throw an error if the event bus is not initialized.
 */
export function on(event: string, listener: Callback) {
  if (!eventListeners) {
    throw new Error("Event bus not initialized");
  }
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  eventListeners[event].push(listener);
}

/**
 * Removes a listener for a specific event.
 * @param {string} event - The name of the event.
 * @param {Callback} listenerToRemove - The callback function to be removed.
 * @throws Will throw an error if the event bus is not initialized.
 */
export function off(event: string, listenerToRemove: Callback) {
  if (!eventListeners) {
    throw new Error("Event bus not initialized");
  }
  if (!eventListeners[event]) {
    return;
  }
  eventListeners[event] = eventListeners[event].filter(
    (listener) => listener !== listenerToRemove
  );
}

/**
 * Emits an event to all registered listeners.
 * @param {string} event - The name of the event to emit.
 * @param {any} data - The data to pass to each listener's callback function.
 * @throws Will throw an error if the event bus is not initialized.
 */
export function emit(event: string, data: any) {
  if (!eventListeners) {
    throw new Error("Event bus not initialized");
  }
  if (!eventListeners[event]) {
    return;
  }
  eventListeners[event].forEach((listener) => listener(data));
}
