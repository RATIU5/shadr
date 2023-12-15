import { Renderer } from "pixi.js";

export type EditorConfig = {
  canvas: HTMLCanvasElement;
};

export class Editor {
  renderer: Renderer;

  constructor(config: EditorConfig) {
    this.renderer = new Renderer({
      view: config.canvas,
      width: config.canvas.clientWidth,
      height: config.canvas.clientHeight,
    });
  }

  start() {
    console.log("Editor started");
  }
}
