import * as PIXI from "pixi.js";

import type { Point } from "./types.js";
import { getWireControlPoints } from "./wire-geometry.js";

const DEFAULT_WIRE_COLOR = 0x4d7cff;
const WIRE_WIDTH = 2;
const WIRE_SELECTED_WIDTH = 3;
const WIRE_HOVER_WIDTH = 3;

const mixColor = (from: number, to: number, ratio: number): number => {
  const clamped = Math.max(0, Math.min(1, ratio));
  const fromR = (from >> 16) & 0xff;
  const fromG = (from >> 8) & 0xff;
  const fromB = from & 0xff;
  const toR = (to >> 16) & 0xff;
  const toG = (to >> 8) & 0xff;
  const toB = to & 0xff;
  const r = Math.round(fromR + (toR - fromR) * clamped);
  const g = Math.round(fromG + (toG - fromG) * clamped);
  const b = Math.round(fromB + (toB - fromB) * clamped);
  return (r << 16) | (g << 8) | b;
};

const getSelectedColor = (base: number): number =>
  mixColor(base, 0xffffff, 0.65);
const getHoverColor = (base: number): number => mixColor(base, 0xffffff, 0.4);

export type WireDrawOptions = Readonly<{
  color?: number;
  selected?: boolean;
  hovered?: boolean;
}>;

export class WireBatchView {
  readonly normalGraphics: PIXI.Graphics;
  readonly selectedGraphics: PIXI.Graphics;
  readonly hoveredGraphics: PIXI.Graphics;

  constructor() {
    this.normalGraphics = new PIXI.Graphics();
    this.selectedGraphics = new PIXI.Graphics();
    this.hoveredGraphics = new PIXI.Graphics();
  }

  begin(): void {
    this.normalGraphics.clear();
    this.selectedGraphics.clear();
    this.hoveredGraphics.clear();
  }

  drawWire(from: Point, to: Point, options: WireDrawOptions = {}): void {
    const color = options.color ?? DEFAULT_WIRE_COLOR;
    const selected = options.selected ?? false;
    const hovered = options.hovered ?? false;
    const graphics = hovered
      ? this.hoveredGraphics
      : selected
        ? this.selectedGraphics
        : this.normalGraphics;
    const strokeColor = hovered
      ? getHoverColor(color)
      : selected
        ? getSelectedColor(color)
        : color;
    const strokeWidth = hovered
      ? WIRE_HOVER_WIDTH
      : selected
        ? WIRE_SELECTED_WIDTH
        : WIRE_WIDTH;
    const { cp1, cp2 } = getWireControlPoints(from, to);
    graphics.moveTo(from.x, from.y);
    graphics.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, to.x, to.y);
    graphics.stroke({ width: strokeWidth, color: strokeColor, alpha: 1 });
  }

  end(): void {}

  setVisible(visible: boolean): void {
    this.normalGraphics.visible = visible;
    this.selectedGraphics.visible = visible;
    this.hoveredGraphics.visible = visible;
  }

  destroy(): void {
    this.normalGraphics.removeChildren();
    this.selectedGraphics.removeChildren();
    this.hoveredGraphics.removeChildren();
  }
}
