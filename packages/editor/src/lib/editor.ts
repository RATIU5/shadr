import { Container, FederatedPointerEvent, FederatedWheelEvent, ICanvas, IRenderer, autoDetectRenderer } from "pixi.js";
import { EventBus } from "./events/event-bus";
import { Grid } from "./graphics/grid/grid";
import { State } from "./state/state";

export type EditorConfig = {
  canvas: HTMLCanvasElement;
};

export type InteractionState = {
  dragDown: boolean;
  zoomFactor: number;
  zoomSensitivity: number;
  minZoom: number;
  maxZoom: number;
  mousePosition: {
    x: number;
    y: number;
  };
  dragStart: {
    x: number;
    y: number;
  };
  dragOffset: {
    x: number;
    y: number;
  };
};

export type EditorEvents = {
  "editor:ready": undefined;
  "editor:pointerDown": FederatedPointerEvent;
  "editor:pointerMove": FederatedPointerEvent;
  "editor:pointerUp": FederatedPointerEvent;
  "editor:wheel": FederatedWheelEvent;
};

export class Editor<VIEW extends ICanvas = ICanvas> {
  renderer: IRenderer<VIEW>;
  eventBus: EventBus<EditorEvents>;
  stage: Container;
  grid: Grid;
  interactionState: State<InteractionState>;

  constructor(config: EditorConfig) {
    this.eventBus = new EventBus();
    this.interactionState = new State({
      dragDown: false,
      zoomFactor: 1,
      zoomSensitivity: 0.025,
      minZoom: 0.5,
      maxZoom: 5,
      mousePosition: {
        x: 0,
        y: 0,
      },
      dragStart: {
        x: 0,
        y: 0,
      },
      dragOffset: {
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
    this.grid = new Grid(config.canvas.clientWidth, config.canvas.clientHeight);
    this.stage.addChild(this.grid.getMesh());

    this.eventBus.emit("editor:ready");
  }

  setupEventListeners() {
    // Setup event emitter for pointer events
    this.stage.on("pointerdown", (event) => {
      this.eventBus.emit("editor:pointerDown", event);
    });
    this.stage.on("pointermove", (event) => {
      this.eventBus.emit("editor:pointerMove", event);
    });
    this.stage.on("pointerup", (event) => {
      this.eventBus.emit("editor:pointerUp", event);
    });
    this.stage.on("wheel", (event) => {
      this.eventBus.emit("editor:wheel", event);
    });

    // Setup actions for emitted events
    this.eventBus.on("editor:pointerDown", (event) => {
      if (event?.button === 1) {
        this.interactionState.set("dragDown", true);
        this.interactionState.set("dragStart", {
          x: event?.clientX ?? 0,
          y: event?.clientY ?? 0,
        });
      }
    });
    this.eventBus.on("editor:pointerUp", () => {
      this.interactionState.set("dragDown", false);
    });
    this.eventBus.on("editor:pointerMove", (event) => {
      if (this.interactionState.get("dragDown")) {
        const deltaX = (event?.clientX ?? 0) - this.interactionState.get("dragStart").x;
        const deltaY = (event?.clientY ?? 0) - this.interactionState.get("dragStart").y;

        this.interactionState.set("dragOffset", {
          x: this.interactionState.get("dragOffset").x + deltaX * this.interactionState.get("zoomFactor"),
          y: this.interactionState.get("dragOffset").y + deltaY * this.interactionState.get("zoomFactor"),
        });

        this.grid.setUniform("u_dragOffset", [
          this.interactionState.get("dragOffset").x,
          this.interactionState.get("dragOffset").y,
        ]);

        this.interactionState.set("dragStart", {
          x: event?.clientX ?? 0,
          y: event?.clientY ?? 0,
        });
      }

      // Render the stage with the new positions
      this.renderer.render(this.stage);
    });
  }

  start() {
    // Actually render the stage to the canvas
    this.renderer.render(this.stage);
  }
}
