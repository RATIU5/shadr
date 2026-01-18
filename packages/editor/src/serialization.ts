import { GRAPH_SCHEMA_VERSION } from "./graph-version";
import { isMathOperationId } from "./math-ops";
import { getDefaultNodeState, normalizeNodeState } from "./node-definitions";
import {
	isLegacyTemplateId,
	isNodeFamilyId,
	migrateLegacyTemplate,
} from "./node-families";
import type {
	NodeFamilyId,
	NodeSocketValue,
	NodeState,
	PortDirection,
	PortType,
	SerializableConnection,
	SerializableGraph,
	SerializableGroup,
	SerializableNode,
	SerializablePort,
} from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const parseGraphVersion = (value: unknown): number | null => {
	if (value === undefined) {
		return 0;
	}

	if (typeof value !== "number" || !Number.isFinite(value)) {
		return null;
	}

	if (!Number.isInteger(value) || value < 0) {
		return null;
	}

	return value;
};

type GraphParseReport = {
	snapshot: SerializableGraph | null;
	errors: string[];
};

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

const migrateGraphPayloadWithReport = (
	value: Record<string, unknown>,
): { normalized: Record<string, unknown> | null; errors: string[] } => {
	const errors: string[] = [];
	const rawVersion = parseGraphVersion(value.version);
	if (rawVersion === null) {
		errors.push("Graph version must be a non-negative integer.");
		return { normalized: null, errors };
	}

	if (rawVersion > GRAPH_SCHEMA_VERSION) {
		errors.push(
			`Graph version ${rawVersion} is newer than supported version ${GRAPH_SCHEMA_VERSION}.`,
		);
		return { normalized: null, errors };
	}

	let version = rawVersion;
	let migrated: Record<string, unknown> = value;

	if (version === 0) {
		migrated = { ...migrated, version: 1 };
		version = 1;
	}

	if (version === 1) {
		migrated = { ...migrated, version: 2 };
		version = 2;
	}

	if (version === 2) {
		migrated = { ...migrated, version: 3 };
		version = 3;
	}

	if (version === 3) {
		migrated = { ...migrated, version: 4 };
		version = 4;
	}

	if (version !== GRAPH_SCHEMA_VERSION) {
		errors.push(
			`Graph version ${rawVersion} could not be migrated to schema ${GRAPH_SCHEMA_VERSION}.`,
		);
		return { normalized: null, errors };
	}

	return { normalized: { ...migrated, version: GRAPH_SCHEMA_VERSION }, errors };
};

const isPortType = (value: unknown): value is PortType =>
	value === "float" ||
	value === "int" ||
	value === "vec2" ||
	value === "vec3" ||
	value === "vec4" ||
	value === "texture" ||
	value === "color";

const isPortDirection = (value: unknown): value is PortDirection =>
	value === "input" || value === "output";

const parsePort = (value: unknown): SerializablePort | null => {
	if (!isRecord(value)) {
		return null;
	}

	const { id, name, type, direction } = value;
	if (
		typeof id !== "string" ||
		typeof name !== "string" ||
		!isPortType(type) ||
		!isPortDirection(direction)
	) {
		return null;
	}

	return { id, name, type, direction };
};

const parseNodeParamValue = (
	value: unknown,
): NodeState["params"][string] | null => {
	if (typeof value === "string" || typeof value === "boolean") {
		return value;
	}
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}
	if (Array.isArray(value)) {
		if (value.every((item) => typeof item === "string")) {
			return value;
		}
		return null;
	}
	if (!isRecord(value)) {
		return null;
	}

	const hasColor =
		typeof value.r === "number" &&
		typeof value.g === "number" &&
		typeof value.b === "number" &&
		typeof value.a === "number";
	if (hasColor) {
		const color = value as { r: number; g: number; b: number; a: number };
		return {
			r: color.r,
			g: color.g,
			b: color.b,
			a: color.a,
		};
	}

	const hasVector = typeof value.x === "number" && typeof value.y === "number";
	if (hasVector) {
		const vectorValue = value as {
			x: number;
			y: number;
			z?: number;
			w?: number;
		};
		const vector: { x: number; y: number; z?: number; w?: number } = {
			x: vectorValue.x,
			y: vectorValue.y,
		};
		if (typeof vectorValue.z === "number") {
			vector.z = vectorValue.z;
		}
		if (typeof vectorValue.w === "number") {
			vector.w = vectorValue.w;
		}
		return vector;
	}

	return null;
};

