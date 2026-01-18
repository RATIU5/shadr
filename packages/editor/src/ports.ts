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
	float: 0x808080,
	int: 0x808080,
	vec2: 0x2196f3,
	vec3: 0x2196f3,
	vec4: 0x2196f3,
	texture: 0x4caf50,
	color: 0xffeb3b,
};
