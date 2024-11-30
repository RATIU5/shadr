export const gridFragShader = `
#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_scroll_offset;
uniform float u_zoom;
uniform vec4 u_grid_color;
uniform vec4 u_grid_emphasis_color;
uniform float u_line_width;

out vec4 fragColor;

#define M_1_SQRTPI 0.5641895835477563
#define DISC_RADIUS (M_1_SQRTPI * 1.05)
#define GRID_LINE_SMOOTH_START (0.5 + DISC_RADIUS)
#define GRID_LINE_SMOOTH_END (0.5 - DISC_RADIUS)

float gridLine(float dist) {
    return smoothstep(GRID_LINE_SMOOTH_START, GRID_LINE_SMOOTH_END, dist);
}

float linearstep(float edge0, float edge1, float x) {
    return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

float getGrid(vec2 coord, vec2 size) {
    vec2 half_size = size * 0.5;
    vec2 grid_domain = abs(mod(coord + half_size, size) - half_size);
    
    // Scale by zoom to maintain constant line width
    grid_domain *= u_zoom;
    float line_dist = min(grid_domain.x, grid_domain.y);
    return gridLine(line_dist - u_line_width);
}

void main() {
    // Convert to world space
    vec2 pos = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
    pos *= u_resolution / min(u_resolution.x, u_resolution.y);
    pos = pos * (1.0 / u_zoom) + u_scroll_offset;

    // Grid scaling factors
    float grid_res = 1.0 / u_zoom;
    
    // Grid sizes for different detail levels
    vec2 scaleA = vec2(20.0);
    vec2 scaleB = vec2(100.0);
    vec2 scaleC = vec2(500.0);

    // Calculate blend factor between grid levels
    float blend = 1.0 - linearstep(scaleA.x, scaleB.x, grid_res);
    blend = blend * blend * blend;

    // Calculate grids at different scales
    float gridA = getGrid(pos, scaleA);
    float gridB = getGrid(pos, scaleB);
    float gridC = getGrid(pos, scaleC);

    // Blend between grid levels
    fragColor = u_grid_color;
    fragColor.a *= gridA * blend;
    fragColor = mix(fragColor, mix(u_grid_color, u_grid_emphasis_color, blend), gridB);
    fragColor = mix(fragColor, u_grid_emphasis_color, gridC);

    // Fade out based on zoom level
    float fade = 1.0 - smoothstep(0.0, 0.5, abs(grid_res - 0.5));
    fragColor.a *= fade;

    // Distance fade
    float dist = length(pos);
    fragColor.a *= 1.0 - smoothstep(0.0, 2000.0, dist);
}`;

export const gridVertShader = `
precision mediump float;

in vec2 aPosition;
uniform vec2 u_size;

void main() {
    gl_Position = vec4((aPosition / u_size) * 2.0 - 1.0, 0.0, 1.0);
}`;
