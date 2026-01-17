import {
	buildMathPorts,
	getMathOperationId,
	getMathOperationLabel,
	type MathNodeType,
	mathOperationEntries,
} from "./math-ops";
import type {
	NodeFamilyId,
	NodeTemplate,
	PortType,
	SerializablePort,
} from "./types";

type LegacyNodeData = {
	value?: number;
	color?: {
		r: number;
		g: number;
		b: number;
		a: number;
	};
	vector?: {
		x: number;
		y: number;
		z?: number;
		w?: number;
	};
	component?: "x" | "y" | "z" | "w";
	mathOp?: string;
	mathType?: "float" | "vec2" | "vec3" | "vec4";
	vectorOp?: string;
	vectorType?: "vec2" | "vec3" | "vec4";
	colorOp?: string;
	conversionOp?: string;
	logicOp?: string;
	textureOp?: string;
	outputType?: "fragment" | "vertex";
	constType?: "float" | "vec2" | "vec3" | "vec4" | "color";
	inputType?: "number" | "range" | "checkbox" | "text" | "color" | "select";
	inputValue?: number;
	inputChecked?: boolean;
	inputText?: string;
	inputColor?: {
		r: number;
		g: number;
		b: number;
		a: number;
	};
	inputOptions?: string[];
	inputSelection?: string;
};

export type FamilyDropdownEntry = {
	id: string;
	label: string;
};

export type FamilyDropdownConfig = {
	id: string;
	entries: FamilyDropdownEntry[];
	getValue: (data: LegacyNodeData | undefined) => string;
	setValue: (data: LegacyNodeData | undefined, value: string) => LegacyNodeData;
	getLabel: (data: LegacyNodeData | undefined) => string;
};

type NodeFamilyDefinition = {
	id: NodeFamilyId;
	label: string;
	category: string;
	keywords: string;
	defaultData: LegacyNodeData;
	buildPorts: (data: LegacyNodeData | undefined) => SerializablePort[];
	getDropdown?: () => FamilyDropdownConfig;
};

type VectorNodeType = "vec2" | "vec3" | "vec4";
type InputNodeType =
	| "number"
	| "range"
	| "checkbox"
	| "text"
	| "color"
	| "select";

const nodeFamilyIds: NodeFamilyId[] = [
	"math",
	"vector",
	"color",
	"conversion",
	"logic",
	"texture-uv",
	"output",
	"constants",
	"inputs",
];

export const isNodeFamilyId = (value: unknown): value is NodeFamilyId =>
	typeof value === "string" &&
	(nodeFamilyIds as readonly string[]).includes(value);

const defaultConstColor = { r: 1, g: 1, b: 1, a: 1 };
const defaultConstVector = { x: 0, y: 0, z: 0, w: 0 };
const defaultInputColor = { r: 1, g: 1, b: 1, a: 1 };
const defaultInputOptions = ["Option A", "Option B", "Option C"];

const buildConstData = (
	value?: string,
	previous?: LegacyNodeData,
): LegacyNodeData => {
	const constType =
		value === "float" ||
		value === "vec2" ||
		value === "vec3" ||
		value === "vec4" ||
		value === "color"
			? value
			: "float";
	if (constType === "float") {
		return {
			constType,
			value:
				typeof previous?.value === "number" && Number.isFinite(previous.value)
					? previous.value
					: 0,
		};
	}
	if (constType === "color") {
		return {
			constType,
			color: previous?.color ?? defaultConstColor,
		};
	}

	const vector = previous?.vector ?? defaultConstVector;
	if (constType === "vec2") {
		return { constType, vector: { x: vector.x, y: vector.y } };
	}
	if (constType === "vec3") {
		return {
			constType,
			vector: { x: vector.x, y: vector.y, z: vector.z ?? 0 },
		};
	}
	return {
		constType,
		vector: {
			x: vector.x,
			y: vector.y,
			z: vector.z ?? 0,
			w: vector.w ?? 0,
		},
	};
};

