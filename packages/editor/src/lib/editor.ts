import { Container, Graphics, ICanvas, IRenderer, autoDetectRenderer } from "pixi.js";
import { EventBus } from "./events/event-bus";
import { BusState, InteractionManager } from "./events/interaction-manager";
import { Grid } from "./graphics/grid/grid";
import { State } from "./state/state";
import { EditorNodeType } from "./nodes/editor-node";

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
    this.stage = new Container();
    this.stage.eventMode = "static";

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

    const nodesContainer = new Container();
    nodesContainer.name = "nodes";

    this.stage.addChild(nodesContainer);

    // Handles all events and interactions with the editor
    // The interaction manager emits events to the event bus
    this.interactionManager = new InteractionManager(this.stage, this.renderer, this.eventBus);

    // Setup grid background and add to stage
    this.grid = new Grid(this.renderer.view.width, this.renderer.view.height);
    this.stage.addChild(this.grid.getMesh());

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
      this.state.get("dragOffset").x += deltaX * this.state.get("zoomFactor");
      this.state.get("dragOffset").y += deltaY * this.state.get("zoomFactor");

      this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);

      this.state.get("dragStart").x = coords.x;
      this.state.get("dragStart").y = coords.y;
    });

    this.eventBus.on("editor:dragX", (amount) => {
      this.state.get("dragOffset").x += amount * this.state.get("zoomFactor");

      this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);
    });

    this.eventBus.on("editor:dragY", (amount) => {
      this.state.get("dragOffset").y += amount * this.state.get("zoomFactor");

      this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);
    });

    this.eventBus.on("editor:zoom", (amount) => {
      this.state.set("zoomFactor", this.state.get("zoomFactor") + amount);
      this.setZoom(this.state.get("zoomFactor"));
    });
  }

  public setZoom(zoom: number) {
    this.state.set("zoomFactor", zoom);

    if (this.state.get("zoomFactor") < 0.5) {
      this.state.set("zoomFactor", 0.5);
    } else if (this.state.get("zoomFactor") > 5) {
      this.state.set("zoomFactor", 5);
    }

    this.grid.setUniform("u_zoom", this.state.get("zoomFactor"));
  }

  public getZoom() {
    return this.state.get("zoomFactor");
  }

  public setOffset(x: number, y: number) {
    this.state.set("dragOffset", { x, y });
    this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);
  }

  public getOffset() {
    return this.state.get("dragOffset");
  }

  public addNode(node: EditorNodeType) {
    const container = new Container();

    const rect = new Graphics();
    rect.lineStyle(0.5, 0xffffff);
    rect.beginFill(0x000000);
    rect.drawRect(
      node.position.x + this.state.get("dragOffset").x,
      node.position.y + this.state.get("dragOffset").y,
      node.size.width,
      node.size.height,
    );
    rect.endFill();

    container.addChild(rect);
    const nodesContainer = this.stage.getChildByName<Container>("nodes");
    nodesContainer?.addChild(container);
    console.log(nodesContainer);
  }

  start() {
    // Actually render the stage to the canvas
    this.renderer.render(this.stage);
    window.requestAnimationFrame(this.start.bind(this));
  }
}
