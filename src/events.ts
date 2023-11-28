export type Interactions = {
  mouse: IPointData;
};

const interactions: Interactions = {
  mouse: { x: 0, y: 0 },
};

export class MouseDownEvent {
  private static callbacks: Array<(e: MouseEvent, i: Interactions) => void> =
    [];
  private static element: Window | HTMLElement | null = null;
  static attachElement(element: Window | HTMLElement) {
    if (!MouseDownEvent.element) {
      MouseDownEvent.element = element;
      MouseDownEvent.element.addEventListener("mousedown", (e) => {
        for (let i = 0; i < MouseDownEvent.callbacks.length; i++) {
          MouseDownEvent.callbacks[i](e as MouseEvent, interactions);
        }
      });
    }
  }
  static addCallback(callback: (e: MouseEvent, i: Interactions) => void): void {
    MouseDownEvent.callbacks.push(callback);
  }
  static removeCallback(
    callback: (e: MouseEvent, i: Interactions) => void,
  ): void {
    MouseDownEvent.callbacks = MouseDownEvent.callbacks.filter(
      (cb) => cb !== callback,
    );
  }
}

export class MouseUpEvent {
  private static callbacks: Array<(e: MouseEvent, i: Interactions) => void> =
    [];
  private static element: Window | HTMLElement | null = null;
  static attachElement(element: Window | HTMLElement) {
    if (!MouseUpEvent.element) {
      MouseUpEvent.element = element;
      MouseUpEvent.element.addEventListener("mouseup", (e) => {
        for (let i = 0; i < MouseUpEvent.callbacks.length; i++) {
          MouseUpEvent.callbacks[i](e as MouseEvent, interactions);
        }
      });
    }
  }
  static addCallback(callback: (e: MouseEvent, i: Interactions) => void): void {
    MouseUpEvent.callbacks.push(callback);
  }
  static removeCallback(
    callback: (e: MouseEvent, i: Interactions) => void,
  ): void {
    MouseUpEvent.callbacks = MouseUpEvent.callbacks.filter(
      (cb) => cb !== callback,
    );
  }
}

export class MouseMoveEvent {
  private static callbacks: Array<(e: MouseEvent, i: Interactions) => void> =
    [];
  private static element: Window | HTMLElement | null = null;
  static attachElement(element: Window | HTMLElement) {
    if (!MouseMoveEvent.element) {
      MouseMoveEvent.element = element;
      MouseMoveEvent.element.addEventListener("mousemove", (e) => {
        interactions.mouse = { x: e.clientX, y: e.clientY };
        for (let i = 0; i < MouseMoveEvent.callbacks.length; i++) {
          MouseMoveEvent.callbacks[i](e as MouseEvent, interactions);
        }
      });
    }
  }
  static addCallback(callback: (e: MouseEvent, i: Interactions) => void): void {
    MouseMoveEvent.callbacks.push(callback);
  }
  static removeCallback(
    callback: (e: MouseEvent, i: Interactions) => void,
  ): void {
    MouseMoveEvent.callbacks = MouseMoveEvent.callbacks.filter(
      (cb) => cb !== callback,
    );
  }
}

