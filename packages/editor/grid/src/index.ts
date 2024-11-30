import { Geometry, Mesh, Polygon, Shader } from "pixi.js";
import { gridFragShader, gridVertShader } from "./shaders/grid";
import { World } from "@shadr/editor-core";

export type RequiredEvents = {
  "editor:drag": { x: number; y: number };
  "editor:zoom": {
    scale: number;
    position: { x: number; y: number };
  };
};

export class Grid<T extends RequiredEvents> {
  #mesh: Mesh<Geometry, Shader> | null = null;
  #world: World | null = null;

  init(
    eventBus: {
      on<K extends keyof T & string>(event: K, callback: (payload: T[K]) => void): void;
    },
    world: World
  ) {
    this.#world = world;
    this.#mesh = new Mesh({
      geometry: this.#createGeometry(),
      shader: this.#createShader(),
    });

    const width = this.#world.getDimensions().x;
    const height = this.#world.getDimensions().y;
    const scale = this.#world.getScale();

    this.#mesh.hitArea = new Polygon([0, 0, width, 0, width, height, 0, height]);

    this.setPosition(-width / 2, -height / 2);
    this.setScale(scale.x, scale.y);

    this.#setupEventListeners(eventBus);
  }

  #setupEventListeners(eventBus: {
    on<K extends keyof T & string>(event: K, callback: (payload: T[K]) => void): void;
  }) {
    eventBus.on("editor:drag", (e) => {
      this.setUniform("u_offset", new Float32Array([e.x, e.y]));
    });
    eventBus.on("editor:zoom", (e) => {
      this.setUniform("u_zoom", e.scale);
      this.setUniform("u_zoomPosition", new Float32Array([e.position.x, e.position.y]));
    });
  }

  setPosition(x: number, y: number) {
    this.#mesh?.position.set(x, y);
  }

  setScale(x: number, y: number) {
    this.#mesh?.scale.set(x, y);
  }

  #createGeometry(): Geometry {
    const { x: width, y: height } = this.#world?.getDimensions() ?? { x: 0, y: 0 };
    return new Geometry({
      attributes: {
        aPosition: new Float32Array([
          0,
          0,
          width,
          0,
          width,
          height,
          0,
          0,
          width,
          height,
          0,
          height,
        ]),
      },
    });
  }

  #createShader(): Shader {
    const { x: width, y: height } = this.#world?.getDimensions() ?? { x: 0, y: 0 };
    return Shader.from({
      gl: { vertex: gridVertShader, fragment: gridFragShader },
      resources: {
        gridUniforms: {
          u_zoomPosition: { type: "vec2<f32>", value: new Float32Array([0, 0]) },
          u_dotSize: { type: "f32", value: 1.0 },
          u_offset: { type: "vec2<f32>", value: new Float32Array([0, 0]) },
          u_size: { type: "vec2<f32>", value: new Float32Array([width, height]) },
          u_zoom: { type: "f32", value: 1.0 },
        },
      },
    });
  }

  getMesh(): Mesh<Geometry, Shader> {
    if (!this.#mesh) throw new Error("Grid not initialized");
    return this.#mesh;
  }

  resize(width: number, height: number) {
    this.setUniform("u_size", new Float32Array([width, height]));
  }

  setUniform<T>(name: string, value: T) {
    const uniforms = this.#mesh?.shader?.resources.gridUniforms.uniforms;
    if (!uniforms) throw new Error("Grid not initialized");
    if (name in uniforms) uniforms[name] = value;
  }
}