const parseNodeState = (value: unknown): NodeState | null => {
	if (!isRecord(value)) {
		return null;
	}

	const paramsRaw = value.params;
	if (!isRecord(paramsRaw)) {
		return null;
	}

	const params: Record<string, NodeState["params"][string]> = {};
	for (const [key, entry] of Object.entries(paramsRaw)) {
		const parsed = parseNodeParamValue(entry);
		if (parsed !== null) {
			params[key] = parsed;
		}
	}

	const version =
		typeof value.version === "number" && Number.isFinite(value.version)
			? value.version
			: 1;
	const uiRaw = value.ui;
	let ui: NodeState["ui"] | undefined;
	if (isRecord(uiRaw)) {
		const next: NodeState["ui"] = {};
		if (typeof uiRaw.lastTabId === "string") {
			next.lastTabId = uiRaw.lastTabId;
		}
		if (typeof uiRaw.colorTag === "string") {
			next.colorTag = uiRaw.colorTag;
		}
		if (typeof uiRaw.isBypassed === "boolean") {
			next.isBypassed = uiRaw.isBypassed;
		}
		if (Object.keys(next).length > 0) {
			ui = next;
		}
	}
	return { version, params, ...(ui ? { ui } : {}) };
};

const parseSocketValues = (
	value: unknown,
): Record<string, NodeSocketValue> | null => {
	if (!isRecord(value)) {
		return null;
	}
	const socketValues: Record<string, NodeSocketValue> = {};
	for (const [key, entry] of Object.entries(value)) {
		const parsed = parseNodeParamValue(entry);
		if (parsed !== null) {
			socketValues[key] = parsed;
		}
	}
	return socketValues;
};

const isVectorSocketValue = (
	value: NodeSocketValue | undefined,
): value is { x: number; y: number; z?: number; w?: number } =>
	typeof value === "object" && value !== null && "x" in value && "y" in value;

const isColorSocketValue = (
	value: NodeSocketValue | undefined,
): value is { r: number; g: number; b: number; a: number } =>
	typeof value === "object" &&
	value !== null &&
	"r" in value &&
	"g" in value &&
	"b" in value &&
	"a" in value;

