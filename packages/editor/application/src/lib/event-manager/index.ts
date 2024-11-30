import { EventBus } from "@shadr/editor-events";
import { World } from "@shadr/editor-core";
import { DragHandler } from "./drag";
import { ZoomHandler } from "./zoom";
import { Events } from "./types";

export class EventManager {
  #eventBus: EventBus<Events>;
  #world: World;
  #dragHandler: DragHandler | null = null;
  #zoomHandler: ZoomHandler | null = null;

  constructor(eventBus: EventBus<Events>, world: World) {
    this.#eventBus = eventBus;
    this.#world = world;
    this.#dragHandler = new DragHandler(this.#eventBus, this.#world);
    this.#zoomHandler = new ZoomHandler(this.#eventBus, this.#world);
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
    this.#dragHandler?.handleWheel(e);
    this.#zoomHandler?.handleWheel(e);
  }

  handleTouchStart(e: TouchEvent) {
    this.#eventBus.emit("raw:touchstart", e);
    this.#dragHandler?.handleTouchStart(e);
  }

  handleTouchMove(e: TouchEvent) {
    this.#eventBus.emit("raw:touchmove", e);
    this.#dragHandler?.handleTouchMove(e);
  }

  handleTouchEnd(e: TouchEvent) {
    this.#eventBus.emit("raw:touchend", e);
    this.#dragHandler?.handleTouchEnd(e);
  }
}
