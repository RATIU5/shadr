import { Container, FederatedPointerEvent, FederatedWheelEvent, ICanvas, IRenderer, autoDetectRenderer } from "pixi.js";
import { Grid } from "./graphics/grid/grid";
import { State } from "./state/state";
import { EventManager } from "./events/event-manager";

export type EditorConfig = {
  canvas: HTMLCanvasElement;
};

export type InteractionState = {
  spaceDown: boolean;
  leftMouseDown: boolean;
  middleMouseDown: boolean;
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
  gridOffset: {
    x: number;
    y: number;
  };
};

export type EditorEvents = {
  "editor:space-down": boolean;
};

export class Editor<VIEW extends ICanvas = ICanvas> {
  renderer: IRenderer<VIEW>;
  stage: Container;
  grid: Grid;
  eventManager: EventManager<EditorEvents>;
  interactionState: State<InteractionState>;

  constructor(config: EditorConfig) {
    this.interactionState = new State({
      spaceDown: false,
      leftMouseDown: false,
      middleMouseDown: false,
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
      gridOffset: {
        x: 0,
        y: 0,
      },
    });

    this.eventManager = new EventManager();

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

    this.setupEventListeners(config.canvas);

    // Setup grid background and add to stage
    this.grid = new Grid(this.renderer.view.width, this.renderer.view.height);
    this.stage.addChild(this.grid.getMesh());
  }

  setupEventListeners(canvas: HTMLCanvasElement) {
    this.eventManager.bind("editor:space-down", document, "keydown", {
      filter: (event: KeyboardEvent) => event.code === "Space",
    });

    this.eventManager.on("editor:space-down", (data?: boolean) => {
      console.log("spaceDown", data);
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
