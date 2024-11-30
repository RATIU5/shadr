interface Point {
  x: number;
  y: number;
}

/**
 * Handles viewport transformations and coordinate systems
 */

export class World {
  #dimensions: Point = { x: 0, y: 0 };
  #position: Point = { x: 0, y: 0 };
  #zoom = 1.0;
  #minZoom = 0.5;
  #maxZoom = 1.0;

  constructor(dimensions?: { width: number; height: number }) {
    if (dimensions) {
      this.resize(dimensions.width, dimensions.height);
    }
  }

  resize(width: number, height: number) {
    this.#dimensions = { x: width, y: height };
  }

  screenToWorld(screenX: number, screenY: number): Point {
    const center = {
      x: this.#dimensions.x / 2,
      y: this.#dimensions.y / 2,
    };

    // Match the shader's transformation
    const centerOffset = {
      x: screenX - center.x,
      y: screenY - center.y,
    };

    return {
      x: centerOffset.x / this.#zoom + this.#position.x,
      y: centerOffset.y / this.#zoom + this.#position.y,
    };
  }

  worldToScreen(worldX: number, worldY: number): Point {
    const center = {
      x: this.#dimensions.x / 2,
      y: this.#dimensions.y / 2,
    };

    // Inverse of screenToWorld
    const centered = {
      x: (worldX - this.#position.x) * this.#zoom,
      y: (worldY - this.#position.y) * this.#zoom,
    };

    return {
      x: centered.x + center.x,
      y: centered.y + center.y,
    };
  }

  // Zoom handling with constraints
  setZoom(zoom: number): boolean {
    const newZoom = Math.min(Math.max(zoom, this.#minZoom), this.#maxZoom);
    if (newZoom === this.#zoom) return false;
    this.#zoom = newZoom;
    return true;
  }

  // Pan position handling
  setPosition(x: number, y: number) {
    this.#position = { x, y };
  }

  // Getters
  getDimensions(): Point {
    return { ...this.#dimensions };
  }
  getPosition(): Point {
    return { ...this.#position };
  }
  getZoom(): number {
    return this.#zoom;
  }
  getZoomLimits() {
    return { min: this.#minZoom, max: this.#maxZoom };
  }
}
