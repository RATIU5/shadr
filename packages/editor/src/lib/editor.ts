import { Container, FederatedPointerEvent, ICanvas, IRenderer, autoDetectRenderer } from "pixi.js";
import { EventBus } from "./events/event-bus";
import { Grid } from "./graphics/grid/grid";
import { State } from "./state/state";

export type EditorConfig = {
  canvas: HTMLCanvasElement;
};

export type InteractionState = {
  mouseDown: boolean;
  mousePosition: {
    x: number;
    y: number;
  };
};

export type EditorEvents = {
  "editor:ready": undefined;
  "editor:mouseDown": FederatedPointerEvent;
  "editor:mouseMove": FederatedPointerEvent;
  "editor:mouseUp": FederatedPointerEvent;
};

export class Editor<VIEW extends ICanvas = ICanvas> {
  renderer: IRenderer<VIEW>;
  eventBus: EventBus<EditorEvents>;
  stage: Container;
  interactionState: State<InteractionState>;

  constructor(config: EditorConfig) {
    this.eventBus = new EventBus();
    this.interactionState = new State({
      mouseDown: false,
      mousePosition: {
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
    this.stage = new Container();
    this.stage.eventMode = "static";

    this.setupEventListeners();

    // Setup grid background and add to stage
    const grid = new Grid(config.canvas.clientWidth, config.canvas.clientHeight);
    this.stage.addChild(grid.getMesh());

    this.eventBus.emit("editor:ready");
  }

  setupEventListeners() {
    this.stage.on("pointerdown", (event) => {
      this.eventBus.emit("editor:mouseDown", event);
    });
    this.stage.on("pointermove", (event) => {
      this.eventBus.emit("editor:mouseMove", event);
    });
    this.stage.on("pointerup", (event) => {
      this.eventBus.emit("editor:mouseUp", event);
    });

    this.eventBus.on("editor:mouseDown", (event) => {
      this.interactionState.set("mouseDown", true);
      this.interactionState.set("mousePosition", {
        x: event?.clientX ?? 0,
        y: event?.clientY ?? 0,
      });
      console.log("mouseDown", this.interactionState.get("mousePosition"));
    });
  }

  start() {
    // Actually render the stage to the canvas
    this.renderer.render(this.stage);
  }
}