const mapLegacyDataToState = (
	typeId: string,
	data: LegacyNodeData,
): NodeState | null => {
	const base = getDefaultNodeState(typeId);
	if (!base) {
		return null;
	}
	const params = { ...base.params };

	if (typeId === "math") {
		if (typeof data.mathOp === "string") {
			params.operation = data.mathOp;
		}
		if (
			data.mathType === "float" ||
			data.mathType === "vec2" ||
			data.mathType === "vec3" ||
			data.mathType === "vec4"
		) {
			params.type = data.mathType;
		}
	}

	if (typeId === "vector") {
		if (typeof data.vectorOp === "string") {
			params.operation = data.vectorOp;
		}
		if (
			data.vectorType === "vec2" ||
			data.vectorType === "vec3" ||
			data.vectorType === "vec4"
		) {
			params.type = data.vectorType;
		}
		if (
			data.component === "x" ||
			data.component === "y" ||
			data.component === "z" ||
			data.component === "w"
		) {
			params.component = data.component;
		}
	}

	if (typeId === "color" && typeof data.colorOp === "string") {
		params.operation = data.colorOp;
	}

	if (typeId === "conversion" && typeof data.conversionOp === "string") {
		params.operation = data.conversionOp;
	}

	if (typeId === "logic" && typeof data.logicOp === "string") {
		params.operation = data.logicOp;
	}

	if (typeId === "texture-uv" && typeof data.textureOp === "string") {
		params.operation = data.textureOp;
	}

	if (typeId === "output") {
		if (data.outputType === "fragment" || data.outputType === "vertex") {
			params.stage = data.outputType;
		}
	}

	if (typeId === "constants") {
		if (
			data.constType === "float" ||
			data.constType === "vec2" ||
			data.constType === "vec3" ||
			data.constType === "vec4" ||
			data.constType === "color"
		) {
			params.type = data.constType;
		}
		if (typeof data.value === "number") {
			params.floatValue = data.value;
		}
		if (data.vector) {
			params.vectorValue = {
				x: data.vector.x,
				y: data.vector.y,
				...(data.vector.z !== undefined ? { z: data.vector.z } : {}),
				...(data.vector.w !== undefined ? { w: data.vector.w } : {}),
			};
		}
		if (data.color) {
			params.colorValue = data.color;
		}
	}

	if (typeId === "inputs") {
		if (
			data.inputType === "number" ||
			data.inputType === "range" ||
			data.inputType === "checkbox" ||
			data.inputType === "text" ||
			data.inputType === "color" ||
			data.inputType === "select"
		) {
			params.type = data.inputType;
		}
		if (typeof data.inputValue === "number") {
			params.numberValue = data.inputValue;
		}
		if (typeof data.inputChecked === "boolean") {
			params.checked = data.inputChecked;
		}
		if (typeof data.inputText === "string") {
			params.textValue = data.inputText;
		}
		if (data.inputColor) {
			params.colorValue = data.inputColor;
		}
		if (Array.isArray(data.inputOptions)) {
			const filtered = data.inputOptions.filter(
				(option): option is string => typeof option === "string",
			);
			if (filtered.length > 0) {
				params.options = filtered.join(", ");
				if (typeof data.inputSelection === "string") {
					params.selection = data.inputSelection;
				} else {
					params.selection = filtered[0];
				}
			}
		}
	}

	return normalizeNodeState(typeId, { ...base, params }) ?? base;
};

const mapLegacyDataToSocketValues = (
	typeId: string,
	data: LegacyNodeData,
): Record<string, NodeSocketValue> | null => {
	if (typeId === "constants") {
		if (typeof data.value === "number") {
			return { out: data.value };
		}
		if (data.vector) {
			return {
				out: {
					x: data.vector.x,
					y: data.vector.y,
					...(data.vector.z !== undefined ? { z: data.vector.z } : {}),
					...(data.vector.w !== undefined ? { w: data.vector.w } : {}),
				},
			};
		}
		if (data.color) {
			return { out: data.color };
		}
	}

	if (typeId === "inputs") {
		if (typeof data.inputValue === "number") {
			return { out: data.inputValue };
		}
		if (typeof data.inputChecked === "boolean") {
			return { out: data.inputChecked };
		}
		if (typeof data.inputText === "string") {
			return { out: data.inputText };
		}
		if (data.inputColor) {
			return { out: data.inputColor };
		}
		if (typeof data.inputSelection === "string") {
			return { out: data.inputSelection };
		}
	}

	return null;
};

const migrateSocketValuesFromState = (
	typeId: string,
	state: NodeState,
	existingSocketValues?: Record<string, NodeSocketValue> | null,
) => {
	const socketValues: Record<string, NodeSocketValue> = {
		...(existingSocketValues ?? {}),
	};
	const params = { ...state.params };

	if (typeId === "constants") {
		const constType = typeof params.type === "string" ? params.type : "float";
		if (socketValues.out === undefined) {
			if (constType === "color" && isColorSocketValue(params.colorValue)) {
				socketValues.out = params.colorValue;
			} else if (
				(constType === "vec2" ||
					constType === "vec3" ||
					constType === "vec4") &&
				isVectorSocketValue(params.vectorValue)
			) {
				socketValues.out = params.vectorValue;
			} else if (typeof params.floatValue === "number") {
				socketValues.out = params.floatValue;
			}
		}
		delete params.floatValue;
		delete params.vectorValue;
		delete params.colorValue;
	}

	if (typeId === "inputs") {
		const inputType = typeof params.type === "string" ? params.type : "number";
		if (socketValues.out === undefined) {
			if (inputType === "checkbox" && typeof params.checked === "boolean") {
				socketValues.out = params.checked;
			} else if (inputType === "text" && typeof params.textValue === "string") {
				socketValues.out = params.textValue;
			} else if (
				inputType === "color" &&
				isColorSocketValue(params.colorValue)
			) {
				socketValues.out = params.colorValue;
			} else if (
				inputType === "select" &&
				typeof params.selection === "string"
			) {
				socketValues.out = params.selection;
			} else if (typeof params.numberValue === "number") {
				socketValues.out = params.numberValue;
			}
		}
		delete params.numberValue;
		delete params.checked;
		delete params.textValue;
		delete params.colorValue;
		delete params.selection;
	}

	return {
		state: { ...state, params },
		socketValues: Object.keys(socketValues).length > 0 ? socketValues : null,
	};
};

