import { EventBus } from "@shadr/editor-events";
import { World } from "@shadr/editor-core";
import { utils } from "@shadr/common";
import { Events, Point } from "./types";

/**
 * Handles dragging events.
 */
export class DragHandler {
  readonly #world: World;
  readonly #eventBus: EventBus<Events>;

  // Input state
  readonly #spaceDown = utils.createSignal(false);
  readonly #leftMouseDown = utils.createSignal(false);
  readonly #middleMouseDown = utils.createSignal(false);

  // Drag state
  #isDragging = false;
  #lastPointerPosition: Point | null = null;
  #accumulatedDelta: Point = { x: 0, y: 0 };

  // Trackpad handling
  readonly #wheelTimeout = 150;
  #lastWheelEvent = 0;

  constructor(eventBus: EventBus<Events>, world: World) {
    this.#world = world;
    this.#eventBus = eventBus;
  }

  #startDrag(position: Point) {
    this.#isDragging = true;
    this.#lastPointerPosition = position;
    this.#accumulatedDelta = { x: 0, y: 0 };

    this.#eventBus.emit("editor:dragStart", { ...position });
  }

  #endDrag(position: Point) {
    if (this.#isDragging) {
      this.#isDragging = false;
      this.#lastPointerPosition = null;

      this.#eventBus.emit("editor:dragEnd", { ...position });
    }
  }

  #handleDrag(currentPosition: Point) {
    if (!this.#lastPointerPosition) return;

    // Calculate delta in screen coordinates
    const delta: Point = {
      x: currentPosition.x - this.#lastPointerPosition.x,
      y: currentPosition.y - this.#lastPointerPosition.y,
    };

    // Pan by delta
    this.#world.panBy(delta);

    // Update accumulated delta for continuous dragging
    this.#accumulatedDelta.x += delta.x;
    this.#accumulatedDelta.y += delta.y;

    // Update last position
    this.#lastPointerPosition = currentPosition;

    // Emit drag event with delta
    this.#eventBus.emit("editor:drag", { ...delta });
  }

  // Mouse event handlers
  handleMouseMove(e: MouseEvent) {
    const shouldDrag =
      this.#middleMouseDown.value || (this.#spaceDown.value && this.#leftMouseDown.value);

    if (shouldDrag) {
      const position = { x: e.clientX, y: e.clientY };

      if (!this.#isDragging) {
        this.#startDrag(position);
      } else {
        this.#handleDrag(position);
      }
    }
  }

  handleMouseDown(e: MouseEvent) {
    if (e.button === 0) this.#leftMouseDown.value = true;
    if (e.button === 1) {
      e.preventDefault();
      this.#middleMouseDown.value = true;
    }
  }

  handleMouseUp(e: MouseEvent) {
    const position = { x: e.clientX, y: e.clientY };

    if (e.button === 0) this.#leftMouseDown.value = false;
    if (e.button === 1) this.#middleMouseDown.value = false;

    this.#endDrag(position);
  }

  // Touch event handlers
  handleTouchMove(e: TouchEvent) {
    e.preventDefault();

    if (e.touches.length === 2 && this.#isDragging) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const position = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };

      this.#handleDrag(position);
    }
  }

  handleTouchStart(e: TouchEvent) {
    e.preventDefault();

    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const position = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };

      this.#startDrag(position);
    }
  }

  handleTouchEnd(e: TouchEvent) {
    e.preventDefault();

    if (e.touches.length < 2) {
      const touch = e.touches[0];
      const position = touch
        ? { x: touch.clientX, y: touch.clientY }
        : (this.#lastPointerPosition ?? { x: 0, y: 0 });

      this.#endDrag(position);
    }
  }

  // Trackpad handling
  handleWheel(e: WheelEvent) {
    if (this.#isTrackpadGesture(e)) {
      e.preventDefault();

      const position = { x: e.clientX, y: e.clientY };

      if (!this.#isDragging) {
        this.#startDrag(position);
      }

      this.#handleDrag({
        x: position.x - e.deltaX,
        y: position.y - e.deltaY,
      });

      // Handle trackpad gesture end detection
      this.#lastWheelEvent = Date.now();
      setTimeout(() => {
        if (Date.now() - this.#lastWheelEvent > this.#wheelTimeout) {
          this.#endDrag(position);
        }
      }, this.#wheelTimeout);
    }
  }

  // Keyboard handlers
  handleKeyDown(e: KeyboardEvent) {
    if (e.code === "Space") this.#spaceDown.value = true;
  }

  handleKeyUp(e: KeyboardEvent) {
    if (e.code === "Space") {
      this.#spaceDown.value = false;
      if (this.#isDragging) {
        this.#endDrag(this.#lastPointerPosition ?? { x: 0, y: 0 });
      }
    }
  }

  #isTrackpadGesture(e: WheelEvent): boolean {
    return (
      !e.ctrlKey &&
      !e.metaKey &&
      Math.abs(e.deltaX) < 50 &&
      Math.abs(e.deltaY) < 50 &&
      e.deltaMode === 0
    );
  }
}
