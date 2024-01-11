import { Container, Graphics, ICanvas, IRenderer, autoDetectRenderer } from "pixi.js";

import { EditorNode, EditorNodeType } from "./nodes/editor-node";
import { Viewport } from "./viewport";

export type EditorConfig = {
  canvas: HTMLCanvasElement;
};

export class Editor<VIEW extends ICanvas = ICanvas> {
  renderer: IRenderer<VIEW>;
  viewport: Viewport;

  constructor(config: EditorConfig) {
    // Setup Pixi.js renderer and stage
    this.renderer = autoDetectRenderer<VIEW>({
      view: config.canvas,
      width: config.canvas.clientWidth,
      height: config.canvas.clientHeight,
      autoDensity: true,
      antialias: true,
      backgroundColor: 0x1a1b1c,
      resolution: window.devicePixelRatio || 1,
    });
    this.viewport = new Viewport({
      renderer: this.renderer,
    });

    const nodesContainer = new Container();
    nodesContainer.name = "nodes";
    this.viewport.get().addChild(nodesContainer);
  }

  public addNode(node: EditorNodeType) {
    const editorNode = new EditorNode(node);
    this.viewport.get().getChildByName<Container>("nodes")?.addChild(editorNode.get());
  }

  start() {
    this.renderer.render(this.viewport.get());
    window.requestAnimationFrame(this.start.bind(this));
  }
}
