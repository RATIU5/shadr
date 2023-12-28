import { Container, IRenderer } from "pixi.js";
import { EventBus } from "./event-bus";
import { Signal, createSignal } from "../utils/signal";

export type InteractionState = {
  spaceDown: Signal<boolean>;
  leftMouseDown: Signal<boolean>;
  middleMouseDown: Signal<boolean>;
};

export type BusState = {
  "keydown:space": boolean;
  "mousedown:middle": boolean;
  "mousedown:right": boolean;
  "editor:dragXY": {
    x: number;
    y: number;
  };
  "editor:dragDown": {
    x: number;
    y: number;
  };
  "editor:dragX": number;
  "editor:dragY": number;
};

export class InteractionManager {
  stage: Container;
  renderer: IRenderer;
  state: InteractionState;
  eventBus: EventBus<BusState>;

  constructor(stage: Container, renderer: IRenderer, eventBus: EventBus<BusState>) {
    this.stage = stage;
    this.renderer = renderer;
    this.state = {
      spaceDown: createSignal(false),
      leftMouseDown: createSignal(false),
      middleMouseDown: createSignal(false),
    };
    this.eventBus = eventBus;

    this.initEventListeners();
    this.initBusEvents();
  }

  initEventListeners() {
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
    document.addEventListener("keyup", this.handleKeyUp.bind(this));
    this.stage.on("mousedown", this.handleMouseDown.bind(this));
    this.stage.on("mouseup", this.handleMouseUp.bind(this));
    document.addEventListener("mousemove", this.handleMouseMove.bind(this));
    document.addEventListener("contextmenu", (event) => event.preventDefault());
    document.addEventListener("wheel", this.handleMouseWheel.bind(this));
  }

  initBusEvents() {
    this.state.spaceDown.sub((value) => {
      this.eventBus.emit("keydown:space", value);
    });
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.code === "Space") {
      this.state.spaceDown.set(true);
    }
  }

  handleKeyUp(event: KeyboardEvent) {
    if (event.code === "Space") {
      this.state.spaceDown.set(false);
    }
  }

  handleMouseDown(event: MouseEvent) {
    if (event.button === 0) {
      this.state.leftMouseDown.set(true);

      if (this.state.spaceDown.get()) {
        this.eventBus.emit("editor:dragDown", {
          x: event.clientX,
          y: event.clientY,
        });
      }
    } else if (event.button === 1) {
      this.state.middleMouseDown.set(true);
      this.eventBus.emit("mousedown:middle", true);
      this.eventBus.emit("editor:dragDown", {
        x: event.clientX,
        y: event.clientY,
      });
    } else if (event.button === 2) {
      this.eventBus.emit("mousedown:right", true);
    }
  }

  handleMouseUp(event: MouseEvent) {
    if (event.button === 0) {
      this.state.leftMouseDown.set(false);
    } else if (event.button === 1) {
      this.state.middleMouseDown.set(false);
      this.eventBus.emit("mousedown:middle", false);
    } else if (event.button === 2) {
      this.eventBus.emit("mousedown:right", false);
    }
  }

  handleMouseMove(event: MouseEvent) {
    if (this.state.leftMouseDown.get() && this.state.spaceDown.get()) {
      this.eventBus.emit("editor:dragXY", {
        x: event.clientX,
        y: event.clientY,
      });
    } else if (this.state.middleMouseDown.get()) {
      this.eventBus.emit("editor:dragXY", {
        x: event.clientX,
        y: event.clientY,
      });
    }
  }

  handleMouseWheel(event: WheelEvent) {
    const dragDir = event.shiftKey ? "editor:dragX" : "editor:dragY";

    if (event.shiftKey) {
      this.eventBus.emit("editor:dragX", 10 * (event.deltaX / 100));
    } else {
      this.eventBus.emit("editor:dragY", 10 * (event.deltaY / 100));
    }
  }
}
