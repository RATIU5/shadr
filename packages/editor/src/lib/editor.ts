import { Container, ICanvas, IRenderer, autoDetectRenderer } from "pixi.js";
import { EventBus } from "./events/event-bus";

export type EditorConfig = {
  canvas: HTMLCanvasElement;
};

export class Editor<VIEW extends ICanvas = ICanvas> {
  renderer: IRenderer<VIEW>;
  eventBus: EventBus;
  stage: Container;

  constructor(config: EditorConfig) {
    // Configure Pixi.js rendering engine
    this.renderer = autoDetectRenderer<VIEW>({
      view: config.canvas,
      width: config.canvas.clientWidth,
      height: config.canvas.clientHeight,
    });
    this.stage = new Container();

    this.eventBus = new EventBus();

    this.eventBus.emit("editor:ready");
  }

  start() {
    console.log("Editor started");
  }
}
