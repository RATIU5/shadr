import { Application, IApplicationOptions } from 'pixi.js';

export class Renderer {
  canvas: HTMLCanvasElement;
  app: Application;
  constructor(
    canvas: HTMLCanvasElement,
    pixiConfig?: Partial<Omit<IApplicationOptions, 'view' | 'width' | 'height'>>
  ) {
    this.canvas = canvas;
    this.app = new Application(
      Object.assign(
        { view: canvas, width: canvas.width, height: canvas.height },
        pixiConfig
      )
    );
  }
}