export class MouseScrollEvent {
  private static callbacks: Array<(e: WheelEvent, i: Interactions) => void> =
    [];
  private static element: Window | HTMLElement | null = null;
  static attachElement(element: Window | HTMLElement) {
    if (!MouseScrollEvent.element) {
      MouseScrollEvent.element = element;
      MouseScrollEvent.element.addEventListener("wheel", (e) => {
        for (let i = 0; i < MouseScrollEvent.callbacks.length; i++) {
          MouseScrollEvent.callbacks[i](e as WheelEvent, interactions);
        }
      });
    }
  }
  static addCallback(callback: (e: WheelEvent, i: Interactions) => void): void {
    MouseScrollEvent.callbacks.push(callback);
  }
  static removeCallback(
    callback: (e: WheelEvent, i: Interactions) => void,
  ): void {
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

export class KeyDownEvent {
  private static callbacks: Array<(e: KeyboardEvent, i: Interactions) => void> =
    [];
  private static element: Window | HTMLElement | null = null;
  static attachElement(element: Window | HTMLElement) {
    if (!KeyDownEvent.element) {
      KeyDownEvent.element = element;
      KeyDownEvent.element.addEventListener("keydown", (e) => {
        for (let i = 0; i < KeyDownEvent.callbacks.length; i++) {
          KeyDownEvent.callbacks[i](e as KeyboardEvent, interactions);
        }
      });
    }
  }
  static addCallback(
    callback: (e: KeyboardEvent, i: Interactions) => void,
  ): void {
    KeyDownEvent.callbacks.push(callback);
  }
  static removeCallback(
    callback: (e: KeyboardEvent, i: Interactions) => void,
  ): void {
    KeyDownEvent.callbacks = KeyDownEvent.callbacks.filter(
      (cb) => cb !== callback,
    );
  }
}

export class TouchStartEvent {
  private static callbacks: Array<(e: TouchEvent, i: Interactions) => void> =
    [];
  private static element: Window | HTMLElement | null = null;
  static attachElement(element: Window | HTMLElement) {
    if (!TouchStartEvent.element) {
      TouchStartEvent.element = element;
      TouchStartEvent.element.addEventListener("touchstart", (e) => {
        for (let i = 0; i < TouchStartEvent.callbacks.length; i++) {
          TouchStartEvent.callbacks[i](e as TouchEvent, interactions);
        }
      });
    }
  }
  static addCallback(callback: (e: TouchEvent, i: Interactions) => void): void {
    TouchStartEvent.callbacks.push(callback);
  }
  static removeCallback(
    callback: (e: TouchEvent, i: Interactions) => void,
  ): void {
    TouchStartEvent.callbacks = TouchStartEvent.callbacks.filter(
      (cb) => cb !== callback,
    );
  }
}

export class TouchEndEvent {
  private static callbacks: Array<(e: TouchEvent, i: Interactions) => void> =
    [];
  private static element: Window | HTMLElement | null = null;
  static attachElement(element: Window | HTMLElement) {
    if (!TouchEndEvent.element) {
      TouchEndEvent.element = element;
      TouchEndEvent.element.addEventListener("touchend", (e) => {
        for (let i = 0; i < TouchEndEvent.callbacks.length; i++) {
          TouchEndEvent.callbacks[i](e as TouchEvent, interactions);
        }
      });
    }
  }
  static addCallback(callback: (e: TouchEvent, i: Interactions) => void): void {
    TouchEndEvent.callbacks.push(callback);
  }
  static removeCallback(
    callback: (e: TouchEvent, i: Interactions) => void,
  ): void {
    TouchEndEvent.callbacks = TouchEndEvent.callbacks.filter(
      (cb) => cb !== callback,
    );
  }
}

export class TouchMoveEvent {
  private static callbacks: Array<(e: TouchEvent, i: Interactions) => void> =
    [];
  private static element: Window | HTMLElement | null = null;
  static attachElement(element: Window | HTMLElement) {
    if (!TouchMoveEvent.element) {
      TouchMoveEvent.element = element;
      TouchMoveEvent.element.addEventListener("touchmove", (e) => {
        for (let i = 0; i < TouchMoveEvent.callbacks.length; i++) {
          TouchMoveEvent.callbacks[i](e as TouchEvent, interactions);
        }
      });
    }
  }
  static addCallback(callback: (e: TouchEvent, i: Interactions) => void): void {
    TouchMoveEvent.callbacks.push(callback);
  }
  static removeCallback(
    callback: (e: TouchEvent, i: Interactions) => void,
  ): void {
    TouchMoveEvent.callbacks = TouchMoveEvent.callbacks.filter(
      (cb) => cb !== callback,
    );
  }
}