const parseNode = (value: unknown): SerializableNode | null => {
	if (!isRecord(value)) {
		return null;
	}

	const {
		id,
		title,
		x,
		y,
		ports,
		familyId,
		templateId,
		data,
		typeId,
		state,
		socketValues,
	} = value;
	if (
		typeof id !== "number" ||
		!Number.isFinite(id) ||
		typeof title !== "string" ||
		typeof x !== "number" ||
		!Number.isFinite(x) ||
		typeof y !== "number" ||
		!Number.isFinite(y) ||
		!Array.isArray(ports)
	) {
		return null;
	}

	const parsedPorts = ports.map(parsePort);
	if (parsedPorts.some((port) => !port)) {
		return null;
	}

	const parsedFamilyId =
		typeof familyId === "string" && isNodeFamilyId(familyId)
			? (familyId as NodeFamilyId)
			: undefined;
	const parsedTemplateId =
		typeof templateId === "string" ? templateId : undefined;
	const parsedTypeId = typeof typeId === "string" ? typeId : undefined;
	const parsedState = parseNodeState(state);
	const parsedSocketValues = parseSocketValues(socketValues);

	const parseVector = (
		payload: Record<string, unknown>,
		components: Array<"x" | "y" | "z" | "w">,
	) => {
		const vector = payload.vector;
		if (!isRecord(vector)) {
			return undefined;
		}

		const values: { x: number; y: number; z?: number; w?: number } = {
			x: 0,
			y: 0,
		};

		for (const component of components) {
			const value = vector[component];
			if (typeof value !== "number" || !Number.isFinite(value)) {
				return undefined;
			}
			values[component] = value;
		}

		return { vector: values };
	};

	const parseConstData = (
		payload: Record<string, unknown>,
	): LegacyNodeData | undefined => {
		const constType = payload.constType;
		if (constType === "float") {
			const value = payload.value;
			if (typeof value === "number" && Number.isFinite(value)) {
				return { constType: "float", value };
			}
			return undefined;
		}
		if (constType === "vec2") {
			const parsed = parseVector(payload, ["x", "y"]);
			return parsed ? { constType: "vec2", ...parsed } : undefined;
		}
		if (constType === "vec3") {
			const parsed = parseVector(payload, ["x", "y", "z"]);
			return parsed ? { constType: "vec3", ...parsed } : undefined;
		}
		if (constType === "vec4") {
			const parsed = parseVector(payload, ["x", "y", "z", "w"]);
			return parsed ? { constType: "vec4", ...parsed } : undefined;
		}
		if (constType === "color") {
			const color = payload.color;
			if (!isRecord(color)) {
				return undefined;
			}
			const r = color.r;
			const g = color.g;
			const b = color.b;
			const a = color.a;
			if (
				typeof r === "number" &&
				Number.isFinite(r) &&
				typeof g === "number" &&
				Number.isFinite(g) &&
				typeof b === "number" &&
				Number.isFinite(b) &&
				typeof a === "number" &&
				Number.isFinite(a)
			) {
				return { constType: "color", color: { r, g, b, a } };
			}
			return undefined;
		}

		const value = payload.value;
		if (typeof value === "number" && Number.isFinite(value)) {
			return { constType: "float", value };
		}
		const color = payload.color;
		if (isRecord(color)) {
			const r = color.r;
			const g = color.g;
			const b = color.b;
			const a = color.a;
			if (
				typeof r === "number" &&
				Number.isFinite(r) &&
				typeof g === "number" &&
				Number.isFinite(g) &&
				typeof b === "number" &&
				Number.isFinite(b) &&
				typeof a === "number" &&
				Number.isFinite(a)
			) {
				return { constType: "color", color: { r, g, b, a } };
			}
		}
		return undefined;
	};

	const parseInputData = (
		payload: Record<string, unknown>,
	): LegacyNodeData | undefined => {
		const inputType = payload.inputType;
		if (
			inputType !== "number" &&
			inputType !== "range" &&
			inputType !== "checkbox" &&
			inputType !== "text" &&
			inputType !== "color" &&
			inputType !== "select"
		) {
			return undefined;
		}

		if (inputType === "number" || inputType === "range") {
			const inputValue = payload.inputValue;
			if (typeof inputValue === "number" && Number.isFinite(inputValue)) {
				return { inputType, inputValue };
			}
			return { inputType, inputValue: 0 };
		}

		if (inputType === "checkbox") {
			const inputChecked = payload.inputChecked;
			if (typeof inputChecked === "boolean") {
				return { inputType: "checkbox", inputChecked };
			}
			return { inputType: "checkbox", inputChecked: false };
		}

		if (inputType === "text") {
			const inputText = payload.inputText;
			if (typeof inputText === "string") {
				return { inputType: "text", inputText };
			}
			return { inputType: "text", inputText: "" };
		}

		if (inputType === "color") {
			const color = payload.inputColor;
			if (!isRecord(color)) {
				return undefined;
			}
			const r = color.r;
			const g = color.g;
			const b = color.b;
			const a = color.a;
			if (
				typeof r === "number" &&
				Number.isFinite(r) &&
				typeof g === "number" &&
				Number.isFinite(g) &&
				typeof b === "number" &&
				Number.isFinite(b) &&
				typeof a === "number" &&
				Number.isFinite(a)
			) {
				return { inputType: "color", inputColor: { r, g, b, a } };
			}
			return undefined;
		}

		const options = payload.inputOptions;
		if (!Array.isArray(options) || options.length === 0) {
			return undefined;
		}
		const parsedOptions = options.filter(
			(option): option is string => typeof option === "string",
		);
		if (parsedOptions.length === 0) {
			return undefined;
		}
		const inputSelection = payload.inputSelection;
		return {
			inputType: "select",
			inputOptions: parsedOptions,
			...(typeof inputSelection === "string" ? { inputSelection } : {}),
		};
	};

	const parseFamilyData = (
		family: NodeFamilyId | undefined,
		payload: unknown,
	): LegacyNodeData | undefined => {
		if (!family || !isRecord(payload)) {
			return undefined;
		}
		if (family === "constants") {
			return parseConstData(payload);
		}
		if (family === "inputs") {
			return parseInputData(payload);
		}
		if (family === "math") {
			const mathOp = payload.mathOp;
			const mathType = payload.mathType;
			const next: LegacyNodeData = {};
			if (isMathOperationId(mathOp)) {
				next.mathOp = mathOp;
			}
			if (
				mathType === "float" ||
				mathType === "vec2" ||
				mathType === "vec3" ||
				mathType === "vec4"
			) {
				next.mathType = mathType;
			}
			return Object.keys(next).length > 0 ? next : undefined;
		}
		if (family === "vector") {
			const next: LegacyNodeData = {};
			if (typeof payload.vectorOp === "string") {
				next.vectorOp = payload.vectorOp;
			}
			if (
				payload.vectorType === "vec2" ||
				payload.vectorType === "vec3" ||
				payload.vectorType === "vec4"
			) {
				next.vectorType = payload.vectorType;
			}
			if (
				payload.component === "x" ||
				payload.component === "y" ||
				payload.component === "z" ||
				payload.component === "w"
			) {
				next.component = payload.component;
			}
			return Object.keys(next).length > 0 ? next : undefined;
		}
		if (family === "color") {
			const colorOp = payload.colorOp;
			if (typeof colorOp === "string") {
				return { colorOp };
			}
			return undefined;
		}
		if (family === "conversion") {
			const conversionOp = payload.conversionOp;
			if (typeof conversionOp === "string") {
				return { conversionOp };
			}
			return undefined;
		}
		if (family === "logic") {
			const logicOp = payload.logicOp;
			if (typeof logicOp === "string") {
				return { logicOp };
			}
			return undefined;
		}
		if (family === "texture-uv") {
			const textureOp = payload.textureOp;
			if (typeof textureOp === "string") {
				return { textureOp };
			}
			return undefined;
		}
		if (family === "output") {
			const outputType = payload.outputType;
			if (outputType === "fragment" || outputType === "vertex") {
				return { outputType };
			}
			return undefined;
		}
		return undefined;
	};

	const parseLegacyNodeData = (
		template: string | undefined,
		payload: unknown,
	): LegacyNodeData | undefined => {
		if (!template || !isRecord(payload)) {
			return undefined;
		}

		if (template.startsWith("const-")) {
			return parseConstData(payload);
		}

		if (template === "vector-component") {
			const component = payload.component;
			if (
				component === "x" ||
				component === "y" ||
				component === "z" ||
				component === "w"
			) {
				return { component };
			}
			return undefined;
		}

		if (template.startsWith("math-")) {
			const mathOp = payload.mathOp;
			if (isMathOperationId(mathOp)) {
				return { mathOp };
			}
			return undefined;
		}

		return undefined;
	};

	let legacyData = parseFamilyData(parsedFamilyId, data);

	let resolvedTypeId = parsedTypeId ?? parsedFamilyId;
	let resolvedState = parsedState;
	let resolvedSocketValues = parsedSocketValues ?? null;

	if (
		!resolvedTypeId &&
		parsedTemplateId &&
		isLegacyTemplateId(parsedTemplateId)
	) {
		const legacyPayload = parseLegacyNodeData(parsedTemplateId, data);
		const migrated = migrateLegacyTemplate(parsedTemplateId, legacyPayload);
		if (migrated) {
			resolvedTypeId = migrated.familyId;
			legacyData = migrated.data;
		}
	}

	if (!resolvedState && resolvedTypeId && legacyData) {
		resolvedState = mapLegacyDataToState(resolvedTypeId, legacyData);
	}

	if (!resolvedSocketValues && resolvedTypeId && legacyData) {
		resolvedSocketValues = mapLegacyDataToSocketValues(
			resolvedTypeId,
			legacyData,
		);
	}

	if (!resolvedState && resolvedTypeId) {
		resolvedState = getDefaultNodeState(resolvedTypeId);
	}

	if (resolvedState && resolvedTypeId) {
		const migrated = migrateSocketValuesFromState(
			resolvedTypeId,
			resolvedState,
			resolvedSocketValues,
		);
		resolvedState = migrated.state;
		resolvedSocketValues = migrated.socketValues;
		resolvedState =
			normalizeNodeState(resolvedTypeId, resolvedState) ?? resolvedState;
	}

	return {
		id,
		title,
		x,
		y,
		ports: parsedPorts.filter(
			(port): port is SerializablePort => port !== null,
		),
		...(resolvedState ? { state: resolvedState } : {}),
		...(resolvedSocketValues ? { socketValues: resolvedSocketValues } : {}),
		...(resolvedTypeId ? { typeId: resolvedTypeId } : {}),
	};
};

