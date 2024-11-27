import { utils } from "@shadr/common";
import { EventBus } from "@shadr/editor-events";
import { Events } from "./types";

/**
 * Handles dragging events.
 */
export class DragHandler {
  #eventBus: EventBus<Events>;
  #spaceDown = utils.createSignal(false);
  #leftMouseDown = utils.createSignal(false);
  #middleMouseDown = utils.createSignal(false);
  #dragStartX = 0;
  #dragStartY = 0;
  #isDragging = false;
  #totalDeltaX = 0;
  #totalDeltaY = 0;
  #persistentOffsetX = 0;
  #persistentOffsetY = 0;

  /**
   * @param eventBus The event bus to emit events on.
   */
  constructor(eventBus: EventBus<Events>) {
    this.#eventBus = eventBus;
  }

  /**
   * Handles a mouse move event for dragging.
   *
   * If the middle mouse button is down or the space key is down and the left mouse button is down,
   * emits a `editor:drag` event with the movement.
   *
   * @param e The mouse move event.
   */
  handleMouseMove(e: MouseEvent) {
    const shouldDrag =
      this.#middleMouseDown.value || (this.#spaceDown.value && this.#leftMouseDown.value);

    if (shouldDrag) {
      if (!this.#isDragging) {
        this.#isDragging = true;
        this.#dragStartX = e.clientX;
        this.#dragStartY = e.clientY;
        return;
      }

      this.#totalDeltaX = this.#persistentOffsetX + (e.clientX - this.#dragStartX);
      this.#totalDeltaY = this.#persistentOffsetY + (e.clientY - this.#dragStartY);
      this.#eventBus.emit("editor:drag", {
        x: this.#totalDeltaX,
        y: this.#totalDeltaY,
      });
    }
  }

  /**
   * Handles a mouse down event for dragging.
   *
   * @param e The mouse down event.
   */
  handleMouseDown(e: MouseEvent) {
    if (e.button === 0) this.#leftMouseDown.value = true;
    if (e.button === 1) this.#middleMouseDown.value = true;
  }

  /**
   * Handles a mouse up event for dragging.
   *
   * @param e The mouse up event.
   */
  handleMouseUp(e: MouseEvent) {
    if (e.button === 0) this.#leftMouseDown.value = false;
    if (e.button === 1) this.#middleMouseDown.value = false;
    if (this.#isDragging) {
      this.#persistentOffsetX = this.#totalDeltaX;
      this.#persistentOffsetY = this.#totalDeltaY;
    }
    this.#isDragging = false;
  }

  /**
   * Handles a key down event for dragging.
   *
   * @param e The key down event.
   */
  handleKeyDown(e: KeyboardEvent) {
    if (e.code === "Space") {
      this.#spaceDown.value = true;
    }
  }

  /**
   * Handles a key up event for dragging.
   *
   * @param e The key up event.
   */
  handleKeyUp(e: KeyboardEvent) {
    if (e.code === "Space") this.#spaceDown.value = false;
    this.#isDragging = false;
  }
}
