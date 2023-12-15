import { Container, ICanvas, IRenderer, autoDetectRenderer } from "pixi.js";
import { EventBus } from "./events/event-bus";
import { Grid } from "./graphics/grid/grid";

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
      autoDensity: true,
      antialias: true,
      backgroundColor: 0x1a1b1c,
      resolution: window.devicePixelRatio || 1,
    });
    this.stage = new Container();

    const grid = new Grid(config.canvas.clientWidth, config.canvas.clientHeight);
    this.stage.addChild(grid.getMesh());

    this.eventBus = new EventBus();

    this.eventBus.emit("editor:ready");
  }

  start() {
    console.log("Editor started");
    this.renderer.render(this.stage);
  }
}