const parseConnection = (value: unknown): SerializableConnection | null => {
	if (!isRecord(value)) {
		return null;
	}

	const { from, to, type } = value;
	if (!isRecord(from) || !isRecord(to) || !isPortType(type)) {
		return null;
	}

	const fromNodeId = from.nodeId;
	const fromPortId = from.portId;
	const toNodeId = to.nodeId;
	const toPortId = to.portId;

	if (
		typeof fromNodeId !== "number" ||
		!Number.isFinite(fromNodeId) ||
		typeof fromPortId !== "string" ||
		typeof toNodeId !== "number" ||
		!Number.isFinite(toNodeId) ||
		typeof toPortId !== "string"
	) {
		return null;
	}

	return {
		from: { nodeId: fromNodeId, portId: fromPortId },
		to: { nodeId: toNodeId, portId: toPortId },
		type,
	};
};

const parseGroup = (value: unknown): SerializableGroup | null => {
	if (!isRecord(value)) {
		return null;
	}

	const { id, title, nodeIds, collapsed, x, y, parentId, color } = value;
	if (
		typeof id !== "number" ||
		!Number.isFinite(id) ||
		typeof title !== "string" ||
		!Array.isArray(nodeIds) ||
		typeof collapsed !== "boolean" ||
		typeof x !== "number" ||
		!Number.isFinite(x) ||
		typeof y !== "number" ||
		!Number.isFinite(y)
	) {
		return null;
	}

	let resolvedParentId: number | null | undefined;
	if (typeof parentId === "number" && Number.isFinite(parentId)) {
		resolvedParentId = parentId;
	} else if (parentId === null) {
		resolvedParentId = null;
	}

	let resolvedColor: number | null | undefined;
	if (typeof color === "number" && Number.isFinite(color)) {
		resolvedColor = color;
	} else if (color === null) {
		resolvedColor = null;
	}

	const filteredNodeIds = nodeIds.filter(
		(nodeId): nodeId is number =>
			typeof nodeId === "number" && Number.isFinite(nodeId),
	);

	return {
		id,
		title,
		nodeIds: filteredNodeIds,
		...(resolvedParentId !== undefined ? { parentId: resolvedParentId } : {}),
		collapsed,
		x,
		y,
		...(resolvedColor !== undefined ? { color: resolvedColor } : {}),
	};
};

