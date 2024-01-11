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
  state: State<ApplicationState>;
  interactionManager: InteractionManager;

  constructor(config: EditorConfig) {
    this.eventBus = new EventBus();
    this.state = new State<ApplicationState>({
      dragOffset: {
        x: 0,
        y: 0,
      },
      dragStart: {
        x: 0,
        y: 0,
      },
    });

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

    // Handles all events and interactions with the editor
    // The interaction manager emits events to the event bus
    this.interactionManager = new InteractionManager(this.stage, this.renderer, this.eventBus);

    this.#setupEvents();
  }

  #setupEvents() {
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
      this.state.get("dragOffset").x += deltaX;
      this.state.get("dragOffset").y += deltaY;

      this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);

      this.state.get("dragStart").x = coords.x;
      this.state.get("dragStart").y = coords.y;
    });

    this.eventBus.on("editor:dragX", (amount) => {
      this.state.get("dragOffset").x += amount;

      this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);
    });

    this.eventBus.on("editor:dragY", (amount) => {
      this.state.get("dragOffset").y += amount;

      this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);
    });
  }

  public setOffset(x: number, y: number) {
    this.state.set("dragOffset", { x, y });
    this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);
  }

  public getOffset() {
    return this.state.get("dragOffset");
  }

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
