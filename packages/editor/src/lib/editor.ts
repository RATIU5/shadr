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
  "editor:mouseDown": FederatedPointerEvent;
  "editor:mouseMove": FederatedPointerEvent;
  "editor:mouseUp": FederatedPointerEvent;
  "editor:wheel": FederatedWheelEvent;
};

export class Editor<VIEW extends ICanvas = ICanvas> {
  renderer: IRenderer<VIEW>;
  eventBus: EventBus<EditorEvents>;
  stage: Container;
  grid: Grid;
  interactionState: State<InteractionState>;
  initialDistance: number;

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
    this.initialDistance = 0;

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
    this.grid = new Grid(this.renderer.view.width, this.renderer.view.height);
    this.stage.addChild(this.grid.getMesh());

    this.eventBus.emit("editor:ready");
  }

  setupEventListeners() {
    // Setup event emitter for pointer events
    this.stage.on("mousedown", (event) => {
      this.eventBus.emit("editor:mouseDown", event);
    });
    this.stage.on("mousemove", (event) => {
      this.eventBus.emit("editor:mouseMove", event);
    });
    this.stage.on("mouseup", (event) => {
      this.eventBus.emit("editor:mouseUp", event);
    });
    this.stage.on("wheel", (event) => {
      this.eventBus.emit("editor:wheel", event);
    });

    // Setup actions for emitted events
    this.eventBus.on("editor:mouseDown", (event) => {
      if (event?.button === 1) {
        this.interactionState.set("dragDown", true);
        this.interactionState.set("dragStart", {
          x: event?.clientX ?? 0,
          y: event?.clientY ?? 0,
        });
      }
    });
    this.eventBus.on("editor:mouseUp", () => {
      this.interactionState.set("dragDown", false);
    });
    this.eventBus.on("editor:mouseMove", (event) => {
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
    this.eventBus.on("editor:wheel", (event) => {
      const zoomSens = this.interactionState.get("zoomSensitivity");
      let currentZoom = this.interactionState.get("zoomFactor");

      if ((event?.deltaY ?? 0) > 0) {
        currentZoom *= 1 - zoomSens;
      } else {
        currentZoom *= 1 + zoomSens;
      }

      currentZoom = Math.max(
        this.interactionState.get("minZoom"),
        Math.min(this.interactionState.get("maxZoom"), currentZoom),
      );
      this.interactionState.set("zoomFactor", currentZoom);

      this.grid.setUniform("u_zoom", this.interactionState.get("zoomFactor"));
      this.renderer.render(this.stage);
    });
  }

  start() {
    // Actually render the stage to the canvas
    this.renderer.render(this.stage);
  }
}