const buildInputData = (
	value?: string,
	previous?: LegacyNodeData,
): LegacyNodeData => {
	const inputType =
		value === "number" ||
		value === "range" ||
		value === "checkbox" ||
		value === "text" ||
		value === "color" ||
		value === "select"
			? value
			: "number";

	if (inputType === "number" || inputType === "range") {
		return {
			inputType,
			inputValue:
				typeof previous?.inputValue === "number" &&
				Number.isFinite(previous.inputValue)
					? previous.inputValue
					: 0,
		};
	}
	if (inputType === "checkbox") {
		return {
			inputType,
			inputChecked:
				typeof previous?.inputChecked === "boolean"
					? previous.inputChecked
					: false,
		};
	}
	if (inputType === "text") {
		return {
			inputType,
			inputText:
				typeof previous?.inputText === "string" ? previous.inputText : "",
		};
	}
	if (inputType === "color") {
		return {
			inputType,
			inputColor: previous?.inputColor ?? defaultInputColor,
		};
	}

	const options = Array.isArray(previous?.inputOptions)
		? previous?.inputOptions.filter((option) => typeof option === "string")
		: null;
	const nextOptions =
		options && options.length > 0 ? options : defaultInputOptions;
	const selected =
		typeof previous?.inputSelection === "string" &&
		nextOptions.includes(previous.inputSelection)
			? previous.inputSelection
			: nextOptions[0];
	return {
		inputType,
		inputOptions: nextOptions,
		inputSelection: selected,
	};
};

const mathTypes: MathNodeType[] = ["float", "vec2", "vec3", "vec4"];

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

