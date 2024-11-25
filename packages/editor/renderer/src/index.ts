import {
  Application,
  ContainerChild,
  ContainerOptions,
  Container as PixiContainer,
} from "pixi.js";

export const ShadrApplication = (canvas: HTMLCanvasElement) => {
  const renderer = ShadrRenderer(canvas);
  return renderer;
};

export const ShadrRenderer = (canvas: HTMLCanvasElement) => {
  const app = new Application();
  app.init({
    width: canvas.width,
    height: canvas.height,
    preference: "webgpu",
    canvas,
    hello: false,
    resolution: window.devicePixelRatio ?? 1,
  });
  return app;
};

export const ShadrContainer = (options: ContainerOptions<ContainerChild> | undefined) => {
  return new PixiContainer(options);
};
