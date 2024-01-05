import { Container, Graphics, ICanvas, IRenderer, autoDetectRenderer } from "pixi.js";
import { EventBus } from "./events/event-bus";
import { BusState, InteractionManager } from "./events/interaction-manager";
import { Grid } from "./graphics/grid/grid";
import { State } from "./state/state";
import { Viewport } from "pixi-viewport";
import { EditorNode, EditorNodeType } from "./nodes/editor-node";
import { CustomWheelDrag } from "./viewport/scroll";
import { CustomDragPlugin } from "./viewport/drag";

export type EditorConfig = {
  canvas: HTMLCanvasElement;
};

export type ApplicationState = {
  zoomFactor: number;
  dragOffset: {
    x: number;
    y: number;
  };
  dragStart: {
    x: number;
    y: number;
  };
};

export class Editor<VIEW extends ICanvas = ICanvas> {
  renderer: IRenderer<VIEW>;
  stage: Container;
  grid: Grid;
  eventBus: EventBus<BusState>;
  viewport: Viewport;

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

    this.viewport = new Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth: 1000,
      worldHeight: 1000,

      events: this.renderer.events,
    });

    this.grid = new Grid(this.renderer.view.width, this.renderer.view.height);

    this.stage = new Container();
    this.stage.eventMode = "static";
    this.stage.addChild(this.grid.getMesh());
    this.stage.addChild(this.viewport);

    // Viewport plugins
    this.viewport.plugins.add("scroll", new CustomWheelDrag(this.viewport), 1);
    this.viewport.plugins.add("drag", new CustomDragPlugin(this.viewport), 2);
    this.viewport.clampZoom({
      minScale: 0.5,
      maxScale: 5,
    });

    this.#setupEvents();
  }

  #setupEvents() {}

  public addNode(node: EditorNodeType) {
    const editorNode = new EditorNode(node);
    this.viewport.addChild(editorNode.get());
  }

  start() {
    // Actually render the stage to the canvas
    this.renderer.render(this.stage);
    window.requestAnimationFrame(this.start.bind(this));
  }
}
