import { Renderer } from "pixi.js";
import { EventBus } from "./events/event-bus";

export type EditorConfig = {
  canvas: HTMLCanvasElement;
};

export class Editor {
  renderer: Renderer;
  eventBus: EventBus;

  constructor(config: EditorConfig) {
    this.renderer = new Renderer({
      view: config.canvas,
      width: config.canvas.clientWidth,
      height: config.canvas.clientHeight,
    });

    this.eventBus = new EventBus();

    this.eventBus.emit("editor:ready");
  }

  start() {
    console.log("Editor started");
  }
}
