import type {
  Container as PixiContainer,
  ContainerChild as PixiContainerChild,
} from "pixi.js";

export interface Viewport {
  x: number;
  y: number;
  scale: number;
  worldToScreen: (x: number, y: number) => { x: number; y: number };
  screenToWorld: (x: number, y: number) => { x: number; y: number };
}

export interface Renderer {
  // Core rendering system
  readonly view: HTMLCanvasElement;
  readonly viewport: Viewport;

  // Lifecycle
  start(): void;
  stop(): void;
  destroy(): void;

  // Frame management
  requestFrame(): void;

  // Layer management
  createLayer(name: string, options?: LayerOptions): void;
  getLayer(name: string): Layer | undefined;

  // Plugin system
  use(plugin: RendererPlugin): void;

  // Customization hooks
  onBeforeRender?: (deltaTime: number) => void;
  onAfterRender?: (deltaTime: number) => void;

  // Extension points
  extensions: Map<string, unknown>;
}

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
