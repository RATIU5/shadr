interface Point {
  x: number;
  y: number;
}

export class World {
  #position: Point = { x: 0, y: 0 };
  #scale: Point = { x: 1, y: 1 };
  #dimensions: Point = { x: 0, y: 0 };
  #zoom = 1;
  #minZoom = 0.8;
  #maxZoom = 2;
  #dragOffset: Point = { x: 0, y: 0 };
  #center: Point = { x: 0, y: 0 };

  constructor(dimensions?: { width: number; height: number }) {
    if (dimensions) this.resize(dimensions.width, dimensions.height);
    this.#updateCenter();
  }

  #updateCenter() {
    this.#center = {
      x: this.#dimensions.x / 2,
      y: this.#dimensions.y / 2,
    };
  }

  setZoom(zoom: number) {
    const clampedZoom = Math.min(Math.max(zoom, this.#minZoom), this.#maxZoom);
    if (clampedZoom === this.#zoom) return false;

    this.#zoom = clampedZoom;
    return true;
  }

  setZoomLimits(min: number, max: number) {
    if (min > 0 && max > min) {
      this.#minZoom = min;
      this.#maxZoom = max;
      this.#zoom = Math.min(Math.max(this.#zoom, min), max);
    }
  }

  setDragOffset(x: number, y: number) {
    this.#dragOffset = { x, y };
  }

  setPosition(x: number, y: number) {
    this.#position = { x, y };
  }

  setScale(x: number, y: number) {
    this.#scale = { x, y };
  }

  screenToWorld(x: number, y: number): Point {
    return {
      x: (x - this.#position.x - this.#dragOffset.x) / (this.#scale.x * this.#zoom),
      y: (y - this.#position.y - this.#dragOffset.y) / (this.#scale.y * this.#zoom),
    };
  }

  worldToScreen(x: number, y: number): Point {
    return {
      x: x * this.#scale.x * this.#zoom + this.#position.x + this.#dragOffset.x,
      y: y * this.#scale.y * this.#zoom + this.#position.y + this.#dragOffset.y,
    };
  }

  resize(width: number, height: number) {
    this.#dimensions = { x: width, y: height };
    this.#updateCenter();
  }

  centerView() {
    this.setPosition(this.#center.x, this.#center.y);
    this.setDragOffset(0, 0);
  }

  getPosition(): Point {
    return { ...this.#position };
  }

  getScale(): Point {
    return { ...this.#scale };
  }

  getZoom(): number {
    return this.#zoom;
  }

  getDimensions(): Point {
    return { ...this.#dimensions };
  }

  getZoomLimits(): { min: number; max: number } {
    return { min: this.#minZoom, max: this.#maxZoom };
  }

  getDragOffset(): Point {
    return { ...this.#dragOffset };
  }
}
