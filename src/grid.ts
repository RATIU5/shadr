import { Application, Graphics, IPointData } from "pixi.js";
import {
  MouseDownEvent,
  MouseMoveEvent,
  MouseScrollEvent,
  MouseUpEvent,
  ResizeEvent,
} from "./events";

export class Grid {
  private tl: IPointData;
  private br: IPointData;
  private graphics: Graphics;
  private gridSize: number;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private isMouseDown: boolean;
  private lastMousePosition: IPointData;
  private zoomLevel: number;

  constructor(app: Application) {
    this.graphics = new Graphics();
    this.tl = { x: 0, y: 0 };
    this.br = { x: app.renderer.width, y: app.renderer.height };
    this.gridSize = 40;
    this.isMouseDown = false;
    this.lastMousePosition = { x: 0, y: 0 };
    this.zoomLevel = 0;

    ResizeEvent.addCallback(() => {
      (this.br.x = app.renderer.width), (this.br.y = app.renderer.height);
    });
    MouseDownEvent.addCallback(this.onMouseDown.bind(this));
    MouseUpEvent.addCallback(this.onMouseUp.bind(this));
    MouseMoveEvent.addCallback(this.onMouseMove.bind(this));
    MouseScrollEvent.addCallback(this.onMouseZoom.bind(this));
  }

  onMouseDown(event: MouseEvent) {
    this.isMouseDown = true;
    this.lastMousePosition = { x: event.clientX, y: event.clientY };
  }
  onMouseUp(event: Event) {
    this.isMouseDown = false;
  }
  onMouseMove(event: MouseEvent) {
    if (this.isMouseDown) {
      const currentMousePosition = { x: event.clientX, y: event.clientY };

      let deltaX = currentMousePosition.x - (this.lastMousePosition?.x || 0);
      let deltaY = currentMousePosition.y - (this.lastMousePosition?.y || 0);

      this.updateOffset(deltaX, deltaY);

      this.lastMousePosition = currentMousePosition;
    }
  }
  onMouseZoom(event: WheelEvent) {
    const zoomAmount = 0.1; // Adjust this value to control zoom sensitivity
    if (event.deltaY < 0) {
      // Zoom in
      this.zoomLevel *= 1 + zoomAmount;
    } else {
      // Zoom out
      this.zoomLevel /= 1 + zoomAmount;
    }

    // Limit zoom level to reasonable values
    this.zoomLevel = Math.min(Math.max(this.zoomLevel, 0.1), 10);

    this.drawGrid();
  }

  updateOffset(deltaX: number, deltaY: number) {
    this.offsetX += deltaX;
    this.offsetY += deltaY;
    this.drawGrid();
  }

  drawGrid() {
    const dotColor = 0xcccccc;
    const dotSize = 2;
    const baseDotAlpha = 0.1;
    const centerDotAlpha = 0.25;

    let startX =
      ((this.offsetX % this.gridSize) + this.gridSize) % this.gridSize;
    let startY =
      ((this.offsetY % this.gridSize) + this.gridSize) % this.gridSize;

    this.graphics.clear();

    for (
      let x = startX - this.gridSize;
      x <= this.br.x - this.tl.x;
      x += this.gridSize
    ) {
      for (
        let y = startY - this.gridSize;
        y <= this.br.y - this.tl.y;
        y += this.gridSize
      ) {
        let gridPosX = Math.floor((x - this.offsetX) / this.gridSize);
        let gridPosY = Math.floor((y - this.offsetY) / this.gridSize);
        if (gridPosX < 0) gridPosX = ((gridPosX % 5) + 5) % 5;
        if (gridPosY < 0) gridPosY = ((gridPosY % 5) + 5) % 5;

        let isCenterDot = gridPosX % 5 === 2 && gridPosY % 5 === 2;

        let dotAlpha = isCenterDot ? centerDotAlpha : baseDotAlpha;

        this.graphics.beginFill(dotColor, dotAlpha);
        this.graphics.drawCircle(x, y, dotSize);
        this.graphics.endFill();
      }
    }
  }

  getGraphics() {
    return this.graphics;
  }
}
