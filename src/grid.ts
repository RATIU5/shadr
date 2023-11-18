import { Application, Geometry, IPointData, Mesh, Shader } from "pixi.js";

import fGrid from "./shaders/fGrid.glsl";
import vGrid from "./shaders/vGrid.glsl";
import {
  MouseDownEvent,
  MouseMoveEvent,
  MouseUpEvent,
  MouseScrollEvent,
} from "./events";

export class Grid {
  private scale = 100;
  private minZoom = 0.5;
  private maxZoom = 3.0;
  private zoomSensitivity = 0.025;
  private zoomFactor: number;
  private dotSize: number;
  private dragOffset: IPointData;
  private isDragging: boolean;
  private mesh: Mesh<Shader>;
  private appSize: IPointData;
  private dragStart: IPointData;

  constructor(app: Application) {
    this.appSize = { x: app.renderer.width, y: app.renderer.height };
    this.dotSize = 1 * this.scale;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.dragStart = { x: 0, y: 0 };
    this.zoomFactor = 1;

    const geometry = this.createGeometry(this.appSize.x, this.appSize.y);
    const shader = Shader.from(vGrid, fGrid, {
      u_dotSize: this.dotSize,
      u_mousePos: [0, 0],
      u_dragOffset: [0, 0],
      u_zoom: 1.0,
      u_gridSpacing: 50.0,
      u_size: [this.appSize.x, this.appSize.y],
    });
    this.mesh = new Mesh(geometry, shader);

    MouseDownEvent.addCallback((e) => {
      if (e.button === 1) {
        this.isDragging = true;
        this.dragStart.x = e.clientX;
        this.dragStart.y = e.clientY;
      }
    });

    MouseUpEvent.addCallback((e) => {
      if (e.button === 1) {
        this.isDragging = false;
      }
    });

    MouseMoveEvent.addCallback((e) => {
      if (this.isDragging) {
        const deltaX = e.clientX - this.dragStart.x;
        const deltaY = e.clientY - this.dragStart.y;

        this.dragOffset.x += deltaX;
        this.dragOffset.y += deltaY;

        this.setUniform("u_dragOffset", [this.dragOffset.x, this.dragOffset.y]);

        this.dragStart.x = e.clientX;
        this.dragStart.y = e.clientY;
      }
    });

    MouseScrollEvent.addCallback((e) => {
      this.zoomFactor *=
        e.deltaY > 0 ? 1 - this.zoomSensitivity : 1 + this.zoomSensitivity;

      this.zoomFactor = Math.max(
        this.minZoom,
        Math.min(this.maxZoom, this.zoomFactor),
      );
      this.setUniform("u_zoom", this.zoomFactor);
    });
  }

  private setUniform<T = any>(name: string, value: T) {
    this.mesh.shader.uniforms[name] = value;
  }

  createGeometry(width: number, height: number) {
    let positionalBuffer = new Float32Array([
      0,
      0,
      width,
      0,
      width,
      height,
      0,
      height,
    ]);
    return new Geometry()
      .addAttribute("position", positionalBuffer, 2)
      .addIndex([0, 1, 2, 0, 2, 3]);
  }

  getMesh() {
    return this.mesh;
  }
}
