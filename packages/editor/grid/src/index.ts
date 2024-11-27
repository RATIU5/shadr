import { Geometry, Mesh, Polygon, Shader } from "pixi.js";
import { gridFragShader, gridVertShader } from "./shaders/grid";

export type RequiredEvents = {
  "editor:drag": { x: number; y: number };
};

export class Grid<T extends RequiredEvents> {
  #mesh: Mesh<Geometry, Shader> | null = null;
  #dimensions = { width: 0, height: 0 };
  #position = { x: 0, y: 0 };
  #scale = { x: 1, y: -1 };

  init(
    eventBus: {
      on<K extends keyof T & string>(event: K, callback: (payload: T[K]) => void): void;
    },
    { width, height }: { width: number; height: number }
  ) {
    this.#dimensions = { width, height };
    this.#mesh = new Mesh({
      geometry: this.#createGeometry(),
      shader: this.#createShader(),
    });

    this.#mesh.hitArea = new Polygon([0, 0, width, 0, width, height, 0, height]);

    this.setPosition(-width / 2, -height / 2);
    this.setScale(this.#scale.x, this.#scale.y);

    this.#setupEventListeners(eventBus);
  }

  #setupEventListeners(eventBus: {
    on<K extends keyof T & string>(event: K, callback: (payload: T[K]) => void): void;
  }) {
    eventBus.on("editor:drag", (e) => {
      this.setUniform("u_offset", new Float32Array([e.x, e.y]));
    });
  }

  setPosition(x: number, y: number) {
    this.#position = { x, y };
    this.#mesh?.position.set(x, y);
  }

  setScale(x: number, y: number) {
    this.#scale = { x, y };
    this.#mesh?.scale.set(x, y);
  }

  screenToWorld(x: number, y: number) {
    return {
      x: (x - this.#position.x) / this.#scale.x,
      y: (y - this.#position.y) / this.#scale.y,
    };
  }

  worldToScreen(x: number, y: number) {
    return {
      x: x * this.#scale.x + this.#position.x,
      y: y * this.#scale.y + this.#position.y,
    };
  }

  #createGeometry(): Geometry {
    const { width, height } = this.#dimensions;
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
    const { width, height } = this.#dimensions;
    return Shader.from({
      gl: { vertex: gridVertShader, fragment: gridFragShader },
      resources: {
        gridUniforms: {
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
    this.#dimensions = { width, height };
    this.setUniform("u_size", new Float32Array([width, height]));
  }

  setUniform<T>(name: string, value: T) {
    const uniforms = this.#mesh?.shader?.resources.gridUniforms.uniforms;
    if (!uniforms) throw new Error("Grid not initialized");
    if (name in uniforms) uniforms[name] = value;
  }
}
