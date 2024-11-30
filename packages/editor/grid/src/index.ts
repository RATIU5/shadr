import { Geometry, Mesh, Shader } from "pixi.js";
import { World } from "@shadr/editor-core";
import { EventBus } from "@shadr/editor-events";

export type RequiredEvents = {
  "editor:drag": { x: number; y: number };
  "editor:zoom": {
    scale: number;
    position: { x: number; y: number };
  };
};

export class Grid {
  #mesh: Mesh<Geometry, Shader> | null = null;
  #world: World | null = null;
  #eventBus: EventBus<RequiredEvents> | null = null;

  // Constants for grid appearance
  static readonly GRID_COLORS = {
    background: [0.1, 0.1, 0.1],
    primaryGrid: [0.2, 0.2, 0.2],
    secondaryGrid: [0.15, 0.15, 0.15],
  };

  init(world: World, eventBus: EventBus<RequiredEvents>) {
    this.#world = world;
    this.#eventBus = eventBus;
    this.#mesh = new Mesh({
      geometry: this.#createGeometry(),
      shader: this.#createShader(),
    });

    const { x: width, y: height } = world.getDimensions();
    this.setPosition(-width / 2, -height / 2);
    this.updateUniforms();

    this.#eventBus.on("editor:drag", (e) => {
      this.setUniform("u_offset", new Float32Array([e.x, e.y]));
    });
    this.#eventBus.on("editor:zoom", (e) => {
      this.setUniform("u_zoom", e.scale);
      this.setUniform("u_offset", new Float32Array([e.position.x, e.position.y]));
    });
  }

  #createGeometry(): Geometry {
    // Create a full-screen quad
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

  #createShader(): Shader {
    const { x: width, y: height } = this.#world?.getDimensions() ?? { x: 0, y: 0 };

    return Shader.from({
      gl: {
        vertex: this.#getVertexShader(),
        fragment: this.#getFragmentShader(),
      },
      resources: {
        gridUniforms: {
          u_resolution: { type: "vec2<f32>", value: new Float32Array([width, height]) },
          u_zoom: { type: "f32", value: 1.0 },
          u_offset: { type: "vec2<f32>", value: new Float32Array([0, 0]) },
          u_gridScale: { type: "f32", value: 1.0 },
          u_backgroundColor: {
            type: "vec3<f32>",
            value: new Float32Array(Grid.GRID_COLORS.background),
          },
          u_primaryColor: {
            type: "vec3<f32>",
            value: new Float32Array(Grid.GRID_COLORS.primaryGrid),
          },
          u_secondaryColor: {
            type: "vec3<f32>",
            value: new Float32Array(Grid.GRID_COLORS.secondaryGrid),
          },
        },
      },
    });
  }

  updateUniforms() {
    if (!this.#mesh || !this.#world) return;

    const position = this.#world.getPosition();
    const zoom = this.#world.getZoom();
    const dimensions = this.#world.getDimensions();

    this.setUniform("u_zoom", zoom);
    this.setUniform("u_offset", new Float32Array([position.x, position.y]));
    this.setUniform("u_resolution", new Float32Array([dimensions.x, dimensions.y]));
  }

  setPosition(x: number, y: number) {
    this.#mesh?.position.set(x, y);
  }

  setUniform<T>(name: string, value: T) {
    const uniforms = this.#mesh?.shader?.resources.gridUniforms.uniforms;
    if (!uniforms) return;
    if (name in uniforms) uniforms[name] = value;
  }

  getMesh(): Mesh<Geometry, Shader> {
    if (!this.#mesh) throw new Error("Grid not initialized");
    return this.#mesh;
  }

  #getVertexShader(): string {
    return `#version 300 es
    precision mediump float;

    in vec2 aPosition;
    
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`;
  }

  #getFragmentShader(): string {
    return `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform float u_zoom;

out vec4 fragColor;

const float MIN_ZOOM = 0.5;
const float MAX_ZOOM = 1.0;
const float FADE_RANGE = 0.5;
const float MAJOR_LINE_WIDTH = 1.0;
const float MINOR_LINE_WIDTH = 1.0;
const float MAJOR_GRID_SIZE = 100.0;
const float MINOR_GRID_SIZE = 10.0;
const vec4 MAJOR_COLOR = vec4(0.3, 0.3, 0.3, 1.0);
const vec4 MINOR_COLOR = vec4(0.2, 0.2, 0.2, 1.0);
const vec4 BACKGROUND_COLOR = vec4(0.1, 0.1, 0.1, 1.0);


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
  return floor(log2(zoom * MINOR_GRID_SIZE));
}

float calculateLevelFade(float zoom) {
  float level = getGridLevel(zoom);
  float fractionalPart = fract(level);
  return smoothstep(0.0, FADE_RANGE, fractionalPart);
}

vec4 calculateFinalGridColor(vec2 worldPos, float zoom) {
  vec4 baseColor = BACKGROUND_COLOR;

  vec2 majorCoord = mod(worldPos + MAJOR_GRID_SIZE / 2.0, MAJOR_GRID_SIZE) - MAJOR_GRID_SIZE / 2.0;
  if (isOnLine(majorCoord, MAJOR_LINE_WIDTH)) {
    return MAJOR_COLOR;
  }

  vec2 minorCoord = mod(worldPos + MINOR_GRID_SIZE / 2.0, MINOR_GRID_SIZE) - MINOR_GRID_SIZE / 2.0;
  if (isOnLine(minorCoord, MINOR_LINE_WIDTH)) {
    float opacity = calculateMinorLineOpacity(zoom);
    return mix(baseColor, MINOR_COLOR, opacity);
  }
  
  return baseColor;
}

void main() {
    vec2 worldPos = screenToWorld(gl_FragCoord.xy);
    fragColor = calculateFinalGridColor(worldPos, u_zoom);
}`;
  }
}
