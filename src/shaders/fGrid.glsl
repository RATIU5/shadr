#version 100 

precision mediump float;

uniform float u_dotSize;
uniform float u_gridSpacing;
uniform vec2 u_dragOffset;
uniform vec2 u_size;
uniform float u_zoom;

void main() {
  float dotWeight = 0.025;
  float edgeWidth = 0.01;

  vec2 normalizedMousePos = u_dragOffset / u_size;
  normalizedMousePos.y = normalizedMousePos.y * -2.;
  normalizedMousePos.x = normalizedMousePos.x * 2.;

  vec2 screenCoords = (gl_FragCoord.xy / u_size) - normalizedMousePos;

  vec2 gridCoords = screenCoords * u_size / u_gridSpacing;

  vec2 nearestGridPoint = floor(gridCoords) + 0.5;
  float dist = length((gridCoords - nearestGridPoint) * u_gridSpacing / u_dotSize);
  

  float alpha = 1.0 - smoothstep(dotWeight - edgeWidth, dotWeight + edgeWidth, dist);

  vec2 modCoords = mod(nearestGridPoint, 5.0);
  float highlight = 1.0 - step(0.1, length(modCoords - vec2(2.5)));

  vec3 backgroundColor = vec3(0.05);
  vec3 baseDotColor = vec3(0.2);
  vec3 lighterDotColor = vec3(0.4);

  vec3 dotColor = mix(baseDotColor, lighterDotColor, highlight);
  vec3 color = mix(backgroundColor, dotColor, alpha);

  gl_FragColor = vec4(color, 1.0);
}
