import { Graphics, IPointData } from "pixi.js";

export class Port {
  private graphics: Graphics;
  private readonly CIRCLE_RADIUS = 5;
  private position: IPointData;

  constructor(position: IPointData) {
    this.graphics = new Graphics();
    this.position = position;
    this.draw();
  }

  draw() {
    this.graphics.clear();
    const color = 0xff0000; // Input: green, Output: red
    this.graphics.beginFill(color);
    this.graphics.drawCircle(
      this.position.x,
      this.position.y,
      this.CIRCLE_RADIUS,
    );
    this.graphics.endFill();
  }

  getGraphics() {
    return this.graphics;
  }
}
