import {
  Application,
  Geometry,
  Graphics,
  ICanvas,
  IPointData,
  IRenderer,
  Mesh,
  Shader,
  Texture,
  TilingSprite,
} from "pixi.js";

import fGrid from "./shaders/fGrid.glsl";
import vGrid from "./shaders/vGrid.glsl";
import { MouseMoveEvent } from "./events";

export class Grid {
  private gridSize: number;
  private scale: number;
  private dotSize: number;
  private zoomLevel: number;
  private minZoom: number;
  private maxZoom: number;
  private offset: IPointData;
  private mesh: Mesh<Shader>;

  constructor(app: Application) {
    this.gridSize = 25;
    this.scale = 100;
    this.dotSize = 1 * this.scale;
    this.zoomLevel = 1;
    this.minZoom = 0.5;
    this.maxZoom = 1.5;
    this.offset = { x: 0, y: 0 };
    const geometry = this.createGeometry(
      app.renderer.width,
      app.renderer.height,
    );
    const shader = Shader.from(vGrid, fGrid, {
      u_dotSize: this.dotSize,
      u_mousePos: [0, 0],
      u_size: [app.renderer.width, app.renderer.height],
    });
    this.mesh = new Mesh(geometry, shader);
    MouseMoveEvent.addCallback((e) => {
      this.setUniform("u_mousePos", [e.clientX, e.clientY]);
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
