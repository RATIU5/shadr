import {
	buildMathPorts,
	getMathOperationId,
	getMathOperationLabel,
	type MathNodeType,
	mathOperationEntries,
} from "./math-ops";
import type {
	NodeDefinition,
	NodeParamSpec,
	NodeSocket,
	NodeSocketUiSpec,
	NodeSocketValue,
	NodeState,
	PortType,
	SerializablePort,
} from "./types";

type VectorNodeType = "vec2" | "vec3" | "vec4";
const nodeDefinitions = new Map<string, NodeDefinition>();

const defaultConstColor = { r: 1, g: 1, b: 1, a: 1 };
const defaultVector = { x: 0, y: 0, z: 0, w: 0 };
const defaultInputColor = { r: 1, g: 1, b: 1, a: 1 };
const defaultInputOptions = ["Option A", "Option B", "Option C"];

const mathTypes: MathNodeType[] = ["float", "vec2", "vec3", "vec4"];
const rerouteTypes: PortType[] = [
	"float",
	"int",
	"vec2",
	"vec3",
	"vec4",
	"color",
	"texture",
];

const formatTypeLabel = (type: string) =>
	type === "float"
		? "Float"
		: type === "vec2"
			? "Vec2"
			: type === "vec3"
				? "Vec3"
				: type === "vec4"
					? "Vec4"
					: type;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const formatDisplayFloat = (value: number) => {
	if (!Number.isFinite(value)) {
		return "0";
	}
	const rounded = Math.round(value * 1000) / 1000;
	return rounded.toString();
};
const formatDisplayVector = (values: number[]) =>
	values.map((value) => formatDisplayFloat(value)).join(", ");
const formatDisplayColor = (color: { r: number; g: number; b: number }) => {
	const channel = (value: number) =>
		Math.min(255, Math.max(0, Math.round(value * 255)))
			.toString(16)
			.padStart(2, "0");
	return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
};

const getDefaultSocketValue = (type: PortType): NodeSocketValue => {
	switch (type) {
		case "float":
		case "int":
			return 0;
		case "vec2":
			return { x: 0, y: 0 };
		case "vec3":
			return { x: 0, y: 0, z: 0 };
		case "vec4":
			return { x: 0, y: 0, z: 0, w: 0 };
		case "color":
			return { r: 1, g: 1, b: 1, a: 1 };
		case "texture":
			return "u_texture";
	}
};

const getInputSocketUiSpec = (
	port: SerializablePort,
): NodeSocketUiSpec | undefined => {
	if (port.direction !== "input") {
		return undefined;
	}
	switch (port.type) {
		case "float":
			return {
				kind: "float",
				label: port.name,
				tab: "Details",
				section: "Inputs",
			};
		case "int":
			return {
				kind: "int",
				label: port.name,
				tab: "Details",
				section: "Inputs",
			};
		case "vec2":
			return {
				kind: "vec2",
				label: port.name,
				tab: "Details",
				section: "Inputs",
			};
		case "vec3":
			return {
				kind: "vec3",
				label: port.name,
				tab: "Details",
				section: "Inputs",
			};
		case "vec4":
			return {
				kind: "vec4",
				label: port.name,
				tab: "Details",
				section: "Inputs",
			};
		case "color":
			return {
				kind: "color",
				label: port.name,
				tab: "Details",
				section: "Inputs",
			};
		case "texture":
			return undefined;
	}
};

const buildSocket = (
	port: SerializablePort,
	overrides: Partial<NodeSocket> = {},
): NodeSocket => {
	const uiSpec = overrides.uiSpec ?? getInputSocketUiSpec(port);
	return {
		id: port.id,
		label: port.name,
		direction: port.direction,
		dataType: port.type,
		defaultValue: getDefaultSocketValue(port.type),
		...(uiSpec ? { uiSpec } : {}),
		...overrides,
	};
};

const buildSocketsFromPorts = (
	ports: SerializablePort[],
	overrides: Record<string, Partial<NodeSocket>> = {},
): NodeSocket[] => ports.map((port) => buildSocket(port, overrides[port.id]));

const getStringParam = (state: NodeState, id: string, fallback: string) => {
	const value = state.params[id];
	return typeof value === "string" ? value : fallback;
};

const getSocketValue = <T extends NodeSocketValue>(
	socketValues: Record<string, NodeSocketValue> | undefined,
	id: string,
	fallback: T,
) => {
	const value = socketValues?.[id];
	return (value !== undefined ? value : fallback) as T;
};

