#version 100 

precision mediump float;

uniform float u_dotSize;
uniform vec2 u_mousePos;
uniform vec2 u_size;

void main() {
    float dotWeight = 0.025;

    vec2 screenCoords = gl_FragCoord.xy / u_size;
    vec2 gridCoords = screenCoords * u_size / u_dotSize;

    vec2 nearestGridPoint = floor(gridCoords) + 0.5;
    float dist = length(gridCoords - nearestGridPoint);

    float edgeWidth = 0.01;
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
