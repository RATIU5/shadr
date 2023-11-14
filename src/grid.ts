import { Application, Graphics, IPointData } from "pixi.js";
import {
  MouseDownEvent,
  MouseMoveEvent,
  MouseUpEvent,
  ResizeEvent,
} from "./events";

export class Grid {
  private graphics: Graphics;
  private topLeft: IPointData;
  private bottomRight: IPointData;
  private dotColor: number;
  private scale: number;
  private dotSize: number;
  private baseDotAlpha: number;
  private centerDotAlpha: number;
  private gridSize: number;
  private isMiddleDown: boolean;
  private lastMousePos: IPointData;
  private offset: IPointData;
  private maxPan: IPointData;

  constructor(app: Application) {
    this.graphics = new Graphics();
    this.topLeft = { x: 0, y: 0 };
    this.bottomRight = { x: app.renderer.width, y: app.renderer.height };
    this.dotColor = 0xcccccc;
    this.scale = 1.5;
    this.dotSize = 1 * this.scale;
    this.baseDotAlpha = 0.1;
    this.centerDotAlpha = 0.25;
    this.gridSize = 25 * this.scale;
    this.isMiddleDown = false;
    this.lastMousePos = { x: 0, y: 0 };
    this.offset = { x: 0, y: 0 };
    this.maxPan = { x: 1000, y: 1000 };

    ResizeEvent.addCallback(() => {
      this.bottomRight.x = app.renderer.width;
      this.bottomRight.y = app.renderer.height;
    });
    MouseDownEvent.addCallback(this.onMouseDown.bind(this));
    MouseUpEvent.addCallback(this.onMouseUp.bind(this));
    MouseMoveEvent.addCallback(this.onMouseMove.bind(this));
  }

  onMouseDown(e: MouseEvent) {
    if (e.button === 1) {
      this.isMiddleDown = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    }
  }

  onMouseUp() {
    this.isMiddleDown = false;
  }

  onMouseMove(e: MouseEvent) {
    if (this.isMiddleDown) {
      const currentPos: IPointData = { x: e.clientX, y: e.clientY };
      let deltaX = currentPos.x - this.lastMousePos.x;
      let deltaY = currentPos.y - this.lastMousePos.y;
      this.updateOffset(deltaX, deltaY);
      this.lastMousePos = currentPos;
    }
  }

  updateOffset(deltaX: number, deltaY: number) {
    this.offset.x += deltaX;
    if (this.offset.x > this.maxPan.x) {
      this.offset.x = this.maxPan.x;
    } else if (this.offset.x < -this.maxPan.x) {
      this.offset.x = -this.maxPan.x;
    }

    this.offset.y += deltaY;
    if (this.offset.y > this.maxPan.y) {
      this.offset.y = this.maxPan.y;
    } else if (this.offset.y < -this.maxPan.y) {
      this.offset.y = -this.maxPan.y;
    }

    this.drawGrid();
  }

  drawGrid() {
    this.graphics.clear();

    let startX =
      ((this.offset.x % this.gridSize) + this.gridSize) % this.gridSize;
    let startY =
      ((this.offset.y % this.gridSize) + this.gridSize) % this.gridSize;

    for (
      let x = startX - this.gridSize;
      x <= this.bottomRight.x + this.gridSize;
      x += this.gridSize
    ) {
      for (
        let y = startY - this.gridSize;
        y <= this.bottomRight.y + this.gridSize;
        y += this.gridSize
      ) {
        let gridPosX = Math.floor((x - this.offset.x) / this.gridSize);
        let gridPosY = Math.floor((y - this.offset.y) / this.gridSize);

        gridPosX = ((gridPosX % 5) + 5) % 5;
        gridPosY = ((gridPosY % 5) + 5) % 5;

        let isCenterDot = gridPosX === 2 && gridPosY === 2;
        let dotAlpha = isCenterDot ? this.centerDotAlpha : this.baseDotAlpha;

        this.graphics.beginFill(this.dotColor, dotAlpha);
        this.graphics.drawCircle(x, y, this.dotSize);
        this.graphics.endFill();
      }
    }
  }

  getGraphics() {
    return this.graphics;
  }
}