type OperationDefinition = {
	id: string;
	label: string;
	ports: SerializablePort[];
};
const buildVectorComposePorts = (type: VectorNodeType): SerializablePort[] => {
	const components =
		type === "vec2"
			? ["x", "y"]
			: type === "vec3"
				? ["x", "y", "z"]
				: ["x", "y", "z", "w"];
	return [
		...components.map((component) => ({
			id: component,
			name: component.toUpperCase(),
			type: "float" as const,
			direction: "input" as const,
		})),
		{ id: "out", name: "Out", type, direction: "output" },
	];
};

const buildVectorSplitPorts = (type: VectorNodeType): SerializablePort[] => {
	const outputs =
		type === "vec2"
			? ["x", "y"]
			: type === "vec3"
				? ["x", "y", "z"]
				: ["x", "y", "z", "w"];
	return [
		{ id: "in", name: "Vector", type, direction: "input" },
		...outputs.map((component) => ({
			id: component,
			name: component.toUpperCase(),
			type: "float" as const,
			direction: "output" as const,
		})),
	];
};

type VectorOperationDefinition = {
	id: string;
	label: string;
	types: VectorNodeType[];
	buildPorts: (type: VectorNodeType) => SerializablePort[];
};

const vectorOperations: VectorOperationDefinition[] = [
	{
		id: "position-input",
		label: "Input Position",
		types: ["vec3"],
		buildPorts: () => [
			{ id: "out", name: "Position", type: "vec3", direction: "output" },
		],
	},
	{
		id: "component",
		label: "Component",
		types: ["vec4"],
		buildPorts: () => [
			{ id: "in", name: "Vector", type: "vec4", direction: "input" },
			{ id: "out", name: "Out", type: "vec4", direction: "output" },
		],
	},
	{
		id: "compose",
		label: "Compose",
		types: ["vec2", "vec3", "vec4"],
		buildPorts: buildVectorComposePorts,
	},
	{
		id: "split",
		label: "Split",
		types: ["vec2", "vec3", "vec4"],
		buildPorts: buildVectorSplitPorts,
	},
	{
		id: "dot",
		label: "Dot",
		types: ["vec2", "vec3", "vec4"],
		buildPorts: (type) => [
			{ id: "a", name: "A", type, direction: "input" },
			{ id: "b", name: "B", type, direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "cross",
		label: "Cross",
		types: ["vec3"],
		buildPorts: (type) => [
			{ id: "a", name: "A", type, direction: "input" },
			{ id: "b", name: "B", type, direction: "input" },
			{ id: "out", name: "Out", type, direction: "output" },
		],
	},
	{
		id: "normalize",
		label: "Normalize",
		types: ["vec2", "vec3", "vec4"],
		buildPorts: (type) => [
			{ id: "in", name: "In", type, direction: "input" },
			{ id: "out", name: "Out", type, direction: "output" },
		],
	},
	{
		id: "length",
		label: "Length",
		types: ["vec2", "vec3", "vec4"],
		buildPorts: (type) => [
			{ id: "in", name: "In", type, direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "distance",
		label: "Distance",
		types: ["vec2", "vec3", "vec4"],
		buildPorts: (type) => [
			{ id: "a", name: "A", type, direction: "input" },
			{ id: "b", name: "B", type, direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "reflect",
		label: "Reflect",
		types: ["vec2", "vec3", "vec4"],
		buildPorts: (type) => [
			{ id: "i", name: "I", type, direction: "input" },
			{ id: "n", name: "N", type, direction: "input" },
			{ id: "out", name: "Out", type, direction: "output" },
		],
	},
	{
		id: "refract",
		label: "Refract",
		types: ["vec2", "vec3", "vec4"],
		buildPorts: (type) => [
			{ id: "i", name: "I", type, direction: "input" },
			{ id: "n", name: "N", type, direction: "input" },
			{ id: "eta", name: "Eta", type: "float", direction: "input" },
			{ id: "out", name: "Out", type, direction: "output" },
		],
	},
];

const getVectorOperation = (id?: string) =>
	vectorOperations.find((operation) => operation.id === id) ??
	vectorOperations[0];

const getVectorType = (
	op: VectorOperationDefinition,
	value?: string,
): VectorNodeType => {
	if (value === "vec2" || value === "vec3" || value === "vec4") {
		if (op.types.includes(value)) {
			return value;
		}
	}
	return op.types[0] ?? "vec2";
};

const buildColorPorts = (op?: string): SerializablePort[] => {
	if (op === "invert") {
		return [
			{ id: "in", name: "Color", type: "color", direction: "input" },
			{ id: "out", name: "Color", type: "color", direction: "output" },
		];
	}
	if (
		op === "gamma" ||
		op === "brightness" ||
		op === "contrast" ||
		op === "saturation"
	) {
		return [
			{ id: "in", name: "Color", type: "color", direction: "input" },
			{
				id: op,
				name: formatTypeLabel(op),
				type: "float",
				direction: "input",
			},
			{ id: "out", name: "Color", type: "color", direction: "output" },
		];
	}
	if (op === "mix") {
		return [
			{ id: "a", name: "A", type: "color", direction: "input" },
			{ id: "b", name: "B", type: "color", direction: "input" },
			{ id: "t", name: "T", type: "float", direction: "input" },
			{ id: "out", name: "Color", type: "color", direction: "output" },
		];
	}
	return [
		{ id: "a", name: "A", type: "color", direction: "input" },
		{ id: "b", name: "B", type: "color", direction: "input" },
		{ id: "out", name: "Color", type: "color", direction: "output" },
	];
};

const colorOperations = [
	{ id: "mix", label: "Mix" },
	{ id: "add", label: "Add" },
	{ id: "multiply", label: "Multiply" },
	{ id: "screen", label: "Screen" },
	{ id: "overlay", label: "Overlay" },
	{ id: "invert", label: "Invert" },
	{ id: "gamma", label: "Gamma" },
	{ id: "brightness", label: "Brightness" },
	{ id: "contrast", label: "Contrast" },
	{ id: "saturation", label: "Saturation" },
];

const conversionOperations: OperationDefinition[] = [
	{
		id: "float-to-int",
		label: "Float to Int",
		ports: [
			{ id: "in", name: "In", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "int", direction: "output" },
		],
	},
	{
		id: "int-to-float",
		label: "Int to Float",
		ports: [
			{ id: "in", name: "In", type: "int", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "vec2-to-vec3",
		label: "Vec2 to Vec3",
		ports: [
			{ id: "in", name: "In", type: "vec2", direction: "input" },
			{ id: "z", name: "Z", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "vec3", direction: "output" },
		],
	},
	{
		id: "vec3-to-vec4",
		label: "Vec3 to Vec4",
		ports: [
			{ id: "in", name: "In", type: "vec3", direction: "input" },
			{ id: "w", name: "W", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "vec4", direction: "output" },
		],
	},
	{
		id: "vec4-to-vec3",
		label: "Vec4 to Vec3",
		ports: [
			{ id: "in", name: "In", type: "vec4", direction: "input" },
			{ id: "out", name: "Out", type: "vec3", direction: "output" },
		],
	},
	{
		id: "vec3-to-vec2",
		label: "Vec3 to Vec2",
		ports: [
			{ id: "in", name: "In", type: "vec3", direction: "input" },
			{ id: "out", name: "Out", type: "vec2", direction: "output" },
		],
	},
];

const logicOperations: OperationDefinition[] = [
	{
		id: "and",
		label: "And",
		ports: [
			{ id: "a", name: "A", type: "float", direction: "input" },
			{ id: "b", name: "B", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "or",
		label: "Or",
		ports: [
			{ id: "a", name: "A", type: "float", direction: "input" },
			{ id: "b", name: "B", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "not",
		label: "Not",
		ports: [
			{ id: "in", name: "In", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "select",
		label: "Select (Float)",
		ports: [
			{ id: "a", name: "A", type: "float", direction: "input" },
			{ id: "b", name: "B", type: "float", direction: "input" },
			{ id: "cond", name: "Condition", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "select-vec2",
		label: "Select (Vec2)",
		ports: [
			{ id: "a", name: "A", type: "vec2", direction: "input" },
			{ id: "b", name: "B", type: "vec2", direction: "input" },
			{ id: "cond", name: "Condition", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "vec2", direction: "output" },
		],
	},
	{
		id: "select-vec3",
		label: "Select (Vec3)",
		ports: [
			{ id: "a", name: "A", type: "vec3", direction: "input" },
			{ id: "b", name: "B", type: "vec3", direction: "input" },
			{ id: "cond", name: "Condition", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "vec3", direction: "output" },
		],
	},
	{
		id: "select-vec4",
		label: "Select (Vec4)",
		ports: [
			{ id: "a", name: "A", type: "vec4", direction: "input" },
			{ id: "b", name: "B", type: "vec4", direction: "input" },
			{ id: "cond", name: "Condition", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "vec4", direction: "output" },
		],
	},
];

const textureOperations: OperationDefinition[] = [
	{
		id: "uv-input",
		label: "Input UV",
		ports: [{ id: "out", name: "UV", type: "vec2", direction: "output" }],
	},
	{
		id: "texture-input",
		label: "Input Texture",
		ports: [
			{ id: "out", name: "Texture", type: "texture", direction: "output" },
		],
	},
	{
		id: "time-input",
		label: "Input Time",
		ports: [{ id: "out", name: "Time", type: "float", direction: "output" }],
	},
	{
		id: "uv-scale",
		label: "UV Scale",
		ports: [
			{ id: "uv", name: "UV", type: "vec2", direction: "input" },
			{ id: "scale", name: "Scale", type: "vec2", direction: "input" },
			{ id: "out", name: "UV", type: "vec2", direction: "output" },
		],
	},
	{
		id: "uv-offset",
		label: "UV Offset",
		ports: [
			{ id: "uv", name: "UV", type: "vec2", direction: "input" },
			{ id: "offset", name: "Offset", type: "vec2", direction: "input" },
			{ id: "out", name: "UV", type: "vec2", direction: "output" },
		],
	},
	{
		id: "uv-rotate",
		label: "UV Rotate",
		ports: [
			{ id: "uv", name: "UV", type: "vec2", direction: "input" },
			{ id: "angle", name: "Angle", type: "float", direction: "input" },
			{ id: "center", name: "Center", type: "vec2", direction: "input" },
			{ id: "out", name: "UV", type: "vec2", direction: "output" },
		],
	},
	{
		id: "texture-sample",
		label: "Texture Sample",
		ports: [
			{ id: "tex", name: "Texture", type: "texture", direction: "input" },
			{ id: "uv", name: "UV", type: "vec2", direction: "input" },
			{ id: "out", name: "Color", type: "vec4", direction: "output" },
		],
	},
];

const outputOperations: OperationDefinition[] = [
	{
		id: "fragment",
		label: "Fragment Output",
		ports: [{ id: "color", name: "Color", type: "vec4", direction: "input" }],
	},
	{
		id: "vertex",
		label: "Vertex Output",
		ports: [
			{ id: "position", name: "Position", type: "vec3", direction: "input" },
		],
	},
];

const buildDefaultState = (params: NodeParamSpec[]): NodeState => ({
	version: 1,
	params: Object.fromEntries(
		params.map((spec) => [spec.id, spec.defaultValue]),
	),
});

const registerDefinition = (definition: NodeDefinition) => {
	nodeDefinitions.set(definition.id, definition);
};

const buildMathDefinition = (): NodeDefinition => {
	const parameters: NodeParamSpec[] = [
		{
			id: "operation",
			kind: "enum",
			label: "Operation",
			defaultValue: mathOperationEntries[0]?.id ?? "add",
			options: mathOperationEntries.map((entry) => ({
				value: entry.id,
				label: entry.label,
			})),
			ui: { tab: "Details", section: "Operation", order: 1, inline: true },
		},
		{
			id: "type",
			kind: "enum",
			label: "Type",
			defaultValue: "float",
			options: mathTypes.map((type) => ({
				value: type,
				label: formatTypeLabel(type),
			})),
			ui: { tab: "Details", section: "Operation", order: 2, inline: true },
		},
	];
	return {
		id: "math",
		label: "Math",
		category: "Math",
		tags: ["math", "numeric", "operation"],
		parameters,
		uiTabs: [{ id: "Details", label: "Details" }],
		buildSockets: (state) => {
			const op = getMathOperationId(getStringParam(state, "operation", "add"));
			const type = getStringParam(state, "type", "float");
			const mathType = mathTypes.includes(type as MathNodeType)
				? (type as MathNodeType)
				: "float";
			return buildSocketsFromPorts(buildMathPorts(mathType, op));
		},
		getBodyLabel: (state) => {
			const op = getMathOperationId(getStringParam(state, "operation", "add"));
			const type = getStringParam(state, "type", "float");
			return `Operation: ${getMathOperationLabel(op)} (${formatTypeLabel(type)})`;
		},
	};
};

const buildVectorDefinition = (): NodeDefinition => {
	const parameters: NodeParamSpec[] = [
		{
			id: "operation",
			kind: "enum",
			label: "Operation",
			defaultValue: "compose",
			options: vectorOperations.map((operation) => ({
				value: operation.id,
				label: operation.label,
			})),
			ui: { tab: "Details", section: "Operation", order: 1, inline: true },
		},
		{
			id: "type",
			kind: "enum",
			label: "Type",
			defaultValue: "vec2",
			options: [
				{ value: "vec2", label: "Vec2" },
				{ value: "vec3", label: "Vec3" },
				{ value: "vec4", label: "Vec4" },
			],
			ui: { tab: "Details", section: "Operation", order: 2, inline: true },
		},
		{
			id: "component",
			kind: "enum",
			label: "Component",
			defaultValue: "x",
			options: [
				{ value: "x", label: "X" },
				{ value: "y", label: "Y" },
				{ value: "z", label: "Z" },
				{ value: "w", label: "W" },
			],
			isVisible: (state) =>
				getStringParam(state, "operation", "compose") === "component",
			ui: { tab: "Details", section: "Operation", order: 3 },
		},
	];
	return {
		id: "vector",
		label: "Vector",
		category: "Vector",
		tags: ["vector", "compose", "split", "normalize", "dot", "cross"],
		parameters,
		uiTabs: [{ id: "Details", label: "Details" }],
		buildSockets: (state) => {
			const operation = getVectorOperation(
				getStringParam(state, "operation", "compose"),
			);
			const type = getVectorType(
				operation,
				getStringParam(state, "type", "vec2"),
			);
			return buildSocketsFromPorts(operation.buildPorts(type));
		},
		getBodyLabel: (state) => {
			const operation = getVectorOperation(
				getStringParam(state, "operation", "compose"),
			);
			const type = getVectorType(
				operation,
				getStringParam(state, "type", "vec2"),
			);
			return `Operation: ${operation.label} (${formatTypeLabel(type)})`;
		},
	};
};

const buildColorDefinition = (): NodeDefinition => {
	const parameters: NodeParamSpec[] = [
		{
			id: "operation",
			kind: "enum",
			label: "Operation",
			defaultValue: "mix",
			options: colorOperations.map((entry) => ({
				value: entry.id,
				label: entry.label,
			})),
			ui: { tab: "Details", section: "Operation", order: 1, inline: true },
		},
	];
	return {
		id: "color",
		label: "Color",
		category: "Color",
		tags: ["color", "mix", "multiply"],
		parameters,
		uiTabs: [{ id: "Details", label: "Details" }],
		buildSockets: (state) =>
			buildSocketsFromPorts(
				buildColorPorts(getStringParam(state, "operation", "mix")),
				{
					gamma: { defaultValue: 1 },
				},
			),
		getBodyLabel: (state) => {
			const op = colorOperations.find(
				(entry) => entry.id === getStringParam(state, "operation", "mix"),
			);
			return `Operation: ${op?.label ?? "Mix"}`;
		},
	};
};

const buildConversionDefinition = (): NodeDefinition => {
	const parameters: NodeParamSpec[] = [
		{
			id: "operation",
			kind: "enum",
			label: "Operation",
			defaultValue: conversionOperations[0]?.id ?? "float-to-int",
			options: conversionOperations.map((entry) => ({
				value: entry.id,
				label: entry.label,
			})),
			ui: { tab: "Details", section: "Operation", order: 1, inline: true },
		},
	];
	return {
		id: "conversion",
		label: "Conversion",
		category: "Conversion",
		tags: ["convert", "cast"],
		parameters,
		uiTabs: [{ id: "Details", label: "Details" }],
		buildSockets: (state) => {
			const op = conversionOperations.find(
				(entry) =>
					entry.id === getStringParam(state, "operation", "float-to-int"),
			);
			return buildSocketsFromPorts(
				op?.ports ?? conversionOperations[0]?.ports ?? [],
			);
		},
		getBodyLabel: (state) => {
			const op = conversionOperations.find(
				(entry) =>
					entry.id === getStringParam(state, "operation", "float-to-int"),
			);
			return `Operation: ${op?.label ?? "Float to Int"}`;
		},
	};
};

const buildLogicDefinition = (): NodeDefinition => {
	const parameters: NodeParamSpec[] = [
		{
			id: "operation",
			kind: "enum",
			label: "Operation",
			defaultValue: logicOperations[0]?.id ?? "and",
			options: logicOperations.map((entry) => ({
				value: entry.id,
				label: entry.label,
			})),
			ui: { tab: "Details", section: "Operation", order: 1, inline: true },
		},
	];
	return {
		id: "logic",
		label: "Logic",
		category: "Logic",
		tags: ["logic", "and", "or", "select"],
		parameters,
		uiTabs: [{ id: "Details", label: "Details" }],
		buildSockets: (state) => {
			const op = logicOperations.find(
				(entry) => entry.id === getStringParam(state, "operation", "and"),
			);
			return buildSocketsFromPorts(
				op?.ports ?? logicOperations[0]?.ports ?? [],
			);
		},
		getBodyLabel: (state) => {
			const op = logicOperations.find(
				(entry) => entry.id === getStringParam(state, "operation", "and"),
			);
			return `Operation: ${op?.label ?? "And"}`;
		},
	};
};

const buildTextureDefinition = (): NodeDefinition => {
	const parameters: NodeParamSpec[] = [
		{
			id: "operation",
			kind: "enum",
			label: "Operation",
			defaultValue: textureOperations[0]?.id ?? "uv-input",
			options: textureOperations.map((entry) => ({
				value: entry.id,
				label: entry.label,
			})),
			ui: { tab: "Details", section: "Operation", order: 1, inline: true },
		},
	];
	return {
		id: "texture-uv",
		label: "Texture/UV",
		category: "Texture/UV",
		tags: ["texture", "uv", "sample"],
		parameters,
		uiTabs: [{ id: "Details", label: "Details" }],
		buildSockets: (state) => {
			const op = textureOperations.find(
				(entry) => entry.id === getStringParam(state, "operation", "uv-input"),
			);
			const sockets = buildSocketsFromPorts(
				op?.ports ?? textureOperations[0]?.ports ?? [],
				{
					scale: { defaultValue: { x: 1, y: 1 } },
					center: { defaultValue: { x: 0.5, y: 0.5 } },
					uv: { defaultValue: "v_uv" },
				},
			);
			const textureOp = getStringParam(state, "operation", "uv-input");
			if (textureOp !== "texture-sample") {
				return sockets.map((socket) =>
					socket.id === "uv"
						? { ...socket, defaultValue: { x: 0, y: 0 } }
						: socket,
				);
			}
			return sockets;
		},
		getBodyLabel: (state) => {
			const op = textureOperations.find(
				(entry) => entry.id === getStringParam(state, "operation", "uv-input"),
			);
			return `Operation: ${op?.label ?? "Input UV"}`;
		},
	};
};

const buildOutputDefinition = (): NodeDefinition => {
	const parameters: NodeParamSpec[] = [
		{
			id: "stage",
			kind: "enum",
			label: "Stage",
			defaultValue: "fragment",
			options: outputOperations.map((entry) => ({
				value: entry.id,
				label: entry.label,
			})),
			ui: { tab: "Details", section: "Output", order: 1, inline: true },
		},
	];
	return {
		id: "output",
		label: "Output",
		category: "Output",
		tags: ["output", "fragment", "vertex"],
		parameters,
		uiTabs: [{ id: "Details", label: "Details" }],
		buildSockets: (state) => {
			const op = outputOperations.find(
				(entry) => entry.id === getStringParam(state, "stage", "fragment"),
			);
			return buildSocketsFromPorts(
				op?.ports ?? outputOperations[0]?.ports ?? [],
			);
		},
		getBodyLabel: (state) => {
			const op = outputOperations.find(
				(entry) => entry.id === getStringParam(state, "stage", "fragment"),
			);
			return op?.label ?? "Fragment Output";
		},
	};
};

const buildConstantsDefinition = (): NodeDefinition => {
	const parameters: NodeParamSpec[] = [
		{
			id: "type",
			kind: "enum",
			label: "Type",
			defaultValue: "float",
			options: [
				{ value: "float", label: "Float" },
				{ value: "vec2", label: "Vec2" },
				{ value: "vec3", label: "Vec3" },
				{ value: "vec4", label: "Vec4" },
				{ value: "color", label: "Color" },
			],
			ui: { tab: "Details", section: "Type", order: 1, inline: true },
		},
	];
	return {
		id: "constants",
		label: "Constants",
		category: "Constants",
		tags: ["constant", "float", "vector", "color"],
		parameters,
		uiTabs: [{ id: "Details", label: "Details" }],
		buildSockets: (state) => {
			const constType = getStringParam(state, "type", "float");
			const outputType: PortType =
				constType === "color" ? "color" : (constType as PortType);
			const defaultValue =
				constType === "color"
					? defaultConstColor
					: constType === "vec2"
						? { x: defaultVector.x, y: defaultVector.y }
						: constType === "vec3"
							? { x: defaultVector.x, y: defaultVector.y, z: defaultVector.z }
							: constType === "vec4"
								? defaultVector
								: 0;
			const uiSpec: NodeSocketUiSpec = {
				kind:
					constType === "color"
						? "color"
						: (constType as NodeSocketUiSpec["kind"]),
				label: constType === "color" ? "Color" : "Value",
				tab: "Details",
				section: "Value",
				order: 1,
			};
			return [
				buildSocket(
					{
						id: "out",
						name: constType === "color" ? "Color" : "Value",
						type: outputType,
						direction: "output",
					},
					{ defaultValue, uiSpec },
				),
			];
		},
		getFooterLabel: (state, socketValues) => {
			const constType = getStringParam(state, "type", "float");
			if (constType === "float") {
				const value = getSocketValue(socketValues, "out", 0);
				return `Value: ${formatDisplayFloat(value)}`;
			}
			if (constType === "color") {
				const color = getSocketValue(socketValues, "out", defaultConstColor);
				const alpha = clamp01(color.a);
				return `Color: ${formatDisplayColor(color)}  a:${formatDisplayFloat(alpha)}`;
			}
			const vector = getSocketValue(socketValues, "out", defaultVector);
			if (constType === "vec2") {
				return `Value: (${formatDisplayVector([vector.x, vector.y])})`;
			}
			if (constType === "vec3") {
				return `Value: (${formatDisplayVector([vector.x, vector.y, vector.z ?? 0])})`;
			}
			return `Value: (${formatDisplayVector([
				vector.x,
				vector.y,
				vector.z ?? 0,
				vector.w ?? 0,
			])})`;
		},
	};
};

const buildInputsDefinition = (): NodeDefinition => {
	const parameters: NodeParamSpec[] = [
		{
			id: "type",
			kind: "enum",
			label: "Type",
			defaultValue: "number",
			options: [
				{ value: "number", label: "Number" },
				{ value: "range", label: "Range" },
				{ value: "checkbox", label: "Checkbox" },
				{ value: "text", label: "Text" },
				{ value: "color", label: "Color" },
				{ value: "select", label: "Select" },
			],
			ui: { tab: "Details", section: "Type", order: 1, inline: true },
		},
		{
			id: "options",
			kind: "string",
			label: "Options (comma separated)",
			defaultValue: defaultInputOptions.join(", "),
			isVisible: (state) =>
				getStringParam(state, "type", "number") === "select",
			ui: { tab: "Details", section: "Options", order: 6 },
		},
	];
	return {
		id: "inputs",
		label: "Inputs",
		category: "Inputs",
		tags: ["input", "number", "checkbox", "text", "color", "select"],
		parameters,
		uiTabs: [{ id: "Details", label: "Details" }],
		buildSockets: (state) => {
			const inputType = getStringParam(state, "type", "number");
			const portType: PortType = inputType === "color" ? "color" : "float";
			const portName =
				inputType === "color"
					? "Color"
					: inputType === "checkbox"
						? "Checked"
						: "Value";
			const options = getInputSelectOptions(state);
			const defaultSelection = options[0] ?? "";
			const defaultValue =
				inputType === "color"
					? defaultInputColor
					: inputType === "checkbox"
						? false
						: inputType === "text"
							? ""
							: inputType === "select"
								? defaultSelection
								: 0;
			const uiSpec: NodeSocketUiSpec = {
				kind:
					inputType === "color"
						? "color"
						: inputType === "checkbox"
							? "boolean"
							: inputType === "text"
								? "string"
								: inputType === "select"
									? "enum"
									: "float",
				label: portName,
				tab: "Details",
				section: "Value",
				order: 1,
				...(inputType === "select"
					? {
							options: options.map((option) => ({
								value: option,
								label: option,
							})),
						}
					: {}),
			};
			return [
				buildSocket(
					{
						id: "out",
						name: portName,
						type: portType,
						direction: "output",
					},
					{ defaultValue, uiSpec },
				),
			];
		},
		getFooterLabel: (state, socketValues) => {
			const inputType = getStringParam(state, "type", "number");
			if (inputType === "color") {
				const color = getSocketValue(socketValues, "out", defaultInputColor);
				const alpha = clamp01(color.a);
				return `Color: ${formatDisplayColor(color)}  a:${formatDisplayFloat(alpha)}`;
			}
			if (inputType === "checkbox") {
				return getSocketValue(socketValues, "out", false)
					? "Checked"
					: "Unchecked";
			}
			if (inputType === "text") {
				return `Text: ${getSocketValue(socketValues, "out", "")}`;
			}
			if (inputType === "select") {
				return `Selection: ${getSocketValue(socketValues, "out", "")}`;
			}
			const value = getSocketValue(socketValues, "out", 0);
			return `Value: ${formatDisplayFloat(value)}`;
		},
	};
};

const buildRerouteDefinition = (): NodeDefinition => {
	const parameters: NodeParamSpec[] = [
		{
			id: "type",
			kind: "enum",
			label: "Type",
			defaultValue: "float",
			options: rerouteTypes.map((type) => ({
				value: type,
				label: formatTypeLabel(type),
			})),
			ui: { tab: "Details", section: "Type", order: 1, inline: true },
		},
	];
	return {
		id: "reroute",
		label: "Reroute",
		category: "General",
		tags: ["reroute", "junction", "wire"],
		parameters,
		uiTabs: [{ id: "Details", label: "Details" }],
		buildSockets: (state) => {
			const type = getStringParam(state, "type", "float");
			const portType = rerouteTypes.includes(type as PortType)
				? (type as PortType)
				: "float";
			return buildSocketsFromPorts([
				{ id: "in", name: "In", type: portType, direction: "input" },
				{ id: "out", name: "Out", type: portType, direction: "output" },
			]);
		},
		compile: (context) => {
			const type = getStringParam(context.state, "type", "float");
			const portType = rerouteTypes.includes(type as PortType)
				? (type as PortType)
				: "float";
			const inputType = context.getInputPortType("in", portType);
			return context.getInputExpression(
				"in",
				inputType,
				context.defaultValueForPort(portType),
			);
		},
	};
};

const definitions: NodeDefinition[] = [
	buildMathDefinition(),
	buildVectorDefinition(),
	buildColorDefinition(),
	buildConversionDefinition(),
	buildLogicDefinition(),
	buildTextureDefinition(),
	buildOutputDefinition(),
	buildConstantsDefinition(),
	buildInputsDefinition(),
	buildRerouteDefinition(),
];

definitions.forEach(registerDefinition);

export const registerNodeDefinition = (definition: NodeDefinition) => {
	registerDefinition(definition);
};

export const getNodeDefinition = (id?: string) =>
	id ? (nodeDefinitions.get(id) ?? null) : null;

export const getNodeDefinitions = () => Array.from(nodeDefinitions.values());

export const getDefaultNodeState = (id: string): NodeState | null => {
	const definition = nodeDefinitions.get(id);
	if (!definition) {
		return null;
	}
	return buildDefaultState(definition.parameters);
};

export const normalizeNodeState = (
	id: string,
	state?: NodeState,
): NodeState | null => {
	const definition = nodeDefinitions.get(id);
	if (!definition) {
		return null;
	}
	const defaults = buildDefaultState(definition.parameters);
	if (!state) {
		return defaults;
	}
	const params: Record<string, NodeState["params"][string]> = {
		...defaults.params,
	};
	Object.keys(defaults.params).forEach((key) => {
		if (Object.hasOwn(state.params, key)) {
			params[key] = state.params[key] as NodeState["params"][string];
		}
	});
	const normalized: NodeState = {
		version: state.version ?? defaults.version,
		params,
	};
	const resolvedUi = state.ui ?? defaults.ui;
	if (resolvedUi) {
		normalized.ui = resolvedUi;
	}
	return normalized;
};

export const getDefinitionPorts = (
	typeId: string | undefined,
	state?: NodeState,
) => {
	if (!typeId) {
		return [];
	}
	const definition = nodeDefinitions.get(typeId);
	if (!definition) {
		return [];
	}
	const normalized = normalizeNodeState(typeId, state);
	if (!normalized) {
		return [];
	}
	const sockets = definition
		.buildSockets(normalized)
		.filter(
			(socket) => !socket.visibilityRules || socket.visibilityRules(normalized),
		);
	return sockets.map((socket) => ({
		id: socket.id,
		name: socket.label,
		type: socket.dataType,
		direction: socket.direction,
	}));
};

export const getDefinitionSockets = (
	typeId: string | undefined,
	state?: NodeState,
) => {
	if (!typeId) {
		return [];
	}
	const definition = nodeDefinitions.get(typeId);
	if (!definition) {
		return [];
	}
	const normalized = normalizeNodeState(typeId, state);
	if (!normalized) {
		return [];
	}
	return definition
		.buildSockets(normalized)
		.filter(
			(socket) => !socket.visibilityRules || socket.visibilityRules(normalized),
		);
};

export const getDefinitionBodyLabel = (
	typeId: string | undefined,
	state?: NodeState,
	socketValues?: Record<string, NodeSocketValue>,
) => {
	if (!typeId) {
		return null;
	}
	const definition = nodeDefinitions.get(typeId);
	if (!definition?.getBodyLabel) {
		return null;
	}
	const normalized = normalizeNodeState(typeId, state);
	return normalized ? definition.getBodyLabel(normalized, socketValues) : null;
};

export const getDefinitionFooterLabel = (
	typeId: string | undefined,
	state?: NodeState,
	socketValues?: Record<string, NodeSocketValue>,
) => {
	if (!typeId) {
		return null;
	}
	const definition = nodeDefinitions.get(typeId);
	if (!definition?.getFooterLabel) {
		return null;
	}
	const normalized = normalizeNodeState(typeId, state);
	return normalized
		? definition.getFooterLabel(normalized, socketValues)
		: null;
};

export const buildNodeTemplate = (definition: NodeDefinition) => {
	const state = buildDefaultState(definition.parameters);
	return {
		id: definition.id,
		label: definition.label,
		title: definition.label,
		category: definition.category,
		ports: definition
			.buildSockets(state)
			.filter(
				(socket) => !socket.visibilityRules || socket.visibilityRules(state),
			)
			.map((socket) => ({
				id: socket.id,
				name: socket.label,
				type: socket.dataType,
				direction: socket.direction,
			})),
	};
};

export const getInputSelectOptions = (state: NodeState) => {
	const raw = getStringParam(state, "options", defaultInputOptions.join(", "));
	return raw
		.split(",")
		.map((option) => option.trim())
		.filter((option) => option.length > 0);
};

export const getInputSelection = (
	state: NodeState,
	socketValues?: Record<string, NodeSocketValue>,
) => {
	const options = getInputSelectOptions(state);
	const rawSelection = socketValues?.out;
	const selection = typeof rawSelection === "string" ? rawSelection : "";
	return options.includes(selection) ? selection : (options[0] ?? "");
};
