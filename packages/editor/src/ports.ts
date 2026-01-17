import type { PortType } from "./types";

export const portTypeOrder: PortType[] = [
	"float",
	"int",
	"vec2",
	"vec3",
	"vec4",
	"texture",
	"color",
];

export const portTypeLabels: Record<PortType, string> = {
	float: "Float",
	int: "Int",
	vec2: "Vec2",
	vec3: "Vec3",
	vec4: "Vec4",
	texture: "Texture",
	color: "Color",
};

export const portTypeColors: Record<PortType, number> = {
	float: 0x4fb6f5,
	int: 0x9aa0a6,
	vec2: 0x55c181,
	vec3: 0x46a664,
	vec4: 0x2d8f48,
	texture: 0xf3a552,
	color: 0xd96bd8,
};
