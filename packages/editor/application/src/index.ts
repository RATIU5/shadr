import { createRenderer } from "@shadr/editor-renderer";
import { createEventBus } from "@shadr/editor-events";
import { createGrid } from "@shadr/editor-grid";
import { types } from "@shadr/common";

export const createApplication = async (
  options?: types.Editor.Application.SetupOptions
) => {
  const eventBus = createEventBus<types.Editor.Application.Events>();
  const renderer = await createRenderer({
    width: options?.width ?? 500,
    height: options?.height ?? 500,
  });
  const grid = createGrid({
    renderer,
    eventBus,
  });

  return {
    /**
     * Run the Shadr application
     */
    run() {
      grid.render();
    },

    /**
     * Destroy the application
     */
    destroy() {
      renderer.destroy();
    },

    /**
     * Get the canvas element of the renderer
     */
    get canvas() {
      return renderer.canvas;
    },

    /**
     * Handle the resize of the renderer
     */
    handleResize() {
      renderer.resize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    },

    /**
     * Emits a `raw:keydown` event with the key event.
     * @param e key event
     */
    handleKeyDown(e: KeyboardEvent) {
      eventBus.emit("raw:keydown", e);
    },

    /**
     * Emits a `raw:keyup` event with the key event.
     * @param e key event
     */
    handleKeyUp(e: KeyboardEvent) {
      eventBus.emit("raw:keyup", e);
    },

    /**
     * Emits a `raw:mousemove` event with the mouse event.
     * @param e mouse event
     */
    handleMouseMove(e: MouseEvent) {
      eventBus.emit("raw:mousemove", e);
    },

    /**
     *  Emits a `raw:mousedown` event with the mouse event.
     * @param e mouse event
     */
    handleMouseDown(e: MouseEvent) {
      eventBus.emit("raw:mousedown", e);
    },

    /**
     * Emits a `raw:mouseup` event with the mouse event.
     * @param e mouse event
     */
    handleMouseUp(e: MouseEvent) {
      eventBus.emit("raw:mouseup", e);
    },

    /**
     * Emits a `raw:mousewheel` event with the wheel event.
     * @param e wheel event
     */
    handleMouseWheel(e: WheelEvent) {
      eventBus.emit("raw:mousewheel", e);
    },
  };
};
