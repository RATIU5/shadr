import { Application, Geometry, IPointData, Mesh, Shader } from "pixi.js";

import fGrid from "./shaders/fGrid.glsl";
import vGrid from "./shaders/vGrid.glsl";

export type GridOptions = {
  scale: number;
  initialZoomFactor: number;
  gridSpacing: number;
  dotSize: number;
};

export class Grid {
  private scale = 100;
  private mesh: Mesh<Shader>;
  private appSize: IPointData;

  constructor(app: Application, options: GridOptions) {
    this.appSize = { x: app.renderer.width, y: app.renderer.height };
    this.dotSize = 1 * this.scale;
    this.gridOptions = {
      scale: 1,
      initialZoomFactor: 1.0,
      gridSpacing: 50.0,
      dotSize: 100,
    };
    const geometry = this.createGeometry(this.appSize.x, this.appSize.y);
    const shader = Shader.from(vGrid, fGrid, {
      u_dotSize: this.gridOptions.dotSize,
      u_mousePos: [0, 0],
      u_dragOffset: [0, 0],
      u_zoom: this.gridOptions.initialZoomFactor,
      u_gridSpacing: this.gridOptions.gridSpacing,
      u_size: [this.appSize.x, this.appSize.y],
    });
    this.mesh = new Mesh(geometry, shader);
    this.mesh.hitArea = app.screen;
  }

  public setUniform<T = any>(name: string, value: T) {
    this.mesh.shader.uniforms[name] = value;
  }

  private createGeometry(width: number, height: number) {
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

  public getMesh() {
    return this.mesh;
  }
}