const parseCamera = (
	value: unknown,
): SerializableGraph["camera"] | undefined => {
	if (!isRecord(value)) {
		return undefined;
	}

	const { pivotX, pivotY, scale } = value;
	if (
		typeof pivotX !== "number" ||
		!Number.isFinite(pivotX) ||
		typeof pivotY !== "number" ||
		!Number.isFinite(pivotY) ||
		typeof scale !== "number" ||
		!Number.isFinite(scale)
	) {
		return undefined;
	}

	return { pivotX, pivotY, scale };
};

export const parseGraphWithReport = (value: unknown): GraphParseReport => {
	const errors: string[] = [];
	if (!isRecord(value)) {
		errors.push("Graph data must be a JSON object.");
		return { snapshot: null, errors };
	}

	const { normalized, errors: migrationErrors } =
		migrateGraphPayloadWithReport(value);
	if (!normalized) {
		errors.push(...migrationErrors);
		if (errors.length === 0) {
			errors.push("Graph version is unsupported.");
		}
		return { snapshot: null, errors };
	}

	const { nodes, connections, camera, groups } = normalized;
	if (!Array.isArray(nodes) || !Array.isArray(connections)) {
		errors.push("Graph data is missing required nodes or connections arrays.");
		return { snapshot: null, errors };
	}

	const parsedNodes = nodes.map(parseNode);
	const validNodes = parsedNodes.filter(
		(node): node is SerializableNode => node !== null,
	);
	const invalidNodeCount = parsedNodes.length - validNodes.length;
	if (invalidNodeCount > 0) {
		errors.push(
			`Graph contained ${invalidNodeCount} invalid node(s) that were dropped.`,
		);
		if (validNodes.length === 0 && nodes.length > 0) {
			return { snapshot: null, errors };
		}
	}

	const parsedConnections = connections
		.map(parseConnection)
		.filter(
			(connection): connection is SerializableConnection => connection !== null,
		);

	const parsedCamera = parseCamera(camera);
	const parsedGroups = Array.isArray(groups)
		? groups
				.map(parseGroup)
				.filter((group): group is SerializableGroup => group !== null)
		: [];
	const snapshot: SerializableGraph = {
		version: GRAPH_SCHEMA_VERSION,
		nodes: validNodes,
		connections: parsedConnections,
	};

	if (parsedCamera) {
		snapshot.camera = parsedCamera;
	}
	if (parsedGroups.length > 0) {
		snapshot.groups = parsedGroups;
	}

	return { snapshot, errors };
};

export const parseGraph = (value: unknown): SerializableGraph | null => {
	const { snapshot } = parseGraphWithReport(value);
	return snapshot;
};
