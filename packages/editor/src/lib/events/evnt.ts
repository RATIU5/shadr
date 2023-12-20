type EventListenerMap = Map<string, EventListener>;

class EventManager {
  private listeners: Map<Element, EventListenerMap>;

  constructor() {
    this.listeners = new Map();
  }

  addEventListener(element: Element, eventType: string, listener: EventListener): void {
    let elementListeners = this.listeners.get(element);

    if (!elementListeners) {
      elementListeners = new Map();
      this.listeners.set(element, elementListeners);
    }

    if (!elementListeners.has(eventType)) {
      elementListeners.set(eventType, listener);
      element.addEventListener(eventType, listener);
    } else {
      console.warn(`Listener for ${eventType} already exists on this element`);
    }
  }

  removeEventListener(element: Element, eventType: string): void {
    const elementListeners = this.listeners.get(element);

    if (elementListeners?.has(eventType)) {
      const listener = elementListeners.get(eventType);
      if (listener) {
        element.removeEventListener(eventType, listener);
        elementListeners.delete(eventType);
      }
    }
  }
}
