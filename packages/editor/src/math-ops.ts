import type { NodeTemplate, PortType, SerializablePort } from "./types";

export type MathNodeType = "float" | "vec2" | "vec3" | "vec4";

type MathInputKind = "same" | "float";

type MathOperationDefinition = {
	id: string;
	label: string;
	inputs: Array<{ id: string; name: string; kind: MathInputKind }>;
};

const defaultOperationId = "add";

const mathOperations: MathOperationDefinition[] = [
	{
		id: "add",
		label: "Add",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
		],
	},
	{
		id: "multiply",
		label: "Multiply",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
		],
	},
	{
		id: "subtract",
		label: "Subtract",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
		],
	},
	{
		id: "divide",
		label: "Divide",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
		],
	},
	{
		id: "clamp",
		label: "Clamp",
		inputs: [
			{ id: "in", name: "In", kind: "same" },
			{ id: "min", name: "Min", kind: "same" },
			{ id: "max", name: "Max", kind: "same" },
		],
	},
	{
		id: "clamp01",
		label: "Clamp 0-1",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "lerp",
		label: "Lerp",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
			{ id: "t", name: "T", kind: "float" },
		],
	},
	{
		id: "multiply-add",
		label: "Multiply Add",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
			{ id: "addend", name: "Addend", kind: "same" },
		],
	},
	{
		id: "power",
		label: "Power",
		inputs: [
			{ id: "base", name: "Base", kind: "same" },
			{ id: "exponent", name: "Exponent", kind: "same" },
		],
	},
	{
		id: "log",
		label: "Log",
		inputs: [
			{ id: "value", name: "Value", kind: "same" },
			{ id: "base", name: "Base", kind: "same" },
		],
	},
	{
		id: "sqrt",
		label: "Sqrt",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "inverse-sqrt",
		label: "Inverse Sqrt",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "abs",
		label: "Abs",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "exp",
		label: "Exp",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "min",
		label: "Minimum",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
		],
	},
	{
		id: "max",
		label: "Maximum",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
		],
	},
	{
		id: "less-than",
		label: "Less Than",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
		],
	},
	{
		id: "greater-than",
		label: "Greater Than",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
		],
	},
	{
		id: "sign",
		label: "Sign",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "compare",
		label: "Compare",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
			{ id: "epsilon", name: "Epsilon", kind: "float" },
		],
	},
	{
		id: "smooth-min",
		label: "Smooth Minimum",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
			{ id: "distance", name: "Distance", kind: "float" },
		],
	},
	{
		id: "smooth-max",
		label: "Smooth Maximum",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
			{ id: "distance", name: "Distance", kind: "float" },
		],
	},
	{
		id: "round",
		label: "Round",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "floor",
		label: "Floor",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "ceil",
		label: "Ceil",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "trunc",
		label: "Truncate",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "fract",
		label: "Fract",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "mod-trunc",
		label: "Modulo (Trunc)",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
		],
	},
	{
		id: "mod-floor",
		label: "Modulo (Floor)",
		inputs: [
			{ id: "a", name: "A", kind: "same" },
			{ id: "b", name: "B", kind: "same" },
		],
	},
	{
		id: "wrap",
		label: "Wrap",
		inputs: [
			{ id: "value", name: "Value", kind: "same" },
			{ id: "min", name: "Min", kind: "same" },
			{ id: "max", name: "Max", kind: "same" },
		],
	},
	{
		id: "snap",
		label: "Snap",
		inputs: [
			{ id: "value", name: "Value", kind: "same" },
			{ id: "increment", name: "Increment", kind: "same" },
		],
	},
	{
		id: "pingpong",
		label: "Ping-Pong",
		inputs: [
			{ id: "value", name: "Value", kind: "same" },
			{ id: "scale", name: "Scale", kind: "same" },
		],
	},
	{
		id: "sine",
		label: "Sine",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "cosine",
		label: "Cosine",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "tan",
		label: "Tangent",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "asin",
		label: "Arcsin",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "acos",
		label: "Arccos",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "atan",
		label: "Arctan",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "atan2",
		label: "Arctan2",
		inputs: [
			{ id: "y", name: "Y", kind: "same" },
			{ id: "x", name: "X", kind: "same" },
		],
	},
	{
		id: "sinh",
		label: "Sinh",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "cosh",
		label: "Cosh",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "tanh",
		label: "Tanh",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "radians",
		label: "Radians",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
	{
		id: "degrees",
		label: "Degrees",
		inputs: [{ id: "in", name: "In", kind: "same" }],
	},
];

