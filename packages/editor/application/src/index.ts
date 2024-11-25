import { ShadrRenderer } from "@shadr/editor-renderer";
import { EventBus } from "@shadr/editor-events";
import { types } from "@shadr/common";

export class ShadrApplication {
  #renderer: ShadrRenderer | null = null;
  #eventBus: EventBus<types.Application.Events> | null = null;

  constructor(options?: types.Application.SetupOptions) {
    this.#renderer = new ShadrRenderer({
      width: options?.width ?? 500,
      height: options?.height ?? 500,
    });
    this.#eventBus = new EventBus();
  }

  run() {}

  destroy() {}

  canvas() {
    if (!this.#renderer) {
      throw new Error("Renderer not initialized");
    }
    return this.#renderer.canvas();
  }

  handleResize() {
    this.#renderer?.resize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  handleKeyDown(e: KeyboardEvent) {
    this.#eventBus?.emit("raw:keydown", e);
  }

  handleKeyUp(e: KeyboardEvent) {
    this.#eventBus?.emit("raw:keyup", e);
  }

  handleMouseMove(e: MouseEvent) {
    this.#eventBus?.emit("raw:mousemove", e);
  }

  handleMouseDown(e: MouseEvent) {
    this.#eventBus?.emit("raw:mousedown", e);
  }

  handleMouseUp(e: MouseEvent) {
    this.#eventBus?.emit("raw:mouseup", e);
  }

  handleMouseWheel(e: WheelEvent) {
    this.#eventBus?.emit("raw:mousewheel", e);
  }
}
