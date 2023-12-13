import { IApplicationOptions } from "pixi.js";
import { Renderer } from "./renderer/renderer";

export type EditorConfig = {
  canvas: HTMLCanvasElement;
  pixiConfig?: Partial<Omit<IApplicationOptions, "view" | "width" | "height">>;
};

export class Editor {
  renderer: Renderer;
  nodes: Map<string, any>;
  connections: Set<any>;

  constructor(config: EditorConfig) {
    this.renderer = new Renderer(config.canvas, config.pixiConfig);
    this.nodes = new Map();
    this.connections = new Set();
  }

  start() {
    console.log("Editor started");
  }
}
