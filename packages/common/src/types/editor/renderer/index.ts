import type { Container, ContainerChild } from "pixi.js";

export type SetupOptions = {
  width: number;
  height: number;
};

export type ResizeOptions = {
  width: number;
  height: number;
  resolution?: number;
};

export type Renderer = {
  canvas: HTMLCanvasElement | undefined;
  destroy: () => void;
  createContainer: (
    fnCallback: (container: Container<ContainerChild>) => void,
    name?: string
  ) => void;
  resize: (options: ResizeOptions) => void;
};
