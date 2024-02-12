import { Container, Graphics } from "pixi.js";

export type EditorNodeType = {
  id: string;
  label: string;
  type: string;
};

export class EditorNode {
  id: string;
  label: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  container: Container;

  constructor(node: EditorNodeType, position: { x: number; y: number }, size: { width: number; height: number }) {
    this.id = node.id;
    this.label = node.label;
    this.type = node.type;
    this.position = position;
    this.size = size;

    this.container = new Container();

    this.createGraphics();
  }

  createGraphics() {
    const rect = new Graphics();
    rect.lineStyle(0.5, 0x444444);
    rect.beginFill(0x222222);
    rect.drawRoundedRect(this.position.x, this.position.y, this.size.width, this.size.height, 5);
    rect.endFill();
    this.container.addChild(rect);
  }

  public get() {
    return this.container;
  }
}
