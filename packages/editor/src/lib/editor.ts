import { Application, IApplicationOptions } from 'pixi.js';

export type EditorConfig = {
  canvas: HTMLCanvasElement;
  pixiConfig?: Partial<Omit<IApplicationOptions, 'view' | 'width' | 'height'>>;
};

export class Editor {
  app: Application;

  constructor(config: EditorConfig) {
    this.app = new Application({
      ...config.pixiConfig,
      view: config.canvas,
      width: config.canvas.clientWidth,
      height: config.canvas.clientHeight,
    });
  }

  start() {
    console.log('Editor started');
  }
}
