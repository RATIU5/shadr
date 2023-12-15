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
    this.eventBus = new EventBus();

    // Setup Pixi.js renderer and stage
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
    this.stage.eventMode = "static";

    // Setup grid background and add to stage
    const grid = new Grid(this.eventBus, config.canvas.clientWidth, config.canvas.clientHeight);
    this.stage.addChild(grid.getMesh());

    this.eventBus.emit("editor:ready");
  }

  start() {
    // Actually render the stage to the canvas
    this.renderer.render(this.stage);
  }
}
