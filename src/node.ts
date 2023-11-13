import * as PIXI from "pixi.js";
import { Port } from "./port";
import { Draggable } from "./draggable";

export class Node implements Draggable {
  private id: number;
  private pos: PIXI.IPointData;
  private size: PIXI.IPointData;
  private container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private inputs: Port[];
  private outputs: Port[];
  private readonly CIRCLE_RADIUS = 5; // Radius of the circles
  private readonly PORT_SPACING = 20; // Vertical space between circles

  constructor(id: number, position: PIXI.IPointData, size: PIXI.IPointData) {
    this.id = id;

    this.pos = position;
    this.size = size;

    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();

    this.inputs = [];
    this.outputs = [];

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
    this.graphics.beginFill(0x0c0e0f);
    this.graphics.lineStyle(1, 0x15171a);
    this.graphics.drawRoundedRect(0, 0, this.size.x, this.size.y, 6);
    this.graphics.endFill();
  }

  getId() {
    return this.id;
  }

  getGraphics() {
    return this.container;
  }

  updatePosition(position: PIXI.IPointData) {
    this.container.x = position.x;
    this.container.y = position.y;
  }

  initializePorts() {
    // Clear existing ports graphics if needed
    this.inputs.forEach((input) =>
      this.container.removeChild(input.getGraphics()),
    );
    this.outputs.forEach((output) =>
      this.container.removeChild(output.getGraphics()),
    );

    this.inputs = [];
    this.outputs = [];

    // Example initialization (adjust as needed)
    this.inputs.push(new Port({ x: 0, y: this.PORT_SPACING }));
    this.outputs.push(new Port({ x: this.size.x, y: this.PORT_SPACING }));

    // Add ports graphics to the container
    this.inputs.forEach((input) =>
      this.container.addChild(input.getGraphics()),
    );
    this.outputs.forEach((output) =>
      this.container.addChild(output.getGraphics()),
    );
  }
}
