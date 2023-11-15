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
    vec3 color = mix(vec3(1.0), vec3(0.0), alpha);

    gl_FragColor = vec4(color, alpha);
}
