import { emit } from "../events/event-bus";
import { state } from "../state/editor-state";

export function initializeCanvasManager(canvas: HTMLCanvasElement) {
  setupCanvasEventListeners(canvas);
}

function setupCanvasEventListeners(canvas: HTMLCanvasElement) {
  canvas.addEventListener("wheel", (e) => {
    state.zoomFactor *=
      e.deltaY > 0 ? 1 - state.zoomSensitivity : 1 + state.zoomSensitivity;
    state.zoomFactor = Math.max(
      state.minZoom,
      Math.min(state.maxZoom, state.zoomFactor)
    );
    emit("grid:scroll", state.zoomFactor);
  });

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 1) {
      state.interaction.dragIsDown = true;
      state.interaction.dragStart = {
        x: e.clientX,
        y: e.clientY,
      };
    }
  });

  canvas.addEventListener("mouseup", (e) => {
    state.interaction.dragIsDown = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (state.interaction.dragIsDown) {
      const deltaX = e.clientX - state.interaction.dragStart.x;
      const deltaY = e.clientY - state.interaction.dragStart.y;

      state.interaction.dragOffset.x += deltaX * state.zoomFactor;
      state.interaction.dragOffset.y += deltaY * state.zoomFactor;
      emit("grid:drag", [
        state.interaction.dragOffset.x,
        state.interaction.dragOffset.y,
      ]);
      state.interaction.dragStart = { x: e.clientX, y: e.clientY };
    }
  });
}
