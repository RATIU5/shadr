import { Geometry, Mesh, Polygon, Shader } from "pixi.js";
import gridFragShader from "./shaders/grid.frag";
import gridVertShader from "./shaders/grid.vert";

class Grid {
  #mesh: Mesh<Shader>;
  #width: number;
  #height: number;

  constructor(width: number, height: number) {
    this.#width = width;
    this.#height = height;
    const geometry = this.createGeometry();
    const shader = this.createShader();
    this.#mesh = this.createMesh(geometry, shader);
  }

  createGeometry(): Geometry {
    const positionalBuffer = this.getGridSizePoints();
    return new Geometry().addAttribute("position", positionalBuffer, 2).addIndex([0, 1, 2, 0, 2, 3]);
  }

  createShader(): Shader {
    return Shader.from(gridVertShader, gridFragShader, {
      u_dotSize: 100.0,
      u_mousePos: [0, 0],
      u_dragOffset: [0, 0],
      u_zoom: 1.0,
      u_gridSpacing: 50.0,
      u_size: [this.#width, this.#height],
    });
  }

  createMesh(geometry: Geometry, shader: Shader): Mesh<Shader> {
    const mesh = new Mesh(geometry, shader);
    mesh.hitArea = new Polygon(this.getGridSizePoints());
    return mesh;
  }

  getGridSizePoints(): number[] {
    return [0, 0, this.#width, 0, this.#width, this.#height, 0, this.#height];
  }
}
