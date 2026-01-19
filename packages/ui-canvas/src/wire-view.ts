import * as PIXI from "pixi.js";

import type { Point } from "./types.js";
import { getBezierPoint, getWireControlPoints } from "./wire-geometry.js";

const WIRE_WIDTH = 2;
const WIRE_SELECTED_WIDTH = 3;
const WIRE_HOVER_WIDTH = 3;
const FLOW_DOT_RADIUS = 1.6;
const FLOW_MIN_SPACING = 140;
const FLOW_MAX_DOTS = 4;

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
  readonly flowGraphics: PIXI.Graphics;
  private defaultColor: number;

  constructor(defaultColor: number) {
    this.normalGraphics = new PIXI.Graphics();
    this.selectedGraphics = new PIXI.Graphics();
    this.hoveredGraphics = new PIXI.Graphics();
    this.flowGraphics = new PIXI.Graphics();
    this.defaultColor = defaultColor;
  }

  begin(): void {
    this.normalGraphics.clear();
    this.selectedGraphics.clear();
    this.hoveredGraphics.clear();
  }

  beginFlow(): void {
    this.flowGraphics.clear();
  }

  drawWire(from: Point, to: Point, options: WireDrawOptions = {}): void {
    const color = options.color ?? this.defaultColor;
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

  drawFlow(
    from: Point,
    to: Point,
    options: WireDrawOptions = {},
    progress = 0,
    zoom = 1,
  ): void {
    const baseColor = options.color ?? this.defaultColor;
    const flowColor = mixColor(baseColor, 0xffffff, 0.55);
    const { cp1, cp2 } = getWireControlPoints(from, to);
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const dots = Math.min(
      FLOW_MAX_DOTS,
      Math.max(1, Math.round(length / FLOW_MIN_SPACING)),
    );
    const radius = FLOW_DOT_RADIUS / Math.sqrt(Math.max(zoom, 0.4));
    for (let i = 0; i < dots; i += 1) {
      const t = (progress + i / dots) % 1;
      const point = getBezierPoint(from, cp1, cp2, to, t);
      this.flowGraphics.circle(point.x, point.y, radius);
      this.flowGraphics.fill(flowColor);
    }
  }

  end(): void {}

  endFlow(): void {}

  setDefaultColor(color: number): void {
    this.defaultColor = color;
  }

  setVisible(visible: boolean): void {
    this.normalGraphics.visible = visible;
    this.selectedGraphics.visible = visible;
    this.hoveredGraphics.visible = visible;
    this.flowGraphics.visible = visible;
  }

  setFlowVisible(visible: boolean): void {
    this.flowGraphics.visible = visible;
  }

  destroy(): void {
    this.normalGraphics.removeChildren();
    this.selectedGraphics.removeChildren();
    this.hoveredGraphics.removeChildren();
    this.flowGraphics.removeChildren();
  }
}
