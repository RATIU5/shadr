export const gridFragShader = `
precision mediump float;

uniform float u_dotSize;
uniform vec2 u_offset;
uniform float u_zoom;

out vec4 finalColor;

const vec3 BACKGROUND_COLOR = vec3(0.1);
const vec3 BASE_DOT_COLOR = vec3(0.175);
const vec3 LIGHTER_DOT_COLOR = vec3(0.3);
const float DOT_SPACING = 20.0;

void main() {
    vec2 pos = (gl_FragCoord.xy - u_offset) / (DOT_SPACING * u_zoom);
    vec2 gridPos = fract(pos) - 0.5;
    
    float dotSize = u_dotSize * 0.1;
    float dot = smoothstep(dotSize + 0.05, dotSize, length(gridPos));
    
    vec2 gridIndex = floor(pos);
    float highlight = float(mod(gridIndex.x, 5.0) == 2.0 && mod(gridIndex.y, 5.0) == 2.0);
    
    finalColor = vec4(mix(BACKGROUND_COLOR, mix(BASE_DOT_COLOR, LIGHTER_DOT_COLOR, highlight), dot), 1.0);
}`;

export const gridVertShader = `
precision mediump float;

in vec2 aPosition;
uniform vec2 u_size;

void main() {
    gl_Position = vec4((aPosition / u_size) * 2.0 - 1.0, 0.0, 1.0);
}`;
