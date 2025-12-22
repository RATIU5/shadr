export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  width: number;
  height: number;
  center: Point;
  scale: number;
}

export class World {
  #viewport: Viewport;
  #position: Point = { x: 0, y: 0 };
  #scale = 1;

  readonly #minZoom = 0.5;
  readonly #maxZoom = 1.0;

  constructor(width: number, height: number) {
    this.#viewport = {
      width,
      height,
      center: { x: width / 2, y: height / 2 },
      scale: 1,
    };
  }

  panBy(delta: Point) {
    // Convert screen space delta to world space
    this.#position.x += delta.x / this.#scale;
    this.#position.y += delta.y / this.#scale;
  }

  panTo(position: Point) {
    this.#position = { ...position };
  }

  zoomTo(scale: number, origin: Point) {
    const oldScale = this.#scale;
    this.#scale = Math.min(Math.max(scale, this.#minZoom), this.#maxZoom);

    // Convert screen space origin to world space
    const worldOrigin = this.screenToWorld(origin);

    // Adjust position to zoom from origin point
    const scaleFactor = this.#scale / oldScale;
    this.#position.x = worldOrigin.x - (worldOrigin.x - this.#position.x) * scaleFactor;
    this.#position.y = worldOrigin.y - (worldOrigin.y - this.#position.y) * scaleFactor;
  }

  zoomBy(delta: number, origin: Point) {
    this.zoomTo(this.#scale * Math.pow(2, delta), origin);
  }

  screenToWorld(point: Point): Point {
    const centerOffset = {
      x: point.x - this.#viewport.center.x,
      y: point.y - this.#viewport.center.y,
    };

    return {
      x: centerOffset.x / this.#scale + this.#position.x,
      y: centerOffset.y / this.#scale + this.#position.y,
    };
  }

  worldToScreen(point: Point): Point {
    const worldOffset = {
      x: point.x - this.#position.x,
      y: point.y - this.#position.y,
    };

    return {
      x: worldOffset.x * this.#scale + this.#viewport.center.x,
      y: worldOffset.y * this.#scale + this.#viewport.center.y,
    };
  }

  resize(width: number, height: number) {
    const oldCenter = this.#viewport.center;
    this.#viewport = {
      ...this.#viewport,
      width,
      height,
      center: { x: width / 2, y: height / 2 },
    };

    // Adjust position to maintain world-space position of viewport center
    const centerDelta = {
      x: this.#viewport.center.x - oldCenter.x,
      y: this.#viewport.center.y - oldCenter.y,
    };

    this.panBy(centerDelta);
  }

  getScale() {
    return this.#scale;
  }
  getPosition() {
    return { ...this.#position };
  }
  getViewport() {
    return { ...this.#viewport };
  }
  getZoomConstraints() {
    return { min: this.#minZoom, max: this.#maxZoom };
  }
}
