import { Container, FederatedPointerEvent, FederatedWheelEvent, ICanvas, IRenderer, autoDetectRenderer } from "pixi.js";
import { EventBus } from "./events/event-bus";
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
  "editor:ready": undefined;
  "editor:dragXY": FederatedPointerEvent;
  "editor:dragX": FederatedPointerEvent;
  "editor:dragY": FederatedPointerEvent;
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

  constructor(config: EditorConfig) {
    this.eventBus = new EventBus();
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

    this.eventBus.emit("editor:ready");
  }

  setupEventListeners(canvas: HTMLCanvasElement) {
    console.log("Setup event listeners");
    // Usage example:
    const eventManager = new EventManager();
    const firstListener = (e: Event) => console.log("LEFT CLICK");
    const fourthListener = (e: Event) => console.log("LEFT CLICK2");
    const secondListener = (e: Event) => console.log("SPACEBAR");
    const thridListener = (e: Event) => console.log("ANY CLICK");

    eventManager.bind("left-click", document, "mousedown", (e) => e.button === 0);
    eventManager.bind("left-click2", document, "mousedown", (e) => e.button === 0);
    eventManager.bind("click", document, "mousedown");
    eventManager.bind("space", document, "keydown", (e) => e.code === "Space");

    eventManager.on("left-click", firstListener);
    eventManager.on("space", secondListener);
    eventManager.on("left-click2", fourthListener);
    eventManager.on("click", thridListener);
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
