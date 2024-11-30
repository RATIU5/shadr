export const gridFragShader = `
precision mediump float;

uniform float u_dotSize;
uniform vec2 u_offset;
uniform float u_zoom;
uniform vec2 u_size;
uniform vec2 u_zoomPosition;

out vec4 finalColor;

const vec3 BACKGROUND_COLOR = vec3(0.1);
const vec3 BASE_DOT_COLOR = vec3(0.3);
const vec3 LIGHTER_DOT_COLOR = vec3(0.6);
const float DOT_SPACING = 20.0;

void main() {
    vec2 screenPos = gl_FragCoord.xy;
    vec2 mouseScreenPos = u_zoomPosition * u_size;
    vec2 adjustedOffset = u_offset / u_size * 2.0;
    
    // Calculate zoomed position relative to mouse
    vec2 relativePos = (screenPos - mouseScreenPos) / u_zoom + mouseScreenPos;
    vec2 pos = relativePos / DOT_SPACING;
    pos += vec2(-adjustedOffset.x * u_size.x, adjustedOffset.y * u_size.y) / DOT_SPACING;
    
    vec2 gridPos = fract(pos) - 0.5;
    
    float dotSize = u_dotSize * 0.1;
    float antialiasEdge = 0.02 / u_zoom;
    float dot = smoothstep(dotSize + antialiasEdge, dotSize, length(gridPos));
    
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