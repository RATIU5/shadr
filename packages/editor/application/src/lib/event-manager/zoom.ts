import { EventBus } from "@shadr/editor-events";
import { Events, Point } from "./types";
import { World } from "@shadr/editor-core";

export class ZoomHandler {
  readonly #world: World;
  readonly #eventBus: EventBus<Events>;
  readonly #zoomStep = 0.1;

  constructor(eventBus: EventBus<Events>, world: World) {
    this.#world = world;
    this.#eventBus = eventBus;
  }

  handleWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      // Get viewport information
      const viewport = this.#world.getViewport();

      // Convert screen coordinates to viewport-relative coordinates
      const origin: Point = {
        x: e.clientX - viewport.width / 2,
        y: e.clientY - viewport.height / 2,
      };

      // Calculate zoom delta based on wheel direction
      const delta = -Math.sign(e.deltaY) * this.#zoomStep;

      // Apply zoom centered on mouse position in viewport space
      this.#world.zoomBy(delta, origin);

      // Emit zoom event with new scale and viewport-relative origin
      this.#eventBus.emit("editor:zoom", {
        scale: this.#world.getScale(),
        origin,
      });
    }
  }
}
