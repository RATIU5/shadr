import { EventBus } from "@shadr/editor-events";
import { Events } from "./types";
import { DragHandler } from "./drag";

export class EventManager {
  #dragHandler: DragHandler | null = null;
  #eventBus: EventBus<Events>;

  constructor(eventBus: EventBus<Events>) {
    this.#eventBus = eventBus;
    this.#dragHandler = new DragHandler(this.#eventBus);
  }

  /**
   * Emits a `raw:keydown` event with the key event object.
   * @param e key event
   */
  handleKeyDown(e: KeyboardEvent) {
    this.#eventBus.emit("raw:keydown", e);
    this.#dragHandler?.handleKeyDown(e);
  }

  /**
   * Emits a `raw:keyup` event with the key event object.
   * @param e key event
   */
  handleKeyUp(e: KeyboardEvent) {
    this.#eventBus.emit("raw:keyup", e);
    this.#dragHandler?.handleKeyUp(e);
  }

  /**
   * Emits a `raw:mousemove` event with the mouse event object.
   * @param e mouse event
   */
  handleMouseMove(e: MouseEvent) {
    this.#eventBus.emit("raw:mousemove", e);
    this.#dragHandler?.handleMouseMove(e);
  }

  /**
   *  Emits a `raw:mousedown` event with the mouse event object.
   * @param e mouse event
   */
  handleMouseDown(e: MouseEvent) {
    this.#eventBus.emit("raw:mousedown", e);
    this.#dragHandler?.handleMouseDown(e);
  }

  /**
   * Emits a `raw:mouseup` event with the mouse event object.
   * @param e mouse event
   */
  handleMouseUp(e: MouseEvent) {
    this.#eventBus.emit("raw:mouseup", e);
    this.#dragHandler?.handleMouseUp(e);
  }

  /**
   * Emits a `raw:mousewheel` event with the wheel event object.
   * @param e wheel event
   */
  handleMouseWheel(e: WheelEvent) {
    this.#eventBus.emit("raw:mousewheel", e);
  }
}
