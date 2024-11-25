import { types } from "@shadr/common";

/**
 * A simple event bus that allows for subscribing to and emitting events
 */
export const createEventBus = <
  T extends types.Editor.Events.EventType,
>(): types.Editor.Events.EventBus<T> => {
  const eventListeners = {} as types.Editor.Events.EventListeners<T>;

  return {
    /**
     * Adds a listener for a specific event. If you need to remove the listener later, you should store a reference to the callback function
     * @param event The name of the event to emit
     * @param listener The callback function to execute when the event is emitted
     */
    on(event, listener) {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event]?.push(listener);
    },

    /**
     * Removes a listener for a specific event
     * @param event The name of the event
     * @param listenerToRemove The callback function to be removed
     */
    off(event, listenerToRemove) {
      if (!eventListeners[event]) {
        return;
      }
      eventListeners[event] = eventListeners[event]?.filter(
        (listener) => listener !== listenerToRemove
      );
    },

    /**
     * Emits an event to all registered listeners
     * @param event The name of the event to emit
     * @param data The data to pass to each listener's callback function
     */
    emit(event, data) {
      if (!eventListeners[event]) {
        return;
      }
      for (const listener of eventListeners[event] ?? []) {
        listener(data);
      }
    },
  };
};
