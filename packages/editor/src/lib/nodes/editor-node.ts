import { Container, Graphics } from "pixi.js";

export type EditorNodeType = {
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

  constructor(node: EditorNodeType) {
    this.id = node.id;
    this.label = node.label;
    this.type = node.type;
    this.position = node.position;
    this.size = node.size;

    this.container = new Container();
  }

  createGraphics() {
    const rect = new Graphics();
    rect.lineStyle(2, 0xffffff);
    rect.beginFill(0x000000);
    rect.drawRect(this.position.x, this.position.y, this.size.width, this.size.height);
    rect.endFill();
    this.container.addChild(rect);
  }

  public get() {
    return this.container;
  }
}
