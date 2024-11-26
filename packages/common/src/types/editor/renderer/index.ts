import type {
  Container as PixiContainer,
  ContainerChild as PixiContainerChild,
} from "pixi.js";

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
    fnCallback: (container: PixiContainer<PixiContainerChild>) => void,
    name?: string
  ) => void;
  resize: (options: ResizeOptions) => void;
};

export type Container = {
  get x(): number;
  get y(): number;
  get width(): number;
  get height(): number;
  get children(): Container[];
  set x(value: number);
  set y(value: number);
  set width(value: number);
  set height(value: number);
  destroy: () => void;
  addChild: (child: Container) => void;
};