const formatInputLabel = (type: InputNodeType) => {
	if (type === "number") {
		return "Number";
	}
	if (type === "range") {
		return "Range";
	}
	if (type === "checkbox") {
		return "Checkbox";
	}
	if (type === "text") {
		return "Text";
	}
	if (type === "color") {
		return "Color";
	}
	return "Select";
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

const colorOperations: FamilyDropdownEntry[] = [
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

const conversionOperations: {
	id: string;
	label: string;
	ports: SerializablePort[];
}[] = [
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

const logicOperations: {
	id: string;
	label: string;
	type?: "float" | VectorNodeType;
	ports: SerializablePort[];
}[] = [
	{
		id: "and",
		label: "And",
		type: "float",
		ports: [
			{ id: "a", name: "A", type: "float", direction: "input" },
			{ id: "b", name: "B", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "or",
		label: "Or",
		type: "float",
		ports: [
			{ id: "a", name: "A", type: "float", direction: "input" },
			{ id: "b", name: "B", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "not",
		label: "Not",
		type: "float",
		ports: [
			{ id: "in", name: "In", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "float", direction: "output" },
		],
	},
	{
		id: "select",
		label: "Select (Float)",
		type: "float",
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
		type: "vec2",
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
		type: "vec3",
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
		type: "vec4",
		ports: [
			{ id: "a", name: "A", type: "vec4", direction: "input" },
			{ id: "b", name: "B", type: "vec4", direction: "input" },
			{ id: "cond", name: "Condition", type: "float", direction: "input" },
			{ id: "out", name: "Out", type: "vec4", direction: "output" },
		],
	},
];

const textureOperations: {
	id: string;
	label: string;
	ports: SerializablePort[];
}[] = [
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

const outputOperations: {
	id: string;
	label: string;
	ports: SerializablePort[];
}[] = [
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

const nodeFamilyDefinitions: Record<NodeFamilyId, NodeFamilyDefinition> = {
	math: {
		id: "math",
		label: "Math",
		category: "Math",
		keywords: "math operation numeric",
		defaultData: {
			mathOp: mathOperationEntries[0]?.id ?? "add",
			mathType: "float",
		},
		buildPorts: (data) =>
			buildMathPorts((data?.mathType ?? "float") as MathNodeType, data?.mathOp),
		getDropdown: () => ({
			id: "math-operation",
			entries: mathOperationEntries.flatMap((entry) =>
				mathTypes.map((type) => ({
					id: `${entry.id}:${type}`,
					label: `${entry.label} (${formatTypeLabel(type)})`,
				})),
			),
			getValue: (data) => {
				const op = getMathOperationId(data?.mathOp);
				const type =
					data?.mathType && mathTypes.includes(data.mathType)
						? data.mathType
						: "float";
				return `${op}:${type}`;
			},
			setValue: (data, value) => {
				const [opId, type] = value.split(":");
				return {
					...(data ?? {}),
					mathOp: getMathOperationId(opId),
					mathType: mathTypes.includes(type as MathNodeType)
						? (type as MathNodeType)
						: "float",
				};
			},
			getLabel: (data) => {
				const op = getMathOperationId(data?.mathOp);
				const type =
					data?.mathType && mathTypes.includes(data.mathType)
						? data.mathType
						: "float";
				return `Operation: ${getMathOperationLabel(op)} (${formatTypeLabel(type)})`;
			},
		}),
	},
	vector: {
		id: "vector",
		label: "Vector",
		category: "Vector",
		keywords: "vector compose split normalize dot cross",
		defaultData: {
			vectorOp: "compose",
			vectorType: "vec2",
		},
		buildPorts: (data) => {
			const operation = getVectorOperation(data?.vectorOp);
			const type = getVectorType(operation, data?.vectorType);
			return operation.buildPorts(type);
		},
		getDropdown: () => ({
			id: "vector-operation",
			entries: vectorOperations.flatMap((operation) =>
				operation.types.map((type) => ({
					id: `${operation.id}:${type}`,
					label: `${operation.label} (${formatTypeLabel(type)})`,
				})),
			),
			getValue: (data) => {
				const operation = getVectorOperation(data?.vectorOp);
				const type = getVectorType(operation, data?.vectorType);
				return `${operation.id}:${type}`;
			},
			setValue: (data, value) => {
				const [opId, type] = value.split(":");
				const operation = getVectorOperation(opId);
				const nextType = getVectorType(operation, type);
				return {
					...(data ?? {}),
					vectorOp: operation.id,
					vectorType: nextType,
				};
			},
			getLabel: (data) => {
				const operation = getVectorOperation(data?.vectorOp);
				const type = getVectorType(operation, data?.vectorType);
				return `Operation: ${operation.label} (${formatTypeLabel(type)})`;
			},
		}),
	},
	color: {
		id: "color",
		label: "Color",
		category: "Color",
		keywords: "color mix add multiply",
		defaultData: {
			colorOp: "mix",
		},
		buildPorts: (data) => buildColorPorts(data?.colorOp),
		getDropdown: () => ({
			id: "color-operation",
			entries: colorOperations,
			getValue: (data) => data?.colorOp ?? "mix",
			setValue: (data, value) => ({ ...(data ?? {}), colorOp: value }),
			getLabel: (data) => {
				const op = colorOperations.find((entry) => entry.id === data?.colorOp);
				return `Operation: ${op?.label ?? "Mix"}`;
			},
		}),
	},
	conversion: {
		id: "conversion",
		label: "Conversion",
		category: "Conversion",
		keywords: "convert cast",
		defaultData: {
			conversionOp: conversionOperations[0]?.id ?? "float-to-int",
		},
		buildPorts: (data) => {
			const op = conversionOperations.find(
				(entry) => entry.id === data?.conversionOp,
			);
			return op?.ports ?? conversionOperations[0]?.ports ?? [];
		},
		getDropdown: () => ({
			id: "conversion-operation",
			entries: conversionOperations.map((entry) => ({
				id: entry.id,
				label: entry.label,
			})),
			getValue: (data) => data?.conversionOp ?? "float-to-int",
			setValue: (data, value) => ({
				...(data ?? {}),
				conversionOp: value,
			}),
			getLabel: (data) => {
				const op = conversionOperations.find(
					(entry) => entry.id === data?.conversionOp,
				);
				return `Operation: ${op?.label ?? "Float to Int"}`;
			},
		}),
	},
	logic: {
		id: "logic",
		label: "Logic",
		category: "Logic",
		keywords: "logic select and or not",
		defaultData: {
			logicOp: "and",
		},
		buildPorts: (data) => {
			const op = logicOperations.find((entry) => entry.id === data?.logicOp);
			return op?.ports ?? logicOperations[0]?.ports ?? [];
		},
		getDropdown: () => ({
			id: "logic-operation",
			entries: logicOperations.map((entry) => ({
				id: entry.id,
				label: entry.label,
			})),
			getValue: (data) => data?.logicOp ?? "and",
			setValue: (data, value) => ({ ...(data ?? {}), logicOp: value }),
			getLabel: (data) => {
				const op = logicOperations.find((entry) => entry.id === data?.logicOp);
				return `Operation: ${op?.label ?? "And"}`;
			},
		}),
	},
	"texture-uv": {
		id: "texture-uv",
		label: "Texture/UV",
		category: "Texture/UV",
		keywords: "texture uv sample",
		defaultData: {
			textureOp: "uv-input",
		},
		buildPorts: (data) => {
			const op = textureOperations.find(
				(entry) => entry.id === data?.textureOp,
			);
			return op?.ports ?? textureOperations[0]?.ports ?? [];
		},
		getDropdown: () => ({
			id: "texture-operation",
			entries: textureOperations.map((entry) => ({
				id: entry.id,
				label: entry.label,
			})),
			getValue: (data) => data?.textureOp ?? "uv-input",
			setValue: (data, value) => ({ ...(data ?? {}), textureOp: value }),
			getLabel: (data) => {
				const op = textureOperations.find(
					(entry) => entry.id === data?.textureOp,
				);
				return `Operation: ${op?.label ?? "Input UV"}`;
			},
		}),
	},
	output: {
		id: "output",
		label: "Output",
		category: "Output",
		keywords: "output fragment vertex",
		defaultData: {
			outputType: "fragment",
		},
		buildPorts: (data) => {
			const op = outputOperations.find(
				(entry) => entry.id === data?.outputType,
			);
			return op?.ports ?? outputOperations[0]?.ports ?? [];
		},
		getDropdown: () => ({
			id: "output-operation",
			entries: outputOperations.map((entry) => ({
				id: entry.id,
				label: entry.label,
			})),
			getValue: (data) => data?.outputType ?? "fragment",
			setValue: (data, value) => ({
				...(data ?? {}),
				outputType: value === "vertex" ? "vertex" : "fragment",
			}),
			getLabel: (data) => {
				const op = outputOperations.find(
					(entry) => entry.id === data?.outputType,
				);
				return op?.label ?? "Fragment Output";
			},
		}),
	},
	constants: {
		id: "constants",
		label: "Constants",
		category: "Constants",
		keywords: "constant float vector color",
		defaultData: buildConstData("float"),
		buildPorts: (data) => {
			const constType = data?.constType ?? "float";
			const outputType: PortType = constType === "color" ? "color" : constType;
			return [
				{
					id: "out",
					name: constType === "color" ? "Color" : "Value",
					type: outputType,
					direction: "output",
				},
			];
		},
		getDropdown: () => ({
			id: "const-type",
			entries: [
				{ id: "float", label: "Float" },
				{ id: "vec2", label: "Vec2" },
				{ id: "vec3", label: "Vec3" },
				{ id: "vec4", label: "Vec4" },
				{ id: "color", label: "Color" },
			],
			getValue: (data) => data?.constType ?? "float",
			setValue: (data, value) => buildConstData(value, data),
			getLabel: (data) =>
				`Type: ${formatTypeLabel(data?.constType ?? "float")}`,
		}),
	},
	inputs: {
		id: "inputs",
		label: "Inputs",
		category: "Inputs",
		keywords: "input number range checkbox text color select",
		defaultData: buildInputData("number"),
		buildPorts: (data) => {
			const inputType = data?.inputType ?? "number";
			const portType: PortType = inputType === "color" ? "color" : "float";
			const portName =
				inputType === "color"
					? "Color"
					: inputType === "checkbox"
						? "Checked"
						: "Value";
			return [
				{
					id: "out",
					name: portName,
					type: portType,
					direction: "output",
				},
			];
		},
		getDropdown: () => ({
			id: "input-type",
			entries: [
				{ id: "number", label: "Number" },
				{ id: "range", label: "Range" },
				{ id: "checkbox", label: "Checkbox" },
				{ id: "text", label: "Text" },
				{ id: "color", label: "Color" },
				{ id: "select", label: "Select" },
			],
			getValue: (data) => data?.inputType ?? "number",
			setValue: (data, value) => buildInputData(value, data),
			getLabel: (data) =>
				`Type: ${formatInputLabel(
					(data?.inputType ?? "number") as InputNodeType,
				)}`,
		}),
	},
};

export const nodeFamilyTemplates: NodeTemplate[] = nodeFamilyIds.map((id) => {
	const family = nodeFamilyDefinitions[id];
	return {
		id: family.id,
		label: family.label,
		title: family.label,
		category: family.category,
		ports: family.buildPorts(family.defaultData),
	};
});

export const getNodeFamilyDefinition = (familyId?: NodeFamilyId) =>
	familyId ? (nodeFamilyDefinitions[familyId] ?? null) : null;

export const getDefaultFamilyData = (
	familyId?: NodeFamilyId,
): LegacyNodeData => {
	const family = getNodeFamilyDefinition(familyId);
	return family ? { ...family.defaultData } : {};
};

export const getFamilyPorts = (
	familyId: NodeFamilyId | undefined,
	data?: LegacyNodeData,
) => {
	const family = getNodeFamilyDefinition(familyId);
	return family ? family.buildPorts(data) : [];
};

export const getFamilyDropdown = (familyId?: NodeFamilyId) => {
	const family = getNodeFamilyDefinition(familyId);
	return family?.getDropdown ? family.getDropdown() : null;
};

export const getConstType = (data?: LegacyNodeData) =>
	data?.constType ?? "float";
export const getInputType = (data?: LegacyNodeData) =>
	data?.inputType ?? "number";

type LegacyMigration = {
	familyId: NodeFamilyId;
	data: LegacyNodeData;
};

const parseLegacyMathTemplate = (
	templateId: string,
): LegacyMigration | null => {
	if (!templateId.startsWith("math-")) {
		return null;
	}
	const parts = templateId.replace("math-", "").split("-");
	if (parts.length === 0) {
		return null;
	}
	const opId = parts[0];
	const type = parts[1] ?? "float";
	if (!mathTypes.includes(type as MathNodeType)) {
		return null;
	}
	return {
		familyId: "math",
		data: {
			mathOp: opId,
			mathType: type as MathNodeType,
		},
	};
};

export const migrateLegacyTemplate = (
	templateId: string,
	payload?: LegacyNodeData,
): LegacyMigration | null => {
	if (templateId === "const-float") {
		return { familyId: "constants", data: buildConstData("float", payload) };
	}
	if (templateId === "const-vec2") {
		return { familyId: "constants", data: buildConstData("vec2", payload) };
	}
	if (templateId === "const-vec3") {
		return { familyId: "constants", data: buildConstData("vec3", payload) };
	}
	if (templateId === "const-vec4") {
		return { familyId: "constants", data: buildConstData("vec4", payload) };
	}
	if (templateId === "const-color") {
		return { familyId: "constants", data: buildConstData("color", payload) };
	}
	if (templateId === "input-uv") {
		return { familyId: "texture-uv", data: { textureOp: "uv-input" } };
	}
	if (templateId === "input-texture") {
		return { familyId: "texture-uv", data: { textureOp: "texture-input" } };
	}
	if (templateId === "input-time") {
		return { familyId: "texture-uv", data: { textureOp: "time-input" } };
	}
	if (templateId === "input-position") {
		return { familyId: "vector", data: { vectorOp: "position-input" } };
	}
	if (templateId === "vector-component") {
		return {
			familyId: "vector",
			data: { vectorOp: "component", vectorType: "vec4", ...payload },
		};
	}
	if (templateId.startsWith("vector-compose-")) {
		const type = templateId.replace("vector-compose-", "") as VectorNodeType;
		if (type === "vec2" || type === "vec3" || type === "vec4") {
			return {
				familyId: "vector",
				data: { vectorOp: "compose", vectorType: type },
			};
		}
	}
	if (templateId.startsWith("vector-split-")) {
		const type = templateId.replace("vector-split-", "") as VectorNodeType;
		if (type === "vec2" || type === "vec3" || type === "vec4") {
			return {
				familyId: "vector",
				data: { vectorOp: "split", vectorType: type },
			};
		}
	}
	if (templateId.startsWith("vector-dot-")) {
		const type = templateId.replace("vector-dot-", "") as VectorNodeType;
		if (type === "vec2" || type === "vec3" || type === "vec4") {
			return {
				familyId: "vector",
				data: { vectorOp: "dot", vectorType: type },
			};
		}
	}
	if (templateId === "vector-cross-vec3") {
		return {
			familyId: "vector",
			data: { vectorOp: "cross", vectorType: "vec3" },
		};
	}
	if (templateId.startsWith("vector-normalize-")) {
		const type = templateId.replace("vector-normalize-", "") as VectorNodeType;
		if (type === "vec2" || type === "vec3" || type === "vec4") {
			return {
				familyId: "vector",
				data: { vectorOp: "normalize", vectorType: type },
			};
		}
	}
	if (templateId.startsWith("vector-length-")) {
		const type = templateId.replace("vector-length-", "") as VectorNodeType;
		if (type === "vec2" || type === "vec3" || type === "vec4") {
			return {
				familyId: "vector",
				data: { vectorOp: "length", vectorType: type },
			};
		}
	}
	if (templateId.startsWith("vector-distance-")) {
		const type = templateId.replace("vector-distance-", "") as VectorNodeType;
		if (type === "vec2" || type === "vec3" || type === "vec4") {
			return {
				familyId: "vector",
				data: { vectorOp: "distance", vectorType: type },
			};
		}
	}
	if (templateId.startsWith("vector-reflect-")) {
		const type = templateId.replace("vector-reflect-", "") as VectorNodeType;
		if (type === "vec2" || type === "vec3" || type === "vec4") {
			return {
				familyId: "vector",
				data: { vectorOp: "reflect", vectorType: type },
			};
		}
	}
	if (templateId.startsWith("vector-refract-")) {
		const type = templateId.replace("vector-refract-", "") as VectorNodeType;
		if (type === "vec2" || type === "vec3" || type === "vec4") {
			return {
				familyId: "vector",
				data: { vectorOp: "refract", vectorType: type },
			};
		}
	}

	const legacyMath = parseLegacyMathTemplate(templateId);
	if (legacyMath) {
		return legacyMath;
	}

	if (templateId === "texture-sample") {
		return { familyId: "texture-uv", data: { textureOp: "texture-sample" } };
	}
	if (templateId === "uv-scale") {
		return { familyId: "texture-uv", data: { textureOp: "uv-scale" } };
	}
	if (templateId === "uv-offset") {
		return { familyId: "texture-uv", data: { textureOp: "uv-offset" } };
	}
	if (templateId === "uv-rotate") {
		return { familyId: "texture-uv", data: { textureOp: "uv-rotate" } };
	}

	if (templateId === "color-mix") {
		return { familyId: "color", data: { colorOp: "mix" } };
	}
	if (templateId === "color-add") {
		return { familyId: "color", data: { colorOp: "add" } };
	}
	if (templateId === "color-multiply") {
		return { familyId: "color", data: { colorOp: "multiply" } };
	}
	if (templateId === "color-screen") {
		return { familyId: "color", data: { colorOp: "screen" } };
	}
	if (templateId === "color-overlay") {
		return { familyId: "color", data: { colorOp: "overlay" } };
	}
	if (templateId === "color-invert") {
		return { familyId: "color", data: { colorOp: "invert" } };
	}
	if (templateId === "color-gamma") {
		return { familyId: "color", data: { colorOp: "gamma" } };
	}
	if (templateId === "color-brightness") {
		return { familyId: "color", data: { colorOp: "brightness" } };
	}
	if (templateId === "color-contrast") {
		return { familyId: "color", data: { colorOp: "contrast" } };
	}
	if (templateId === "color-saturation") {
		return { familyId: "color", data: { colorOp: "saturation" } };
	}

	if (templateId === "convert-float-to-int") {
		return { familyId: "conversion", data: { conversionOp: "float-to-int" } };
	}
	if (templateId === "convert-int-to-float") {
		return { familyId: "conversion", data: { conversionOp: "int-to-float" } };
	}
	if (templateId === "convert-vec2-to-vec3") {
		return { familyId: "conversion", data: { conversionOp: "vec2-to-vec3" } };
	}
	if (templateId === "convert-vec3-to-vec4") {
		return { familyId: "conversion", data: { conversionOp: "vec3-to-vec4" } };
	}
	if (templateId === "convert-vec4-to-vec3") {
		return { familyId: "conversion", data: { conversionOp: "vec4-to-vec3" } };
	}
	if (templateId === "convert-vec3-to-vec2") {
		return { familyId: "conversion", data: { conversionOp: "vec3-to-vec2" } };
	}

	if (templateId === "logic-and") {
		return { familyId: "logic", data: { logicOp: "and" } };
	}
	if (templateId === "logic-or") {
		return { familyId: "logic", data: { logicOp: "or" } };
	}
	if (templateId === "logic-not") {
		return { familyId: "logic", data: { logicOp: "not" } };
	}
	if (templateId === "logic-select") {
		return { familyId: "logic", data: { logicOp: "select" } };
	}
	if (templateId === "logic-select-vec2") {
		return { familyId: "logic", data: { logicOp: "select-vec2" } };
	}
	if (templateId === "logic-select-vec3") {
		return { familyId: "logic", data: { logicOp: "select-vec3" } };
	}
	if (templateId === "logic-select-vec4") {
		return { familyId: "logic", data: { logicOp: "select-vec4" } };
	}

	if (templateId === "fragment-output") {
		return { familyId: "output", data: { outputType: "fragment" } };
	}
	if (templateId === "vertex-output") {
		return { familyId: "output", data: { outputType: "vertex" } };
	}

	return null;
};

export const isLegacyTemplateId = (value: unknown): value is string =>
	typeof value === "string" && !isNodeFamilyId(value);
