import { emit } from "../events/event-bus";
import {
  getInteraction,
  getZoom,
  getZoomSensitivity,
  setZoom,
} from "../state/editor-state";

export function initializeCanvasManager(canvas: HTMLCanvasElement) {
  setupCanvasEventListeners(canvas);
}

function setupCanvasEventListeners(canvas: HTMLCanvasElement) {
  const zoomSensitivity = getZoomSensitivity();

  canvas.addEventListener("wheel", (e) => {
    const currentZoom = getZoom();
    const zoomChangeFactor =
      e.deltaY > 0 ? 1 - zoomSensitivity : 1 + zoomSensitivity;
    setZoom(currentZoom * zoomChangeFactor);
    emit("grid:zoom", getZoom());
  });

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 1) {
      getInteraction().dragIsDown = true;
      getInteraction().dragStart = {
        x: e.clientX,
        y: e.clientY,
      };
    }
  });

  canvas.addEventListener("mouseup", (e) => {
    getInteraction().dragIsDown = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    const interaction = getInteraction();
    if (interaction.dragIsDown) {
      const deltaX = e.clientX - interaction.dragStart.x;
      const deltaY = e.clientY - interaction.dragStart.y;

      interaction.dragOffset.x += deltaX * getZoom();
      interaction.dragOffset.y += deltaY * getZoom();
      emit("grid:drag", [interaction.dragOffset.x, interaction.dragOffset.y]);
      interaction.dragStart = { x: e.clientX, y: e.clientY };
    }
  });
}
