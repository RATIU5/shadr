import { Application, Graphics, IPointData } from "pixi.js";

export class Grid {
  private tl: IPointData;
  private br: IPointData;
  private graphics: Graphics;

  constructor(app: Application) {
    this.graphics = new Graphics();

    const rect = app.view.getBoundingClientRect!();
    console.log(rect);
    this.tl = { x: rect.x, y: rect.y };
    this.br = { x: rect.x + rect.width, y: rect.y + rect.height };
  }

  drawGrid() {
    const gridSize = 20;
    const gridColor = 0xcccccc;
    const gridAlpha = 0.5;

    this.graphics.clear();
    this.graphics.lineStyle(1, gridColor, gridAlpha);

    for (let x = this.tl.x; x <= this.br.x; x += gridSize) {
      this.graphics.moveTo(x, this.tl.y);
      this.graphics.lineTo(x, this.br.y);
    }

    for (let y = this.tl.x; y <= this.br.y; y += gridSize) {
      this.graphics.moveTo(this.tl.x, y);
      this.graphics.lineTo(this.br.x, y);
    }
  }

  getGraphics() {
    return this.graphics;
  }
}
