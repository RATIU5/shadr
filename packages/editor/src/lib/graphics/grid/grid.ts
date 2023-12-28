import { Geometry, Mesh, Polygon, Shader } from "pixi.js";
import gridFragShader from "../shaders/grid.frag";
import gridVertShader from "../shaders/grid.vert";

/**
 * Class to create a grid mesh
 */
export class Grid {
  /**
   * The mesh of the grid
   * @readonly
   */
  #mesh: Mesh<Shader>;

  /**
   * The width of the grid
   */
  #width: number;

  /**
   * The height of the grid
   */
  #height: number;

  /**
   * Constructor to setup the grid mesh
   * @param {number} width The width of the grid
   * @param {number} height The height of the grid
   */
  constructor(width: number, height: number) {
    this.#width = width;
    this.#height = height;
    const geometry = this.#createGeometry();
    const shader = this.#createShader();
    this.#mesh = this.#createMesh(geometry, shader);
  }

  /**
   * Creates the geometry using Pixi.js Geometry class. It creates a rectangle the size of the width and height passed in the constructor
   * @returns {Geometry} The geometry of the grid
   */
  #createGeometry(): Geometry {
    const positionalBuffer = this.#getGridSizePoints();
    return new Geometry().addAttribute("position", positionalBuffer, 2).addIndex([0, 1, 2, 0, 2, 3]);
  }

  /**
   * Creates the shader using Pixi.js Shader class. It uses the vertex and fragment shaders from the shaders folder
   * @returns {Shader} The shader of the grid
   */
  #createShader(): Shader {
    return Shader.from(gridVertShader, gridFragShader, {
      u_dotSize: 100.0,
      u_mousePos: [0, 0],
      u_offset: [0, 0],
      u_zoom: 1.0,
      u_gridSpacing: 50.0,
      u_size: [this.#width, this.#height],
    });
  }

  /**
   * Creates the mesh using Pixi.js Mesh class
   * @param {Geometry} geometry The geometry of the grid
   * @param {Shader} shader The shader of the grid
   * @returns {Mesh} The mesh of the grid
   */
  #createMesh(geometry: Geometry, shader: Shader): Mesh<Shader> {
    const mesh = new Mesh(geometry, shader);
    mesh.hitArea = new Polygon(this.#getGridSizePoints());
    return mesh;
  }

  /**
   * Gets the grid size points used to create the geometry and hit area
   * @returns {number[]} The grid size points
   */
  #getGridSizePoints(): number[] {
    return [0, 0, this.#width, 0, this.#width, this.#height, 0, this.#height];
  }

  /**
   * Gets the mesh of the grid to be added to the stage
   * @returns {Mesh} The mesh of the grid
   */
  public getMesh(): Mesh<Shader> {
    return this.#mesh;
  }

  /**
   * Set a value to a specific uniform in the shader
   * @param {string} name The name of the uniform
   * @param {T} value The value to set the uniform to
   */
  public setUniform<T = unknown>(name: string, value: T) {
    this.#mesh.shader.uniforms[name] = value;
  }
}
