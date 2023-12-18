export default `#version 100 

precision mediump float;

uniform float u_dotSize;
uniform vec2 u_dragOffset;
uniform vec2 u_size;
uniform float u_zoom;

const float DOT_WEIGHT = 0.025;
const float EDGE_WIDTH = 0.01;
const vec3 BACKGROUND_COLOR = vec3(0.1);
const vec3 BASE_DOT_COLOR = vec3(0.175);
const vec3 LIGHTER_DOT_COLOR = vec3(0.3);
const float DOT_SPACING = 0.02;

// Calculate normalized mouse position based on drag offset and canvas size
vec2 getNormalizedMousePos() {
  vec2 pos = u_dragOffset / u_size;
  pos.y = pos.y * -2.0;
  pos.x = pos.x * 2.0;
  return pos;
}

// Calculate the screen coordinates
vec2 getScreenCoords(vec2 normalizedMousePos) {
  vec2 zoomAdjustedCoords = (gl_FragCoord.xy / u_size - 0.5) * u_zoom + 0.5;
  return zoomAdjustedCoords - normalizedMousePos;
}

// Calculate grid coordinates, keeping the original dot size
vec2 getGridCoords(vec2 screenCoords) {
  return screenCoords * u_size * DOT_SPACING;
}

// Determine the distance to the nearest grid point
float getDistanceToNearestGridPoint(vec2 gridCoords) {
  vec2 nearestGridPoint = floor(gridCoords) + 0.5;
  return length((gridCoords - nearestGridPoint) / (u_dotSize * DOT_SPACING * u_zoom));
}

// Compute alpha value for blending
float computeAlpha(float dist) {
  float baseAlpha = 1.0 - smoothstep(DOT_WEIGHT - EDGE_WIDTH, DOT_WEIGHT + EDGE_WIDTH, dist);
  return mix(baseAlpha, min(baseAlpha, 1.0), 1.0);
}

// Calculate highlight factor based on grid position
float getHighlight(vec2 nearestGridPoint) {
  vec2 modCoords = mod(nearestGridPoint, 5.0);
  return 1.0 - step(0.1, length(modCoords - vec2(2.5)));
}

// Compute color based on zoom factor and highlight
vec3 computeColor(float alpha, float highlight) {
  vec3 newBaseDotColor = mix(BASE_DOT_COLOR, LIGHTER_DOT_COLOR, highlight);
  vec3 newLighterDotColor = LIGHTER_DOT_COLOR;
  vec3 dotColor = mix(newBaseDotColor, newLighterDotColor, highlight);
  return mix(BACKGROUND_COLOR, dotColor, alpha);
}

void main() {
  vec2 normalizedMousePos = getNormalizedMousePos();
  vec2 screenCoords = getScreenCoords(normalizedMousePos);
  vec2 gridCoords = getGridCoords(screenCoords);
  float dist = getDistanceToNearestGridPoint(gridCoords);
  float highlight = getHighlight(floor(gridCoords) + 0.5);
  float alpha = computeAlpha(dist);
  vec3 color = computeColor(alpha, highlight);
  gl_FragColor = vec4(color, 1.0);
}`;
