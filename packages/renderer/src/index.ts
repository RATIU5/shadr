import {Application} from "pixi.js"

export type EditorConfig = {
  canvas: HTMLCanvasElement;
};

export class Editor {
  application: Application;

  constructor(config: EditorConfig) {
    this.application = new Application({
      view: config.canvas,
      width: config.canvas.clientWidth,
      height: config.canvas.clientHeight,
      autoDensity: true,
      antialias: true,
      backgroundColor: 0x1a1b1c,
      resolution: window.devicePixelRatio || 1,
    });
  }

  start() {
    this.application.ticker.add(() => {
      this.application.renderer.render(this.application.stage);
    });
  }
}