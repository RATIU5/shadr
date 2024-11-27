import { EventBus } from "@shadr/editor-events";
import { RawEvents } from "./types";

/**
 * The main application class for the Shadr editor.
 */
export class Application {
  #eventBus = new EventBus<RawEvents>();
  #canvas: HTMLCanvasElement | null = null;

  constructor() {}

  async init(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    this.#canvas.getContext("webgl2");
  }

  run() {}

  destroy() {}

  /**
   * Handle the resize of the renderer
   */
  handleResize() {
    // renderer.resize({
    //   width: window.innerWidth,
    //   height: window.innerHeight,
    // });
  }

  /**
   * Emits a `raw:keydown` event with the key event object.
   * @param e key event
   */
  handleKeyDown(e: KeyboardEvent) {
    this.#eventBus.emit("raw:keydown", e);
  }

  /**
   * Emits a `raw:keyup` event with the key event object.
   * @param e key event
   */
  handleKeyUp(e: KeyboardEvent) {
    this.#eventBus.emit("raw:keyup", e);
  }

  /**
   * Emits a `raw:mousemove` event with the mouse event object.
   * @param e mouse event
   */
  handleMouseMove(e: MouseEvent) {
    this.#eventBus.emit("raw:mousemove", e);
  }

  /**
   *  Emits a `raw:mousedown` event with the mouse event object.
   * @param e mouse event
   */
  handleMouseDown(e: MouseEvent) {
    this.#eventBus.emit("raw:mousedown", e);
  }

  /**
   * Emits a `raw:mouseup` event with the mouse event object.
   * @param e mouse event
   */
  handleMouseUp(e: MouseEvent) {
    this.#eventBus.emit("raw:mouseup", e);
  }

  /**
   * Emits a `raw:mousewheel` event with the wheel event object.
   * @param e wheel event
   */
  handleMouseWheel(e: WheelEvent) {
    this.#eventBus.emit("raw:mousewheel", e);
  }
}
