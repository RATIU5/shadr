import { EventBus } from "@shadr/editor-events";
import { Events } from "./types";
import { World } from "@shadr/editor-core";

export class ZoomHandler {
  #eventBus: EventBus<Events>;
  #world: World;
  #zoomStep = 0.05;

  constructor(eventBus: EventBus<Events>, world: World) {
    this.#world = world;
    this.#eventBus = eventBus;
  }

  handleWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      const currentZoom = this.#world.getZoom();
      const delta = -Math.sign(e.deltaY) * this.#zoomStep;
      const newZoom = currentZoom * (1 + delta);

      if (this.#world.setZoom(newZoom)) {
        // Use window dimensions instead
        this.#eventBus.emit("editor:zoom", {
          scale: newZoom,
          position: {
            x: e.clientX / window.innerWidth,
            y: 1.0 - e.clientY / window.innerHeight,
          },
        });
      }
    }
  }
}
