import { EventBus } from "@shadr/editor-events";
import { Events } from "./types";
import { World } from "@shadr/editor-core";

export class ZoomHandler {
  #eventBus: EventBus<Events>;
  #world: World;
  #zoomStep = 0.05;
  readonly #minZoom = 0.1;
  readonly #maxZoom = 20.0;

  constructor(eventBus: EventBus<Events>, world: World) {
    this.#world = world;
    this.#eventBus = eventBus;
  }

  handleWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      const currentZoom = this.#world.getZoom();
      const delta = -Math.sign(e.deltaY) * this.#zoomStep;

      // Calculate new zoom level
      const newZoom = Math.max(
        this.#minZoom,
        Math.min(this.#maxZoom, currentZoom * (1 + delta))
      );

      if (this.#world.setZoom(newZoom)) {
        // Get current offset
        const currentOffset = this.#world.getDragOffset();

        // Calculate how much the offset needs to change to maintain position
        // This is the key difference - we adjust the offset based on zoom change
        const zoomFactor = 1 - newZoom / currentZoom;
        const offsetX = currentOffset.x * zoomFactor;
        const offsetY = currentOffset.y * zoomFactor;

        // Apply the new offset
        this.#world.setDragOffset(currentOffset.x + offsetX, currentOffset.y + offsetY);

        this.#eventBus.emit("editor:zoom", {
          scale: newZoom,
          offset: { x: currentOffset.x + offsetX, y: currentOffset.y + offsetY },
        });
      }
    }
  }
}
