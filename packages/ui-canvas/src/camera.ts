import type { Point, Size } from "./types.js";

export type WorldBounds = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

export type ScreenPointOptions = Readonly<{
  devicePixels?: boolean;
}>;

export type ViewportSizeOptions = Readonly<{
  devicePixels?: boolean;
  pixelRatio?: number;
}>;

export type CameraOptions = Readonly<{
  center?: Point;
  zoom?: number;
  screenSize?: Size;
  pixelRatio?: number;
  minZoom?: number;
  maxZoom?: number;
}>;

const DEFAULT_SCREEN_SIZE: Size = { width: 1, height: 1 };
const DEFAULT_CENTER: Point = { x: 0, y: 0 };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export class Camera2D {
  private center: Point;
  private zoom: number;
  private screenSize: Size;
  private pixelRatio: number;
  private readonly minZoom: number;
  private readonly maxZoom: number;

  constructor(options: CameraOptions = {}) {
    this.center = options.center ?? DEFAULT_CENTER;
    this.zoom = options.zoom ?? 1;
    this.screenSize = options.screenSize ?? DEFAULT_SCREEN_SIZE;
    this.pixelRatio = options.pixelRatio ?? 1;
    this.minZoom = options.minZoom ?? 0.05;
    this.maxZoom = options.maxZoom ?? 8;
    this.zoom = clamp(this.zoom, this.minZoom, this.maxZoom);
  }

  getCenter(): Point {
    return this.center;
  }

  getZoom(): number {
    return this.zoom;
  }

  getScreenSize(): Size {
    return this.screenSize;
  }

  getPixelRatio(): number {
    return this.pixelRatio;
  }

  setCenter(center: Point): void {
    this.center = center;
  }

  panBy(delta: Point): void {
    this.center = { x: this.center.x + delta.x, y: this.center.y + delta.y };
  }

  setZoom(zoom: number): void {
    this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
  }

  setCenterAndZoom(center: Point, zoom: number): void {
    this.center = center;
    this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
  }

  zoomAt(
    screenPoint: Point,
    nextZoom: number,
    options?: ScreenPointOptions,
  ): void {
    const worldBefore = this.screenToWorld(screenPoint, options);
    this.setZoom(nextZoom);
    const worldAfter = this.screenToWorld(screenPoint, options);
    this.center = {
      x: this.center.x + (worldBefore.x - worldAfter.x),
      y: this.center.y + (worldBefore.y - worldAfter.y),
    };
  }

  setViewportSize(size: Size, options: ViewportSizeOptions = {}): void {
    const nextPixelRatio = options.pixelRatio ?? this.pixelRatio;
    this.pixelRatio = nextPixelRatio > 0 ? nextPixelRatio : 1;
    const normalized = options.devicePixels
      ? {
          width: size.width / this.pixelRatio,
          height: size.height / this.pixelRatio,
        }
      : size;
    this.screenSize = {
      width: Math.max(1, normalized.width),
      height: Math.max(1, normalized.height),
    };
  }

  worldToScreen(world: Point, options?: ScreenPointOptions): Point {
    const screenCenter = this.getScreenCenter();
    const screenPoint = {
      x: (world.x - this.center.x) * this.zoom + screenCenter.x,
      y: (world.y - this.center.y) * this.zoom + screenCenter.y,
    };
    return options?.devicePixels
      ? {
          x: screenPoint.x * this.pixelRatio,
          y: screenPoint.y * this.pixelRatio,
        }
      : screenPoint;
  }

  screenToWorld(screen: Point, options?: ScreenPointOptions): Point {
    const screenPoint = options?.devicePixels
      ? { x: screen.x / this.pixelRatio, y: screen.y / this.pixelRatio }
      : screen;
    const screenCenter = this.getScreenCenter();
    return {
      x: (screenPoint.x - screenCenter.x) / this.zoom + this.center.x,
      y: (screenPoint.y - screenCenter.y) / this.zoom + this.center.y,
    };
  }

  getWorldBounds(): WorldBounds {
    const halfWidth = this.screenSize.width / (2 * this.zoom);
    const halfHeight = this.screenSize.height / (2 * this.zoom);
    return {
      minX: this.center.x - halfWidth,
      minY: this.center.y - halfHeight,
      maxX: this.center.x + halfWidth,
      maxY: this.center.y + halfHeight,
    };
  }

  getWorldTransform(): Readonly<{ position: Point; scale: number }> {
    const screenCenter = this.getScreenCenter();
    return {
      position: {
        x: screenCenter.x - this.center.x * this.zoom,
        y: screenCenter.y - this.center.y * this.zoom,
      },
      scale: this.zoom,
    };
  }

  private getScreenCenter(): Point {
    return { x: this.screenSize.width / 2, y: this.screenSize.height / 2 };
  }
}
