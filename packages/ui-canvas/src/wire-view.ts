import * as PIXI from "pixi.js";

import type { Point } from "./types.js";

const WIRE_COLOR = 0x4d7cff;
const WIRE_SELECTED_COLOR = 0x7bf1ff;

export class WireView {
  readonly graphics: PIXI.Graphics;
  private selected = false;

  constructor() {
    this.graphics = new PIXI.Graphics();
  }

  update(from: Point, to: Point, selected = false): void {
    this.selected = selected;
    this.graphics.clear();
    this.graphics.moveTo(from.x, from.y);
    this.graphics.lineTo(to.x, to.y);
    this.graphics.stroke({
      width: 2,
      color: this.selected ? WIRE_SELECTED_COLOR : WIRE_COLOR,
      alpha: 1,
    });
  }

  setVisible(visible: boolean): void {
    this.graphics.visible = visible;
  }

  destroy(): void {
    this.graphics.removeChildren();
  }
}
