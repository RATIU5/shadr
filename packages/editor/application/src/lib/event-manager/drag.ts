import { EventBus } from "@shadr/editor-events";
import { World } from "@shadr/editor-core";
import { utils } from "@shadr/common";
import { Events } from "./types";

/**
 * Handles dragging events.
 */
export class DragHandler {
  #world: World;
  #eventBus: EventBus<Events>;
  #spaceDown = utils.createSignal(false);
  #leftMouseDown = utils.createSignal(false);
  #middleMouseDown = utils.createSignal(false);
  #lastPointerPosition = { x: 0, y: 0 };
  #isDragging = false;
  #lastWheelEvent = 0;

  constructor(eventBus: EventBus<Events>, world: World) {
    this.#eventBus = eventBus;
    this.#world = world;
  }

  #handleDrag(currentX: number, currentY: number) {
    const position = this.#world.getPosition();
    const newX = position.x + (currentX - this.#lastPointerPosition.x);
    const newY = position.y + (currentY - this.#lastPointerPosition.y);

    this.#lastPointerPosition = { x: currentX, y: currentY };
    this.#world.setPosition(newX, newY);
    this.#eventBus.emit("editor:drag", { x: newX, y: newY });
  }

  handleMouseMove(e: MouseEvent) {
    const shouldDrag =
      this.#middleMouseDown.value || (this.#spaceDown.value && this.#leftMouseDown.value);

    if (shouldDrag) {
      if (!this.#isDragging) {
        this.#isDragging = true;
        this.#lastPointerPosition = { x: e.clientX, y: e.clientY };
        return;
      }
      this.#handleDrag(e.clientX, e.clientY);
    }
  }

  handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 2 && this.#isDragging) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentX = (touch1.clientX + touch2.clientX) / 2;
      const currentY = (touch1.clientY + touch2.clientY) / 2;
      this.#handleDrag(currentX, currentY);
    }
  }

  handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      this.#lastPointerPosition = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
      this.#isDragging = true;
    }
  }

  handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1) {
      this.#isDragging = false;
    }
  }

  handleWheel(e: WheelEvent) {
    if (this.#isTrackpadGesture(e)) {
      e.preventDefault();
      this.#handleDrag(
        this.#lastPointerPosition.x - e.deltaX,
        this.#lastPointerPosition.y - e.deltaY
      );

      this.#lastWheelEvent = Date.now();
      setTimeout(() => {
        if (Date.now() - this.#lastWheelEvent > 100) {
          this.#isDragging = false;
        }
      }, 150);
    }
  }

  handleMouseDown(e: MouseEvent) {
    if (e.button === 0) this.#leftMouseDown.value = true;
    if (e.button === 1) this.#middleMouseDown.value = true;
  }

  handleMouseUp(e: MouseEvent) {
    if (e.button === 0) this.#leftMouseDown.value = false;
    if (e.button === 1) this.#middleMouseDown.value = false;
    this.#isDragging = false;
  }

  handleKeyDown(e: KeyboardEvent) {
    if (e.code === "Space") this.#spaceDown.value = true;
  }

  handleKeyUp(e: KeyboardEvent) {
    if (e.code === "Space") this.#spaceDown.value = false;
    this.#isDragging = false;
  }

  #isTrackpadGesture(e: WheelEvent) {
    return (
      !e.ctrlKey &&
      !e.metaKey &&
      Math.abs(e.deltaX) < 50 &&
      Math.abs(e.deltaY) < 50 &&
      e.deltaMode === 0
    );
  }
}
