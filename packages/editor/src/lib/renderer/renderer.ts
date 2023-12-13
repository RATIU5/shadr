import { Application, Container, IApplicationOptions, Polygon } from 'pixi.js';

export class Renderer {
  canvas: HTMLCanvasElement;
  app: Application;
  container: Container;

  constructor(
    canvas: HTMLCanvasElement,
    pixiConfig?: Partial<Omit<IApplicationOptions, 'view' | 'width' | 'height'>>
  ) {
    this.canvas = canvas;
    this.app = new Application(
      Object.assign(
        {
          view: canvas,
          width: canvas.clientWidth,
          height: canvas.clientHeight,
        },
        pixiConfig
      )
    );
    this.container = new Container();
    this.container.hitArea = new Polygon([
      0,
      0,
      this.canvas.clientWidth,
      0,
      this.canvas.clientWidth,
      this.canvas.clientHeight,
      0,
      this.canvas.clientHeight,
    ]);
    this.container.eventMode = 'static';
    this.app.stage.addChild(this.container);
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.container.on('mousemove', (event) => {
      console.log('move');
    });
  }
}
