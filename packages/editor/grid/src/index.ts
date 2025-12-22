import { Geometry, Mesh, Shader } from "pixi.js";
import { World } from "@shadr/editor-core";

interface GridOptions {
  majorColor?: number[];
  minorColor?: number[];
  backgroundColor?: number[];
  majorGridSize?: number;
  minorGridSize?: number;
  majorLineWidth?: number;
  minorLineWidth?: number;
}

export class Grid {
  #mesh: Mesh<Geometry, Shader> | null = null;
  #world: World;

  readonly defaultOptions: Required<GridOptions> = {
    majorColor: [0.3, 0.3, 0.3, 1.0],
    minorColor: [0.2, 0.2, 0.2, 1.0],
    backgroundColor: [0.1, 0.1, 0.1, 1.0],
    majorGridSize: 100.0,
    minorGridSize: 10.0,
    majorLineWidth: 1.0,
    minorLineWidth: 1.0,
  };

  constructor(world: World, options: GridOptions = {}) {
    this.#world = world;
    this.#createMesh({ ...this.defaultOptions, ...options });
  }

  #createGeometry(): Geometry {
    return new Geometry({
      attributes: {
        aPosition: new Float32Array([
          -1,
          -1, // Bottom left
          1,
          -1, // Bottom right
          1,
          1, // Top right
          -1,
          -1, // Bottom left
          1,
          1, // Top right
          -1,
          1, // Top left
        ]),
      },
    });
  }

  #getVertexShader(): string {
    return `#version 300 es
    in vec2 aPosition;
    out vec2 vPosition;

    void main() {
      vPosition = aPosition;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`;
  }

  #getFragmentShader(): string {
    return `#version 300 es
    precision highp float;

    uniform vec2 u_resolution;
    uniform vec2 u_offset;
    uniform float u_zoom;
    uniform vec4 u_majorColor;
    uniform vec4 u_minorColor;
    uniform vec4 u_backgroundColor;
    uniform float u_majorGridSize;
    uniform float u_minorGridSize;
    uniform float u_majorLineWidth;
    uniform float u_minorLineWidth;

    out vec4 fragColor;

    const float MIN_ZOOM = 0.5;
    const float MAX_ZOOM = 1.0;
    const float FADE_RANGE = 0.5;

    vec2 screenToWorld(vec2 screenPos) {
      vec2 viewCenter = u_resolution * 0.5;
      vec2 centerOffset = screenPos - viewCenter;
      vec2 zoomedPos = centerOffset / u_zoom;
      vec2 worldPos = zoomedPos + u_offset;
      return worldPos;
    }

    float calculateMinorLineOpacity(float zoom) {
      float normalizedZoom = (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
      return smoothstep(0.0, 1.75, normalizedZoom);
    }

    float getScreenSpaceLineWidth(float baseWidth) {
      vec2 windowSpacePos = gl_FragCoord.xy;
      vec2 derivatives = fwidth(windowSpacePos);
      float pixelWidth = max(derivatives.x, derivatives.y);
      return baseWidth * pixelWidth / u_zoom;
    }

    bool isOnLine(vec2 coord, float width) {
      float screenWidth = getScreenSpaceLineWidth(width);
      return abs(coord.x) < screenWidth || abs(coord.y) < screenWidth;
    }

    float getGridLevel(float zoom) {
      return floor(log2(zoom * u_minorGridSize));
    }

    float calculateLevelFade(float zoom) {
      float level = getGridLevel(zoom);
      float fractionalPart = fract(level);
      return smoothstep(0.0, FADE_RANGE, fractionalPart);
    }

    vec4 calculateFinalGridColor(vec2 worldPos, float zoom) {
      vec4 baseColor = u_backgroundColor;

      vec2 majorCoord = mod(worldPos + u_majorGridSize / 2.0, u_majorGridSize) - u_majorGridSize / 2.0;
      if (isOnLine(majorCoord, u_majorLineWidth)) {
        return u_majorColor;
      }

      vec2 minorCoord = mod(worldPos + u_minorGridSize / 2.0, u_minorGridSize) - u_minorGridSize / 2.0;
      if (isOnLine(minorCoord, u_minorLineWidth)) {
        float opacity = calculateMinorLineOpacity(zoom);
        return mix(baseColor, u_minorColor, opacity);
      }
      
      return baseColor;
    }

    void main() {
        vec2 worldPos = screenToWorld(gl_FragCoord.xy);
        fragColor = calculateFinalGridColor(worldPos, u_zoom);
    }`;
  }

  #createShader(options: Required<GridOptions>): Shader {
    return Shader.from({
      gl: {
        vertex: this.#getVertexShader(),
        fragment: this.#getFragmentShader(),
      },
      resources: {
        gridUniforms: {
          u_resolution: { type: "vec2<f32>", value: new Float32Array([1, 1]) },
          u_offset: { type: "vec2<f32>", value: new Float32Array([0, 0]) },
          u_zoom: { type: "f32", value: 1.0 },
          u_majorColor: {
            type: "vec4<f32>",
            value: new Float32Array(options.majorColor),
          },
          u_minorColor: {
            type: "vec4<f32>",
            value: new Float32Array(options.minorColor),
          },
          u_backgroundColor: {
            type: "vec4<f32>",
            value: new Float32Array(options.backgroundColor),
          },
          u_majorGridSize: { type: "f32", value: options.majorGridSize },
          u_minorGridSize: { type: "f32", value: options.minorGridSize },
          u_majorLineWidth: { type: "f32", value: options.majorLineWidth },
          u_minorLineWidth: { type: "f32", value: options.minorLineWidth },
        },
      },
    });
  }

  #createMesh(options: Required<GridOptions>) {
    this.#mesh = new Mesh({
      geometry: this.#createGeometry(),
      shader: this.#createShader(options),
    });
  }

  update() {
    if (!this.#mesh) return;

    const viewport = this.#world.getViewport();
    const position = this.#world.getPosition();
    const scale = this.#world.getScale();

    const uniforms = this.#mesh.shader!.resources.gridUniforms.uniforms;
    uniforms.u_resolution = new Float32Array([viewport.width, viewport.height]);
    uniforms.u_offset = new Float32Array([-position.x, position.y]);
    uniforms.u_zoom = scale;
  }

  getMesh() {
    if (!this.#mesh) throw new Error("Mesh not created");
    return this.#mesh;
  }

  resize(width: number, height: number) {
    if (!this.#mesh) return;
    this.#mesh.shader!.resources.gridUniforms.uniforms.u_resolution = new Float32Array([
      width,
      height,
    ]);
  }
}
