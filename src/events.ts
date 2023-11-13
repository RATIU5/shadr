export class MouseDownEvent {
  private static callbacks: Array<(e: MouseEvent) => void> = [];
  private static element: Window | HTMLElement | null = null;

  static attachElement(element: Window | HTMLElement) {
    if (!MouseDownEvent.element) {
      MouseDownEvent.element = element;
      MouseDownEvent.element.addEventListener("mousedown", (e) => {
        for (let i = 0; i < MouseDownEvent.callbacks.length; i++) {
          MouseDownEvent.callbacks[i](e as MouseEvent);
        }
      });
    }
  }

  static addCallback(callback: (e: MouseEvent) => void): void {
    MouseDownEvent.callbacks.push(callback);
  }

  static removeCallback(callback: (e: Event) => void): void {
    MouseDownEvent.callbacks = MouseDownEvent.callbacks.filter(
      (cb) => cb !== callback,
    );
  }
}

export class MouseUpEvent {
  private static callbacks: Array<(e: MouseEvent) => void> = [];
  private static element: Window | HTMLElement | null = null;

  static attachElement(element: Window | HTMLElement) {
    if (!MouseUpEvent.element) {
      MouseUpEvent.element = element;
      MouseUpEvent.element.addEventListener("mouseup", (e) => {
        for (let i = 0; i < MouseUpEvent.callbacks.length; i++) {
          MouseUpEvent.callbacks[i](e as MouseEvent);
        }
      });
    }
  }

  static addCallback(callback: (e: MouseEvent) => void): void {
    MouseUpEvent.callbacks.push(callback);
  }

  static removeCallback(callback: (e: Event) => void): void {
    MouseUpEvent.callbacks = MouseUpEvent.callbacks.filter(
      (cb) => cb !== callback,
    );
  }
}

export class MouseMoveEvent {
  private static callbacks: Array<(e: MouseEvent) => void> = [];
  private static element: Window | HTMLElement | null = null;

  static attachElement(element: Window | HTMLElement) {
    if (!MouseMoveEvent.element) {
      MouseMoveEvent.element = element;
      MouseMoveEvent.element.addEventListener("mousemove", (e) => {
        for (let i = 0; i < MouseMoveEvent.callbacks.length; i++) {
          MouseMoveEvent.callbacks[i](e as MouseEvent);
        }
      });
    }
  }

  static addCallback(callback: (e: MouseEvent) => void): void {
    MouseMoveEvent.callbacks.push(callback);
  }

  static removeCallback(callback: (e: Event) => void): void {
    MouseMoveEvent.callbacks = MouseMoveEvent.callbacks.filter(
      (cb) => cb !== callback,
    );
  }
}

export class MouseScrollEvent {
  private static callbacks: Array<(e: WheelEvent) => void> = [];
  private static element: Window | HTMLElement | null = null;

  static attachElement(element: Window | HTMLElement) {
    if (!MouseScrollEvent.element) {
      MouseScrollEvent.element = element;
      MouseScrollEvent.element.addEventListener("scroll", (e) => {
        for (let i = 0; i < MouseScrollEvent.callbacks.length; i++) {
          MouseScrollEvent.callbacks[i](e as WheelEvent);
        }
      });
    }
  }

  static addCallback(callback: (e: WheelEvent) => void): void {
    MouseScrollEvent.callbacks.push(callback);
  }

  static removeCallback(callback: (e: WheelEvent) => void): void {
    MouseScrollEvent.callbacks = MouseScrollEvent.callbacks.filter(
      (cb) => cb !== callback,
    );
  }
}

export class ResizeEvent {
  private static callbacks: Array<(e: Event) => void> = [];
  private static element: Window | HTMLElement | null = null;

  static attachElement(element: Window | HTMLElement) {
    if (!ResizeEvent.element) {
      ResizeEvent.element = element;
      ResizeEvent.element.addEventListener("resize", (e) => {
        for (let i = 0; i < ResizeEvent.callbacks.length; i++) {
          ResizeEvent.callbacks[i](e);
        }
      });
    }
  }

  static addCallback(callback: (e: Event) => void): void {
    ResizeEvent.callbacks.push(callback);
  }

  static removeCallback(callback: (e: Event) => void): void {
    ResizeEvent.callbacks = ResizeEvent.callbacks.filter(
      (cb) => cb !== callback,
    );
  }
}
