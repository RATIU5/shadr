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
  gridOffset: {
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
      gridOffset: {
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

    this.eventBus.on("editor:dragXY", (coords) => {
      const deltaX = coords.x - this.state.get("dragStart").x;
      const deltaY = coords.y - this.state.get("dragStart").y;
      this.state.set("gridOffset", {
        x: this.state.get("gridOffset").x + deltaX * this.state.get("zoomFactor"),
        y: this.state.get("gridOffset").y + deltaY * this.state.get("zoomFactor"),
      });

      this.grid.setUniform("u_offset", [this.state.get("gridOffset").x, this.state.get("gridOffset").y]);
      this.renderer.render(this.stage);

      this.state.set("dragStart", {
        x: coords.x,
        y: coords.y,
      });
    });

    // this.stage.on("keydown", (event: KeyboardEvent) => {
    //   console.log("spaceDown");
    //   if (event.code === "Space") {
    //     this.interactionState.set("spaceDown", true);
    //   }
    // });
    // this.stage.on("keyup", (event) => {
    //   if (event.code === "Space") {
    //     this.interactionState.set("spaceDown", false);
    //   }
    // });
    // this.stage.on("mousedown", (event) => {
    //   if (event.button === 0) {
    //     this.interactionState.set("leftMouseDown", true);
    //   } else if (event.button === 1) {
    //     this.interactionState.set("middleMouseDown", true);
    //   }
    // });
    // this.stage.on("mousemove", (event) => {
    //   if (
    //     this.interactionState.get("middleMouseDown") ||
    //     (this.interactionState.get("leftMouseDown") && this.interactionState.get("spaceDown"))
    //   ) {
    //     const deltaX = (event?.clientX ?? 0) - this.interactionState.get("dragStart").x;
    //     const deltaY = (event?.clientY ?? 0) - this.interactionState.get("dragStart").y;
    //     this.interactionState.set("gridOffset", {
    //       x: this.interactionState.get("gridOffset").x + deltaX * this.interactionState.get("zoomFactor"),
    //       y: this.interactionState.get("gridOffset").y + deltaY * this.interactionState.get("zoomFactor"),
    //     });
    //     this.eventBus.emit("editor:dragXY", event);
    //     this.interactionState.set("dragStart", {
    //       x: event?.clientX ?? 0,
    //       y: event?.clientY ?? 0,
    //     });
    //   }
    // });
    // this.stage.on("mouseup", (event) => {
    //   if (event.button === 0) {
    //     this.interactionState.set("leftMouseDown", false);
    //   } else if (event.button === 1) {
    //     this.interactionState.set("middleMouseDown", false);
    //   }
    // });
    // this.stage.on("wheel", (event) => {});
    // this.stage.on("touchstart", (event) => {});
    // this.stage.on("touchmove", (event) => {});
    // this.stage.on("touchend", (event) => {});
    // this.eventBus.on("editor:dragXY", () => {
    //   console.log("dragXY");
    //   this.grid.setUniform("u_offset", [
    //     this.interactionState.get("gridOffset").x,
    //     this.interactionState.get("gridOffset").y,
    //   ]);
    // });
    // this.eventBus.on("editor:dragX", () => {});
    // this.eventBus.on("editor:dragY", () => {});
  }

  start() {
    // Actually render the stage to the canvas
    this.renderer.render(this.stage);
  }
}
