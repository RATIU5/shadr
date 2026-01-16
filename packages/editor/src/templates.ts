import type { NodeTemplate, SerializablePort } from "./types";

export const defaultPorts: SerializablePort[] = [
	{ id: "in-a", name: "A", type: "float", direction: "input" },
	{ id: "in-b", name: "B", type: "vec2", direction: "input" },
	{ id: "out", name: "Out", type: "vec4", direction: "output" },
];

export const nodeTemplates: NodeTemplate[] = [
	{
		id: "const-float",
		label: "Constant Float",
		title: "Float",
		ports: [{ id: "out", name: "Value", type: "float", direction: "output" }],
	},
	{
		id: "const-vec2",
		label: "Constant Vec2",
		title: "Vec2",
		ports: [{ id: "out", name: "Value", type: "vec2", direction: "output" }],
	},
	{
		id: "const-vec3",
		label: "Constant Vec3",
		title: "Vec3",
		ports: [{ id: "out", name: "Value", type: "vec3", direction: "output" }],
	},
	{
		id: "const-vec4",
		label: "Constant Vec4",
		title: "Vec4",
		ports: [{ id: "out", name: "Value", type: "vec4", direction: "output" }],
	},
	{
		id: "const-color",
		label: "Constant Color",
		title: "Color",
		ports: [{ id: "out", name: "Color", type: "color", direction: "output" }],
	},
	{
		id: "input-uv",
		label: "Input UV",
		title: "UV Input",
		ports: [{ id: "out", name: "UV", type: "vec2", direction: "output" }],
	},
	{
		id: "input-position",
		label: "Input Position",
		title: "Position Input",
		ports: [{ id: "out", name: "Position", type: "vec3", direction: "output" }],
	},
	{
		id: "input-time",
		label: "Input Time",
		title: "Time Input",
		ports: [{ id: "out", name: "Time", type: "float", direction: "output" }],
	},
	{
		id: "input-texture",
		label: "Input Texture",
		title: "Texture Input",
		ports: [
			{ id: "out", name: "Texture", type: "texture", direction: "output" },
		],
	},
	{
		id: "math-add",
		label: "Add (Float)",
		title: "Add",
		ports: [
			{ id: "a", name: "A", type: "float", direction: "input" },
			{ id: "b", name: "B", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "math-add-vec2",
		label: "Add (Vec2)",
		title: "Add Vec2",
		ports: [
			{ id: "a", name: "A", type: "vec2", direction: "input" },
			{ id: "b", name: "B", type: "vec2", direction: "input" },
			{ id: "out", name: "Out", type: "vec2", direction: "output" },
		],
	},
	{
		id: "math-add-vec3",
		label: "Add (Vec3)",
		title: "Add Vec3",
		ports: [
			{ id: "a", name: "A", type: "vec3", direction: "input" },
			{ id: "b", name: "B", type: "vec3", direction: "input" },
			{ id: "out", name: "Out", type: "vec3", direction: "output" },
		],
	},
	{
		id: "math-add-vec4",
		label: "Add (Vec4)",
		title: "Add Vec4",
		ports: [
			{ id: "a", name: "A", type: "vec4", direction: "input" },
			{ id: "b", name: "B", type: "vec4", direction: "input" },
			{ id: "out", name: "Out", type: "vec4", direction: "output" },
		],
	},
	{
		id: "math-multiply",
		label: "Multiply (Float)",
		title: "Multiply",
		ports: [
			{ id: "a", name: "A", type: "float", direction: "input" },
			{ id: "b", name: "B", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "math-multiply-vec2",
		label: "Multiply (Vec2)",
		title: "Multiply Vec2",
		ports: [
			{ id: "a", name: "A", type: "vec2", direction: "input" },
			{ id: "b", name: "B", type: "vec2", direction: "input" },
			{ id: "out", name: "Out", type: "vec2", direction: "output" },
		],
	},
	{
		id: "math-multiply-vec3",
		label: "Multiply (Vec3)",
		title: "Multiply Vec3",
		ports: [
			{ id: "a", name: "A", type: "vec3", direction: "input" },
			{ id: "b", name: "B", type: "vec3", direction: "input" },
			{ id: "out", name: "Out", type: "vec3", direction: "output" },
		],
	},
	{
		id: "math-multiply-vec4",
		label: "Multiply (Vec4)",
		title: "Multiply Vec4",
		ports: [
			{ id: "a", name: "A", type: "vec4", direction: "input" },
			{ id: "b", name: "B", type: "vec4", direction: "input" },
			{ id: "out", name: "Out", type: "vec4", direction: "output" },
		],
	},
	{
		id: "math-subtract",
		label: "Subtract (Float)",
		title: "Subtract",
		ports: [
			{ id: "a", name: "A", type: "float", direction: "input" },
			{ id: "b", name: "B", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "math-subtract-vec2",
		label: "Subtract (Vec2)",
		title: "Subtract Vec2",
		ports: [
			{ id: "a", name: "A", type: "vec2", direction: "input" },
			{ id: "b", name: "B", type: "vec2", direction: "input" },
			{ id: "out", name: "Out", type: "vec2", direction: "output" },
		],
	},
	{
		id: "math-subtract-vec3",
		label: "Subtract (Vec3)",
		title: "Subtract Vec3",
		ports: [
			{ id: "a", name: "A", type: "vec3", direction: "input" },
			{ id: "b", name: "B", type: "vec3", direction: "input" },
			{ id: "out", name: "Out", type: "vec3", direction: "output" },
		],
	},
	{
		id: "math-subtract-vec4",
		label: "Subtract (Vec4)",
		title: "Subtract Vec4",
		ports: [
			{ id: "a", name: "A", type: "vec4", direction: "input" },
			{ id: "b", name: "B", type: "vec4", direction: "input" },
			{ id: "out", name: "Out", type: "vec4", direction: "output" },
		],
	},
	{
		id: "math-divide",
		label: "Divide (Float)",
		title: "Divide",
		ports: [
			{ id: "a", name: "A", type: "float", direction: "input" },
			{ id: "b", name: "B", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "math-divide-vec2",
		label: "Divide (Vec2)",
		title: "Divide Vec2",
		ports: [
			{ id: "a", name: "A", type: "vec2", direction: "input" },
			{ id: "b", name: "B", type: "vec2", direction: "input" },
			{ id: "out", name: "Out", type: "vec2", direction: "output" },
		],
	},
	{
		id: "math-divide-vec3",
		label: "Divide (Vec3)",
		title: "Divide Vec3",
		ports: [
			{ id: "a", name: "A", type: "vec3", direction: "input" },
			{ id: "b", name: "B", type: "vec3", direction: "input" },
			{ id: "out", name: "Out", type: "vec3", direction: "output" },
		],
	},
	{
		id: "math-divide-vec4",
		label: "Divide (Vec4)",
		title: "Divide Vec4",
		ports: [
			{ id: "a", name: "A", type: "vec4", direction: "input" },
			{ id: "b", name: "B", type: "vec4", direction: "input" },
			{ id: "out", name: "Out", type: "vec4", direction: "output" },
		],
	},
	{
		id: "math-clamp",
		label: "Clamp (Float)",
		title: "Clamp",
		ports: [
			{ id: "in", name: "In", type: "float", direction: "input" },
			{ id: "min", name: "Min", type: "float", direction: "input" },
			{ id: "max", name: "Max", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "math-clamp-vec2",
		label: "Clamp (Vec2)",
		title: "Clamp Vec2",
		ports: [
			{ id: "in", name: "In", type: "vec2", direction: "input" },
			{ id: "min", name: "Min", type: "vec2", direction: "input" },
			{ id: "max", name: "Max", type: "vec2", direction: "input" },
			{ id: "out", name: "Out", type: "vec2", direction: "output" },
		],
	},
	{
		id: "math-clamp-vec3",
		label: "Clamp (Vec3)",
		title: "Clamp Vec3",
		ports: [
			{ id: "in", name: "In", type: "vec3", direction: "input" },
			{ id: "min", name: "Min", type: "vec3", direction: "input" },
			{ id: "max", name: "Max", type: "vec3", direction: "input" },
			{ id: "out", name: "Out", type: "vec3", direction: "output" },
		],
	},
	{
		id: "math-clamp-vec4",
		label: "Clamp (Vec4)",
		title: "Clamp Vec4",
		ports: [
			{ id: "in", name: "In", type: "vec4", direction: "input" },
			{ id: "min", name: "Min", type: "vec4", direction: "input" },
			{ id: "max", name: "Max", type: "vec4", direction: "input" },
			{ id: "out", name: "Out", type: "vec4", direction: "output" },
		],
	},
	{
		id: "math-sine",
		label: "Sine (Float)",
		title: "Sine",
		ports: [
			{ id: "in", name: "In", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "math-sine-vec2",
		label: "Sine (Vec2)",
		title: "Sine Vec2",
		ports: [
			{ id: "in", name: "In", type: "vec2", direction: "input" },
			{ id: "out", name: "Out", type: "vec2", direction: "output" },
		],
	},
	{
		id: "math-sine-vec3",
		label: "Sine (Vec3)",
		title: "Sine Vec3",
		ports: [
			{ id: "in", name: "In", type: "vec3", direction: "input" },
			{ id: "out", name: "Out", type: "vec3", direction: "output" },
		],
	},
	{
		id: "math-sine-vec4",
		label: "Sine (Vec4)",
		title: "Sine Vec4",
		ports: [
			{ id: "in", name: "In", type: "vec4", direction: "input" },
			{ id: "out", name: "Out", type: "vec4", direction: "output" },
		],
	},
	{
		id: "math-cosine",
		label: "Cosine (Float)",
		title: "Cosine",
		ports: [
			{ id: "in", name: "In", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "math-cosine-vec2",
		label: "Cosine (Vec2)",
		title: "Cosine Vec2",
		ports: [
			{ id: "in", name: "In", type: "vec2", direction: "input" },
			{ id: "out", name: "Out", type: "vec2", direction: "output" },
		],
	},
	{
		id: "math-cosine-vec3",
		label: "Cosine (Vec3)",
		title: "Cosine Vec3",
		ports: [
			{ id: "in", name: "In", type: "vec3", direction: "input" },
			{ id: "out", name: "Out", type: "vec3", direction: "output" },
		],
	},
	{
		id: "math-cosine-vec4",
		label: "Cosine (Vec4)",
		title: "Cosine Vec4",
		ports: [
			{ id: "in", name: "In", type: "vec4", direction: "input" },
			{ id: "out", name: "Out", type: "vec4", direction: "output" },
		],
	},
	{
		id: "math-lerp",
		label: "Lerp (Float)",
		title: "Lerp",
		ports: [
			{ id: "a", name: "A", type: "float", direction: "input" },
			{ id: "b", name: "B", type: "float", direction: "input" },
			{ id: "t", name: "T", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "math-lerp-vec2",
		label: "Lerp (Vec2)",
		title: "Lerp Vec2",
		ports: [
			{ id: "a", name: "A", type: "vec2", direction: "input" },
			{ id: "b", name: "B", type: "vec2", direction: "input" },
			{ id: "t", name: "T", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "vec2", direction: "output" },
		],
	},
	{
		id: "math-lerp-vec3",
		label: "Lerp (Vec3)",
		title: "Lerp Vec3",
		ports: [
			{ id: "a", name: "A", type: "vec3", direction: "input" },
			{ id: "b", name: "B", type: "vec3", direction: "input" },
			{ id: "t", name: "T", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "vec3", direction: "output" },
		],
	},
	{
		id: "math-lerp-vec4",
		label: "Lerp (Vec4)",
		title: "Lerp Vec4",
		ports: [
			{ id: "a", name: "A", type: "vec4", direction: "input" },
			{ id: "b", name: "B", type: "vec4", direction: "input" },
			{ id: "t", name: "T", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "vec4", direction: "output" },
		],
	},
	{
		id: "texture-sample",
		label: "Texture Sample",
		title: "Texture Sample",
		ports: [
			{ id: "tex", name: "Texture", type: "texture", direction: "input" },
			{ id: "uv", name: "UV", type: "vec2", direction: "input" },
			{ id: "out", name: "Color", type: "vec4", direction: "output" },
		],
	},
	{
		id: "vertex-output",
		label: "Vertex Output",
		title: "Vertex Output",
		ports: [
			{ id: "position", name: "Position", type: "vec3", direction: "input" },
		],
	},
	{
		id: "fragment-output",
		label: "Fragment Output",
		title: "Fragment Output",
		ports: [{ id: "color", name: "Color", type: "vec4", direction: "input" }],
	},
];
