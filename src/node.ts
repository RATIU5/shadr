import * as PIXI from "pixi.js";
import { Port } from "./port";
type XY = {
  x: number;
  y: number;
};
export class Node {
  private id: number;
  private pos: XY;
  private size: XY;
  private container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private inputs: Port[];
  private outputs: Port[];

  constructor(id: number, position: XY, size: XY) {
    this.id = id;

    // Position and size of the node
    this.pos = position;
    this.size = size;

    // Graphical elements
    this.container = new PIXI.Container(); // Pixi.js container for this node
    this.graphics = new PIXI.Graphics(); // For drawing the node

    // Ports (inputs/outputs)
    this.inputs = [];
    this.outputs = [];

    // Initialize the node
    this.initialize();
  }

  initialize() {
    this.container.x = this.pos.x;
    this.container.y = this.pos.y;

    this.draw();
    this.container.addChild(this.graphics);
    this.initializePorts();
  }

  draw() {
    this.graphics.beginFill(0xffffff); // Node background color
    this.graphics.lineStyle(2, 0x000000); // Border
    this.graphics.drawRect(0, 0, this.size.x, this.size.y);
    this.graphics.endFill();
  }

  initializePorts() {}
}
