#version 100 

precision mediump float;

attribute vec2 position;

uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;

void main() {
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
}