const mathOperationMap = new Map(
	mathOperations.map((operation) => [operation.id, operation]),
);

const groupedMathTemplateIds = {
	float: "math-float",
	vec2: "math-vec2",
	vec3: "math-vec3",
	vec4: "math-vec4",
} as const satisfies Record<MathNodeType, string>;
const groupedMathTemplateIdSet = new Set<string>(
	Object.values(groupedMathTemplateIds),
);

export const mathOperationEntries = mathOperations.map((operation) => ({
	id: operation.id,
	label: operation.label,
}));

export const isMathOperationId = (value: unknown): value is string =>
	typeof value === "string" && mathOperationMap.has(value);

export const getMathOperationId = (value?: string) =>
	isMathOperationId(value) ? value : defaultOperationId;

export const getMathOperationLabel = (value?: string) =>
	mathOperationMap.get(getMathOperationId(value))?.label ?? "Add";

export const isMathTemplateId = (value?: string): value is string =>
	typeof value === "string" && groupedMathTemplateIdSet.has(value);

export const isLegacyMathTemplateId = (value?: string): value is string =>
	typeof value === "string" &&
	value.startsWith("math-") &&
	!groupedMathTemplateIdSet.has(value);

export const getMathNodeType = (templateId?: string): MathNodeType | null => {
	if (templateId === groupedMathTemplateIds.float) {
		return "float";
	}
	if (templateId === groupedMathTemplateIds.vec2) {
		return "vec2";
	}
	if (templateId === groupedMathTemplateIds.vec3) {
		return "vec3";
	}
	if (templateId === groupedMathTemplateIds.vec4) {
		return "vec4";
	}
	return null;
};

export const buildMathPorts = (
	type: MathNodeType,
	operationId?: string,
): SerializablePort[] => {
	const op = mathOperationMap.get(getMathOperationId(operationId));
	const valueType = type as PortType;
	const inputs = (op?.inputs ?? []).map((input) => ({
		id: input.id,
		name: input.name,
		type: input.kind === "float" ? "float" : valueType,
		direction: "input" as const,
	}));
	return [
		...inputs,
		{ id: "out", name: "Out", type: valueType, direction: "output" },
	];
};

export const getMathPortsForTemplate = (
	templateId?: string,
	operationId?: string,
): SerializablePort[] | null => {
	const type = getMathNodeType(templateId);
	if (!type) {
		return null;
	}
	return buildMathPorts(type, operationId);
};

export const resolveMathTemplateId = (
	templateId?: string,
	operationId?: string,
): string | null => {
	if (!templateId) {
		return null;
	}
	if (!isMathTemplateId(templateId)) {
		return templateId;
	}
	const type = getMathNodeType(templateId);
	if (!type) {
		return templateId;
	}
	const op = getMathOperationId(operationId);
	return type === "float" ? `math-${op}` : `math-${op}-${type}`;
};

export const mathNodeTemplates: NodeTemplate[] = [
	{
		id: groupedMathTemplateIds.float,
		label: "Math (Float)",
		title: "Math Float",
		category: "Math",
		ports: buildMathPorts("float", defaultOperationId),
	},
	{
		id: groupedMathTemplateIds.vec2,
		label: "Math (Vec2)",
		title: "Math Vec2",
		category: "Math",
		ports: buildMathPorts("vec2", defaultOperationId),
	},
	{
		id: groupedMathTemplateIds.vec3,
		label: "Math (Vec3)",
		title: "Math Vec3",
		category: "Math",
		ports: buildMathPorts("vec3", defaultOperationId),
	},
	{
		id: groupedMathTemplateIds.vec4,
		label: "Math (Vec4)",
		title: "Math Vec4",
		category: "Math",
		ports: buildMathPorts("vec4", defaultOperationId),
	},
];
