import { Container, ICanvas, IRenderer, Renderer, autoDetectRenderer } from "pixi.js";
import { Grid } from "./graphics/grid/grid";
import { EventBus } from "./events/event-bus";
import { BusState, InteractionManager } from "./events/interaction-manager";
import { State } from "./state/state";

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
  state: State<ApplicationState>;
  interactionManager: InteractionManager;

  constructor(config: EditorConfig) {
    this.state = new State<ApplicationState>({
      zoomFactor: 1,
      dragOffset: {
        x: 0,
        y: 0,
      },
      dragStart: {
        x: 0,
        y: 0,
      },
    });
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

    // Handles all events and interactions with the editor
    this.interactionManager = new InteractionManager(this.stage, this.renderer, this.eventBus);

    // Setup grid background and add to stage
    this.grid = new Grid(this.renderer.view.width, this.renderer.view.height);
    this.stage.addChild(this.grid.getMesh());

    // Setup event handlers
    this.setupEvents();
  }

  setupEvents() {
    // Event bus handlers
    // After effects may happen here
    this.eventBus.on("keydown:space", (value) => {
      if (this.renderer.view.style) {
        this.renderer.view.style.cursor = value ? "grab" : "default";
      }
    });

    this.eventBus.on("mousedown:middle", (value) => {
      if (this.renderer.view.style) {
        this.renderer.view.style.cursor = value ? "grab" : "default";
      }
    });

    this.eventBus.on("editor:dragDown", (coords) => {
      this.state.get("dragStart").x = coords.x;
      this.state.get("dragStart").y = coords.y;
    });

    this.eventBus.on("editor:dragXY", (coords) => {
      const deltaX = coords.x - this.state.get("dragStart").x;
      const deltaY = coords.y - this.state.get("dragStart").y;
      this.state.get("dragOffset").x += deltaX * this.state.get("zoomFactor");
      this.state.get("dragOffset").y += deltaY * this.state.get("zoomFactor");

      // Update grid offset uniform
      this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);
      this.renderer.render(this.stage);

      this.state.get("dragStart").x = coords.x;
      this.state.get("dragStart").y = coords.y;
    });

    this.eventBus.on("editor:dragX", (amount) => {
      this.state.get("dragOffset").x += amount * this.state.get("zoomFactor");

      // Update grid offset uniform
      this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);
      this.renderer.render(this.stage);
    });

    this.eventBus.on("editor:dragY", (amount) => {
      this.state.get("dragOffset").y += amount * this.state.get("zoomFactor");

      // Update grid offset uniform
      this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);
      this.renderer.render(this.stage);
    });
  }

  start() {
    // Actually render the stage to the canvas
    this.renderer.render(this.stage);
  }
}
