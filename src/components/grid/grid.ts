import { Application, Geometry, Mesh, Polygon, Shader } from "pixi.js";
import gridVertShader from "../../pixi/shaders/grid.vert";
import gridFragShader from "../../pixi/shaders/grid.frag";
import { on } from "../../events/event-bus";

export function initializeGridComponent(app: Application) {
  const grid = new Grid(app);
  grid.initialize();
}

class Grid {
  private readonly app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  public initialize() {
    const geometry = this.createGeometry();
    const shader = this.createShader();
    const mesh = this.createMesh(geometry, shader);
    this.app.stage.addChild(mesh);

    on("grid:zoom", (zoom: number) => {
      shader.uniforms.u_zoom = zoom;
    });
    on("grid:drag", (dragOffset: [number, number]) => {
      shader.uniforms.u_dragOffset = dragOffset;
    });
  }

  createGeometry(): Geometry {
    const positionalBuffer = this.getGridSizePoints();
    return new Geometry()
      .addAttribute("position", positionalBuffer, 2)
      .addIndex([0, 1, 2, 0, 2, 3]);
  }

  createShader(): Shader {
    return Shader.from(gridVertShader, gridFragShader, {
      u_dotSize: 100.0,
      u_mousePos: [0, 0],
      u_dragOffset: [0, 0],
      u_zoom: 1.0,
      u_gridSpacing: 50.0,
      u_size: [this.app.view.width, this.app.view.height],
    });
  }

  createMesh(geometry: Geometry, shader: Shader): Mesh<Shader> {
    const mesh = new Mesh(geometry, shader);
    mesh.hitArea = new Polygon(this.getGridSizePoints());
    return mesh;
  }

  getGridSizePoints(): number[] {
    return [
      0,
      0,
      this.app.view.width,
      0,
      this.app.view.width,
      this.app.view.height,
      0,
      this.app.view.height,
    ];
  }
}
