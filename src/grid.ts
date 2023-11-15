import { Application, Geometry, IPointData, Mesh, Shader } from "pixi.js";

import fGrid from "./shaders/fGrid.glsl";
import vGrid from "./shaders/vGrid.glsl";
import { MouseDownEvent, MouseMoveEvent, MouseUpEvent } from "./events";

export class Grid {
  private scale: number;
  private dotSize: number;
  private dragOffset: IPointData;
  private isDragging: boolean;
  private mesh: Mesh<Shader>;
  private appSize: IPointData;
  private dragStart: IPointData;

  constructor(app: Application) {
    this.appSize = { x: app.renderer.width, y: app.renderer.height };
    this.scale = 100;
    this.dotSize = 1 * this.scale;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.dragStart = { x: 0, y: 0 };

    const geometry = this.createGeometry(this.appSize.x, this.appSize.y);
    const shader = Shader.from(vGrid, fGrid, {
      u_dotSize: this.dotSize,
      u_mousePos: [0, 0],
      u_size: [this.appSize.x, this.appSize.y],
    });
    this.mesh = new Mesh(geometry, shader);

    MouseMoveEvent.addCallback((e) => {
      if (this.isDragging) {
        this.dragOffset = {
          x: (e.clientX - this.dragStart.x) / this.appSize.x,
          y: (e.clientY - this.dragStart.y) / this.appSize.y,
        };

        this.setUniform("u_dragOffset", [this.dragOffset.x, this.dragOffset.y]);
        this.setUniform("u_mousePos", [e.clientX, e.clientY]);
      }
    });
    MouseDownEvent.addCallback((e) => {
      if (e.button === 1) {
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
      }
    });
    MouseUpEvent.addCallback((e) => {
      if (e.button === 1) {
        this.isDragging = false;
      }
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
