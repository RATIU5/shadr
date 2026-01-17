import { getMathOperationId } from "./math-ops";
import {
	getDefaultNodeState,
	getInputSelection,
	getInputSelectOptions,
	getNodeDefinition,
	normalizeNodeState,
} from "./node-definitions";
import type {
	Connection,
	NodeCompileContext,
	NodeState,
	NodeView,
	PortRef,
	PortType,
	ShaderCompileMessage,
	ShaderCompileResult,
} from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const formatFloat = (value: number) => {
	if (!Number.isFinite(value)) {
		return "0.0";
	}
	const fixed = value.toFixed(4);
	const trimmed = fixed.replace(/\.?0+$/, "");
	return trimmed.includes(".") ? trimmed : `${trimmed}.0`;
};

const getParamString = (state: NodeState, id: string, fallback: string) => {
	const value = state.params[id];
	return typeof value === "string" ? value : fallback;
};

const getParamNumber = (state: NodeState, id: string, fallback: number) => {
	const value = state.params[id];
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const getParamBoolean = (state: NodeState, id: string, fallback: boolean) => {
	const value = state.params[id];
	return typeof value === "boolean" ? value : fallback;
};

const getParamVector = (
	state: NodeState,
	id: string,
	fallback: { x: number; y: number; z?: number; w?: number },
) => {
	const value = state.params[id];
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return fallback;
	}
	const record = value as Record<string, unknown>;
	if (typeof record.x !== "number" || typeof record.y !== "number") {
		return fallback;
	}
	return {
		x: record.x,
		y: record.y,
		z: typeof record.z === "number" ? record.z : fallback.z,
		w: typeof record.w === "number" ? record.w : fallback.w,
	};
};

const getParamColor = (
	state: NodeState,
	id: string,
	fallback: { r: number; g: number; b: number; a: number },
) => {
	const value = state.params[id];
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return fallback;
	}
	const record = value as Record<string, unknown>;
	if (
		typeof record.r !== "number" ||
		typeof record.g !== "number" ||
		typeof record.b !== "number" ||
		typeof record.a !== "number"
	) {
		return fallback;
	}
	return {
		r: record.r,
		g: record.g,
		b: record.b,
		a: record.a,
	};
};

const defaultVector = { x: 0, y: 0, z: 0, w: 0 };
const defaultColor = { r: 1, g: 1, b: 1, a: 1 };

const getOutputPortType = (context: NodeCompileContext): PortType => {
	const port = context.node.ports.find(
		(candidate) => candidate.id === context.portId,
	);
	return port?.type ?? "float";
};

const buildBinaryExpression = (
	context: NodeCompileContext,
	portType: PortType,
	operator: string,
) => {
	const aType = context.getInputPortType("a", portType);
	const bType = context.getInputPortType("b", portType);
	const aExpr = context.getInputExpression("a", aType);
	const bExpr = context.getInputExpression("b", bType);
	return `(${aExpr} ${operator} ${bExpr})`;
};

const buildMixExpression = (
	context: NodeCompileContext,
	portType: PortType,
) => {
	const aType = context.getInputPortType("a", portType);
	const bType = context.getInputPortType("b", portType);
	const aExpr = context.getInputExpression("a", aType);
	const bExpr = context.getInputExpression("b", bType);
	const tExpr = context.getInputExpression("t", "float");
	return `mix(${aExpr}, ${bExpr}, ${tExpr})`;
};

const buildClampExpression = (
	context: NodeCompileContext,
	portType: PortType,
) => {
	const inType = context.getInputPortType("in", portType);
	const minType = context.getInputPortType("min", portType);
	const maxType = context.getInputPortType("max", portType);
	const inExpr = context.getInputExpression("in", inType);
	const minExpr = context.getInputExpression("min", minType);
	const maxExpr = context.getInputExpression("max", maxType);
	return `clamp(${inExpr}, ${minExpr}, ${maxExpr})`;
};

const buildClamp01Expression = (
	context: NodeCompileContext,
	portType: PortType,
	inputId: string,
) => {
	const inputType = context.getInputPortType(inputId, portType);
	const inputExpr = context.getInputExpression(inputId, inputType);
	return `clamp(${inputExpr}, 0.0, 1.0)`;
};

const buildUnaryExpression = (
	context: NodeCompileContext,
	portType: PortType,
	inputId: string,
	fn: string,
) => {
	const inputType = context.getInputPortType(inputId, portType);
	const inputExpr = context.getInputExpression(inputId, inputType);
	return `${fn}(${inputExpr})`;
};

const buildBinaryFunctionExpression = (
	context: NodeCompileContext,
	portType: PortType,
	fn: string,
	inputA: string,
	inputB: string,
) => {
	const aType = context.getInputPortType(inputA, portType);
	const bType = context.getInputPortType(inputB, portType);
	const aExpr = context.getInputExpression(inputA, aType);
	const bExpr = context.getInputExpression(inputB, bType);
	return `${fn}(${aExpr}, ${bExpr})`;
};

const buildCompareExpression = (
	context: NodeCompileContext,
	portType: PortType,
) => {
	const aType = context.getInputPortType("a", portType);
	const bType = context.getInputPortType("b", portType);
	const aExpr = context.getInputExpression("a", aType);
	const bExpr = context.getInputExpression("b", bType);
	const epsilonExpr = context.getInputExpression("epsilon", "float", "0.001");
	const deltaExpr = `abs(${aExpr} - ${bExpr})`;
	return `1.0 - step(max(${epsilonExpr}, 0.000001), ${deltaExpr})`;
};

const buildSmoothMinExpression = (
	aExpr: string,
	bExpr: string,
	distanceExpr: string,
) => {
	const kExpr = `max(${distanceExpr}, 0.0001)`;
	const hExpr = `clamp(0.5 + 0.5 * ((${bExpr}) - (${aExpr})) / ${kExpr}, 0.0, 1.0)`;
	return `mix(${bExpr}, ${aExpr}, ${hExpr}) - ${kExpr} * ${hExpr} * (1.0 - ${hExpr})`;
};

const buildSmoothMinMaxExpression = (
	context: NodeCompileContext,
	portType: PortType,
	kind: "min" | "max",
) => {
	const aType = context.getInputPortType("a", portType);
	const bType = context.getInputPortType("b", portType);
	const aExpr = context.getInputExpression("a", aType);
	const bExpr = context.getInputExpression("b", bType);
	const distanceExpr = context.getInputExpression("distance", "float", "0.5");
	if (kind === "min") {
		return buildSmoothMinExpression(aExpr, bExpr, distanceExpr);
	}
	const negA = `-(${aExpr})`;
	const negB = `-(${bExpr})`;
	const smoothMin = buildSmoothMinExpression(negA, negB, distanceExpr);
	return `-(${smoothMin})`;
};

const buildRoundExpression = (
	context: NodeCompileContext,
	portType: PortType,
	inputId: string,
) => {
	const inputType = context.getInputPortType(inputId, portType);
	const inputExpr = context.getInputExpression(inputId, inputType);
	return `floor(${inputExpr} + 0.5)`;
};

const buildTruncExpression = (
	context: NodeCompileContext,
	portType: PortType,
	inputId: string,
) => {
	const inputType = context.getInputPortType(inputId, portType);
	const inputExpr = context.getInputExpression(inputId, inputType);
	return `sign(${inputExpr}) * floor(abs(${inputExpr}))`;
};

const buildTruncatedModuloExpression = (
	context: NodeCompileContext,
	portType: PortType,
) => {
	const aType = context.getInputPortType("a", portType);
	const bType = context.getInputPortType("b", portType);
	const aExpr = context.getInputExpression("a", aType);
	const bExpr = context.getInputExpression("b", bType, "1.0");
	const divExpr = `(${aExpr} / (${bExpr}))`;
	return `${aExpr} - (${bExpr}) * (sign(${divExpr}) * floor(abs(${divExpr})))`;
};

const buildWrapExpression = (
	context: NodeCompileContext,
	portType: PortType,
) => {
	const valueType = context.getInputPortType("value", portType);
	const minType = context.getInputPortType("min", portType);
	const maxType = context.getInputPortType("max", portType);
	const valueExpr = context.getInputExpression("value", valueType);
	const minExpr = context.getInputExpression("min", minType);
	const maxExpr = context.getInputExpression("max", maxType);
	return `${minExpr} + mod(${valueExpr} - ${minExpr}, ${maxExpr} - ${minExpr})`;
};

const buildSnapExpression = (
	context: NodeCompileContext,
	portType: PortType,
) => {
	const valueType = context.getInputPortType("value", portType);
	const incrementType = context.getInputPortType("increment", portType);
	const valueExpr = context.getInputExpression("value", valueType);
	const incrementExpr = context.getInputExpression("increment", incrementType);
	return `floor((${valueExpr}) / (${incrementExpr})) * (${incrementExpr})`;
};

const buildPingPongExpression = (
	context: NodeCompileContext,
	portType: PortType,
) => {
	const valueType = context.getInputPortType("value", portType);
	const lengthType = context.getInputPortType("length", portType);
	const valueExpr = context.getInputExpression("value", valueType);
	const lengthExpr = context.getInputExpression("length", lengthType, "1.0");
	const doubleLength = `(${lengthExpr} * 2.0)`;
	const modExpr = `mod(${valueExpr}, ${doubleLength})`;
	return `(${lengthExpr} - abs(${modExpr} - ${lengthExpr}))`;
};

const buildLogicBinaryExpression = (
	context: NodeCompileContext,
	op: "and" | "or",
) => {
	const aExpr = context.getInputExpression("a", "float");
	const bExpr = context.getInputExpression("b", "float");
	if (op === "and") {
		return `step(0.5, ${aExpr}) * step(0.5, ${bExpr})`;
	}
	return `max(step(0.5, ${aExpr}), step(0.5, ${bExpr}))`;
};

const buildLogicNotExpression = (context: NodeCompileContext) => {
	const inputExpr = context.getInputExpression("in", "float");
	return `1.0 - step(0.5, ${inputExpr})`;
};

const buildSelectExpression = (
	context: NodeCompileContext,
	portType: PortType,
) => {
	const aType = context.getInputPortType("a", portType);
	const bType = context.getInputPortType("b", portType);
	const aExpr = context.getInputExpression("a", aType);
	const bExpr = context.getInputExpression("b", bType);
	const condExpr = context.getInputExpression("cond", "float");
	return `mix(${aExpr}, ${bExpr}, step(0.5, ${condExpr}))`;
};

const compileConstantsNode = (context: NodeCompileContext) => {
	const type = getParamString(context.state, "type", "float");
	if (type === "vec2") {
		const vector = getParamVector(context.state, "vectorValue", defaultVector);
		return `vec2(${formatFloat(vector.x)}, ${formatFloat(vector.y)})`;
	}
	if (type === "vec3") {
		const vector = getParamVector(context.state, "vectorValue", defaultVector);
		return `vec3(${formatFloat(vector.x)}, ${formatFloat(vector.y)}, ${formatFloat(vector.z ?? 0)})`;
	}
	if (type === "vec4") {
		const vector = getParamVector(context.state, "vectorValue", defaultVector);
		return `vec4(${formatFloat(vector.x)}, ${formatFloat(vector.y)}, ${formatFloat(vector.z ?? 0)}, ${formatFloat(vector.w ?? 0)})`;
	}
	if (type === "color") {
		const color = getParamColor(context.state, "colorValue", defaultColor);
		const r = formatFloat(clamp01(color.r));
		const g = formatFloat(clamp01(color.g));
		const b = formatFloat(clamp01(color.b));
		const a = formatFloat(clamp01(color.a));
		return `vec4(${r}, ${g}, ${b}, ${a})`;
	}
	const value = getParamNumber(context.state, "floatValue", 0);
	return formatFloat(value);
};

const compileInputsNode = (context: NodeCompileContext) => {
	const inputType = getParamString(context.state, "type", "number");
	if (inputType === "color") {
		const color = getParamColor(context.state, "colorValue", defaultColor);
		const r = formatFloat(clamp01(color.r));
		const g = formatFloat(clamp01(color.g));
		const b = formatFloat(clamp01(color.b));
		const a = formatFloat(clamp01(color.a));
		return `vec4(${r}, ${g}, ${b}, ${a})`;
	}
	if (inputType === "checkbox") {
		return getParamBoolean(context.state, "checked", false) ? "1.0" : "0.0";
	}
	if (inputType === "text") {
		const text = getParamString(context.state, "textValue", "");
		const parsed = Number.parseFloat(text);
		return formatFloat(Number.isFinite(parsed) ? parsed : 0);
	}
	if (inputType === "select") {
		const selection = getInputSelection(context.state);
		const parsed = Number.parseFloat(selection);
		if (Number.isFinite(parsed)) {
			return formatFloat(parsed);
		}
		const options = getInputSelectOptions(context.state);
		const index = options.indexOf(selection);
		return formatFloat(index >= 0 ? index : 0);
	}
	const value = getParamNumber(context.state, "numberValue", 0);
	return formatFloat(value);
};

const compileMathNode = (context: NodeCompileContext) => {
	const portType = getOutputPortType(context);
	const mathOp = getMathOperationId(
		getParamString(context.state, "operation", "add"),
	);
	switch (mathOp) {
		case "add":
			return buildBinaryExpression(context, portType, "+");
		case "multiply":
			return buildBinaryExpression(context, portType, "*");
		case "subtract":
			return buildBinaryExpression(context, portType, "-");
		case "divide":
			return buildBinaryExpression(context, portType, "/");
		case "clamp":
			return buildClampExpression(context, portType);
		case "clamp01":
			return buildClamp01Expression(context, portType, "in");
		case "lerp":
			return buildMixExpression(context, portType);
		case "multiply-add": {
			const aType = context.getInputPortType("a", portType);
			const bType = context.getInputPortType("b", portType);
			const addType = context.getInputPortType("addend", portType);
			const aExpr = context.getInputExpression("a", aType);
			const bExpr = context.getInputExpression("b", bType);
			const addExpr = context.getInputExpression("addend", addType);
			return `(${aExpr} * ${bExpr}) + ${addExpr}`;
		}
		case "power":
			return buildBinaryFunctionExpression(
				context,
				portType,
				"pow",
				"base",
				"exponent",
			);
		case "log":
			return buildBinaryFunctionExpression(
				context,
				portType,
				"log",
				"value",
				"base",
			);
		case "sqrt":
			return buildUnaryExpression(context, portType, "in", "sqrt");
		case "inverse-sqrt":
			return buildUnaryExpression(context, portType, "in", "inversesqrt");
		case "abs":
			return buildUnaryExpression(context, portType, "in", "abs");
		case "exp":
			return buildUnaryExpression(context, portType, "in", "exp");
		case "min":
			return buildBinaryFunctionExpression(context, portType, "min", "a", "b");
		case "max":
			return buildBinaryFunctionExpression(context, portType, "max", "a", "b");
		case "sign":
			return buildUnaryExpression(context, portType, "in", "sign");
		case "compare":
			return buildCompareExpression(context, portType);
		case "smooth-min":
			return buildSmoothMinMaxExpression(context, portType, "min");
		case "smooth-max":
			return buildSmoothMinMaxExpression(context, portType, "max");
		case "round":
			return buildRoundExpression(context, portType, "in");
		case "floor":
			return buildUnaryExpression(context, portType, "in", "floor");
		case "ceil":
			return buildUnaryExpression(context, portType, "in", "ceil");
		case "trunc":
			return buildTruncExpression(context, portType, "in");
		case "fract":
			return buildUnaryExpression(context, portType, "in", "fract");
		case "mod":
			return buildTruncatedModuloExpression(context, portType);
		case "mod-float":
			return buildBinaryFunctionExpression(context, portType, "mod", "a", "b");
		case "wrap":
			return buildWrapExpression(context, portType);
		case "snap":
			return buildSnapExpression(context, portType);
		case "ping-pong":
			return buildPingPongExpression(context, portType);
		case "sin":
			return buildUnaryExpression(context, portType, "in", "sin");
		case "cos":
			return buildUnaryExpression(context, portType, "in", "cos");
		case "tan":
			return buildUnaryExpression(context, portType, "in", "tan");
		case "asin":
			return buildUnaryExpression(context, portType, "in", "asin");
		case "acos":
			return buildUnaryExpression(context, portType, "in", "acos");
		case "atan":
			return buildUnaryExpression(context, portType, "in", "atan");
		case "atan2":
			return buildBinaryFunctionExpression(context, portType, "atan", "y", "x");
		case "radians":
			return buildUnaryExpression(context, portType, "in", "radians");
		case "degrees":
			return buildUnaryExpression(context, portType, "in", "degrees");
		default:
			context.addError(
				`Math operation "${mathOp}" is not supported by GLSL export.`,
			);
			return context.defaultValueForPort(portType);
	}
};

const compileVectorNode = (context: NodeCompileContext) => {
	const portType = getOutputPortType(context);
	const vectorOp = getParamString(context.state, "operation", "compose");
	switch (vectorOp) {
		case "position-input":
			context.markNeed("position");
			return context.stage === "vertex"
				? "vec3(a_position, 0.0)"
				: "v_position";
		case "component": {
			const inputExpr = context.getInputExpression("in", "vec4");
			const component = getParamString(context.state, "component", "x");
			const swizzle =
				component === "y" || component === "z" || component === "w"
					? component
					: "x";
			return `vec4((${inputExpr}).${swizzle})`;
		}
		case "compose": {
			const vectorType = getParamString(context.state, "type", "vec2");
			const xExpr = context.getInputExpression("x", "float");
			const yExpr = context.getInputExpression("y", "float");
			if (vectorType === "vec2") {
				return `vec2(${xExpr}, ${yExpr})`;
			}
			const zExpr = context.getInputExpression("z", "float");
			if (vectorType === "vec3") {
				return `vec3(${xExpr}, ${yExpr}, ${zExpr})`;
			}
			const wExpr = context.getInputExpression("w", "float");
			return `vec4(${xExpr}, ${yExpr}, ${zExpr}, ${wExpr})`;
		}
		case "split": {
			const inputExpr = context.getInputExpression(
				"in",
				portType === "vec2" ? "vec2" : portType === "vec3" ? "vec3" : "vec4",
			);
			return `(${inputExpr}).${context.portId}`;
		}
		case "dot":
			return buildBinaryFunctionExpression(context, portType, "dot", "a", "b");
		case "cross":
			return buildBinaryFunctionExpression(
				context,
				portType,
				"cross",
				"a",
				"b",
			);
		case "normalize":
			return buildUnaryExpression(context, portType, "in", "normalize");
		case "length":
			return buildUnaryExpression(context, portType, "in", "length");
		case "distance":
			return buildBinaryFunctionExpression(
				context,
				portType,
				"distance",
				"a",
				"b",
			);
		case "reflect":
			return buildBinaryFunctionExpression(
				context,
				portType,
				"reflect",
				"i",
				"n",
			);
		case "refract": {
			const iType = context.getInputPortType("i", portType);
			const nType = context.getInputPortType("n", portType);
			const iExpr = context.getInputExpression("i", iType);
			const nExpr = context.getInputExpression("n", nType);
			const etaExpr = context.getInputExpression("eta", "float", "1.0");
			return `refract(${iExpr}, ${nExpr}, ${etaExpr})`;
		}
		default:
			context.addError(
				`Vector operation "${vectorOp}" is not supported by GLSL export.`,
			);
			return context.defaultValueForPort(portType);
	}
};

const compileColorNode = (context: NodeCompileContext) => {
	const colorOp = getParamString(context.state, "operation", "mix");
	switch (colorOp) {
		case "mix": {
			const aExpr = context.getInputExpression("a", "color");
			const bExpr = context.getInputExpression("b", "color");
			const tExpr = context.getInputExpression("t", "float");
			return `mix(${aExpr}, ${bExpr}, ${tExpr})`;
		}
		case "add": {
			const aExpr = context.getInputExpression("a", "color");
			const bExpr = context.getInputExpression("b", "color");
			return `vec4((${aExpr}).rgb + (${bExpr}).rgb, (${aExpr}).a)`;
		}
		case "multiply": {
			const aExpr = context.getInputExpression("a", "color");
			const bExpr = context.getInputExpression("b", "color");
			return `vec4((${aExpr}).rgb * (${bExpr}).rgb, (${aExpr}).a)`;
		}
		case "screen": {
			const aExpr = context.getInputExpression("a", "color");
			const bExpr = context.getInputExpression("b", "color");
			const aRgb = `(${aExpr}).rgb`;
			const bRgb = `(${bExpr}).rgb`;
			return `vec4(1.0 - (1.0 - ${aRgb}) * (1.0 - ${bRgb}), (${aExpr}).a)`;
		}
		case "overlay": {
			const aExpr = context.getInputExpression("a", "color");
			const bExpr = context.getInputExpression("b", "color");
			const aRgb = `(${aExpr}).rgb`;
			const bRgb = `(${bExpr}).rgb`;
			const overlayExpr = `mix(2.0 * ${aRgb} * ${bRgb}, 1.0 - 2.0 * (1.0 - ${aRgb}) * (1.0 - ${bRgb}), step(vec3(0.5), ${aRgb}))`;
			return `vec4(${overlayExpr}, (${aExpr}).a)`;
		}
		case "invert": {
			const inputExpr = context.getInputExpression("in", "color");
			return `vec4(1.0 - (${inputExpr}).rgb, (${inputExpr}).a)`;
		}
		case "gamma": {
			const inputExpr = context.getInputExpression("in", "color");
			const gammaExpr = context.getInputExpression("gamma", "float", "1.0");
			return `vec4(pow((${inputExpr}).rgb, vec3(${gammaExpr})), (${inputExpr}).a)`;
		}
		case "brightness": {
			const inputExpr = context.getInputExpression("in", "color");
			const brightnessExpr = context.getInputExpression(
				"brightness",
				"float",
				"0.0",
			);
			return `vec4((${inputExpr}).rgb + vec3(${brightnessExpr}), (${inputExpr}).a)`;
		}
		case "contrast": {
			const inputExpr = context.getInputExpression("in", "color");
			const contrastExpr = context.getInputExpression(
				"contrast",
				"float",
				"0.0",
			);
			return `vec4(((${inputExpr}).rgb - 0.5) * (1.0 + ${contrastExpr}) + 0.5, (${inputExpr}).a)`;
		}
		case "saturation": {
			const inputExpr = context.getInputExpression("in", "color");
			const saturationExpr = context.getInputExpression(
				"saturation",
				"float",
				"0.0",
			);
			const luminance = `dot((${inputExpr}).rgb, vec3(0.2126, 0.7152, 0.0722))`;
			return `vec4(mix(vec3(${luminance}), (${inputExpr}).rgb, 1.0 + ${saturationExpr}), (${inputExpr}).a)`;
		}
		default:
			context.addError(
				`Color operation "${colorOp}" is not supported by GLSL export.`,
			);
			return context.defaultValueForPort(getOutputPortType(context));
	}
};

const compileLogicNode = (context: NodeCompileContext) => {
	const portType = getOutputPortType(context);
	const logicOp = getParamString(context.state, "operation", "and");
	switch (logicOp) {
		case "and":
			return buildLogicBinaryExpression(context, "and");
		case "or":
			return buildLogicBinaryExpression(context, "or");
		case "not":
			return buildLogicNotExpression(context);
		case "select":
		case "select-vec2":
		case "select-vec3":
		case "select-vec4":
			return buildSelectExpression(context, portType);
		default:
			context.addError(
				`Logic operation "${logicOp}" is not supported by GLSL export.`,
			);
			return context.defaultValueForPort(portType);
	}
};

const compileConversionNode = (context: NodeCompileContext) => {
	const conversionOp = getParamString(
		context.state,
		"operation",
		"float-to-int",
	);
	switch (conversionOp) {
		case "float-to-int": {
			const inputExpr = context.getInputExpression("in", "float");
			return `int(${inputExpr})`;
		}
		case "int-to-float": {
			const inputExpr = context.getInputExpression("in", "int");
			return `float(${inputExpr})`;
		}
		case "vec2-to-vec3": {
			const inputExpr = context.getInputExpression("in", "vec2");
			const zExpr = context.getInputExpression("z", "float");
			return `vec3(${inputExpr}, ${zExpr})`;
		}
		case "vec3-to-vec4": {
			const inputExpr = context.getInputExpression("in", "vec3");
			const wExpr = context.getInputExpression("w", "float");
			return `vec4(${inputExpr}, ${wExpr})`;
		}
		case "vec4-to-vec3": {
			const inputExpr = context.getInputExpression("in", "vec4");
			return `(${inputExpr}).xyz`;
		}
		case "vec3-to-vec2": {
			const inputExpr = context.getInputExpression("in", "vec3");
			return `(${inputExpr}).xy`;
		}
		default:
			context.addError(
				`Conversion operation "${conversionOp}" is not supported by GLSL export.`,
			);
			return context.defaultValueForPort(getOutputPortType(context));
	}
};

const compileTextureNode = (context: NodeCompileContext) => {
	const textureOp = getParamString(context.state, "operation", "uv-input");
	switch (textureOp) {
		case "uv-input":
			context.markNeed("uv");
			return context.stage === "vertex" ? "a_uv" : "v_uv";
		case "texture-input":
			context.markNeed("texture");
			return "u_texture";
		case "time-input":
			context.markNeed("time");
			return "u_time";
		case "uv-scale": {
			const uvExpr = context.getInputExpression("uv", "vec2");
			const scaleExpr = context.getInputExpression(
				"scale",
				"vec2",
				"vec2(1.0)",
			);
			return `(${uvExpr} * ${scaleExpr})`;
		}
		case "uv-offset": {
			const uvExpr = context.getInputExpression("uv", "vec2");
			const offsetExpr = context.getInputExpression(
				"offset",
				"vec2",
				"vec2(0.0)",
			);
			return `(${uvExpr} + ${offsetExpr})`;
		}
		case "uv-rotate": {
			const uvExpr = context.getInputExpression("uv", "vec2");
			const angleExpr = context.getInputExpression("angle", "float", "0.0");
			const centerExpr = context.getInputExpression(
				"center",
				"vec2",
				"vec2(0.5)",
			);
			const sinExpr = `sin(${angleExpr})`;
			const cosExpr = `cos(${angleExpr})`;
			const centered = `(${uvExpr} - ${centerExpr})`;
			return `vec2(${cosExpr} * ${centered}.x - ${sinExpr} * ${centered}.y, ${sinExpr} * ${centered}.x + ${cosExpr} * ${centered}.y) + ${centerExpr}`;
		}
		case "texture-sample": {
			context.markNeed("texture");
			const texExpr = context.getInputExpression("tex", "texture");
			const fallbackUv = context.stage === "vertex" ? "a_uv" : "v_uv";
			const uvExpr = context.getInputExpression("uv", "vec2", fallbackUv);
			if (uvExpr === "v_uv" || uvExpr === "a_uv") {
				context.markNeed("uv");
			}
			return `texture2D(${texExpr}, ${uvExpr})`;
		}
		default:
			context.addError(
				`Texture/UV operation "${textureOp}" is not supported by GLSL export.`,
			);
			return context.defaultValueForPort(getOutputPortType(context));
	}
};

const compileOutputNode = (context: NodeCompileContext) => {
	context.addError(
		`Output node "${context.node.title.text}" cannot be used as a shader expression.`,
	);
	return context.defaultValueForPort(getOutputPortType(context));
};

const compileFallbackNode = (context: NodeCompileContext) => {
	context.addError(
		`Node "${context.node.title.text}" is not supported by GLSL export.`,
	);
	return context.defaultValueForPort(getOutputPortType(context));
};

const attachCompileHandlers = () => {
	const handlers: Record<string, (context: NodeCompileContext) => string> = {
		constants: compileConstantsNode,
		inputs: compileInputsNode,
		math: compileMathNode,
		vector: compileVectorNode,
		color: compileColorNode,
		logic: compileLogicNode,
		conversion: compileConversionNode,
		"texture-uv": compileTextureNode,
		output: compileOutputNode,
	};

	Object.entries(handlers).forEach(([typeId, compile]) => {
		const definition = getNodeDefinition(typeId);
		if (definition) {
			definition.compile = compile;
		}
	});
};

attachCompileHandlers();

export const compileGraphToGlsl = (
	nodes: Map<number, NodeView>,
	connections: Map<string, Connection>,
): ShaderCompileResult => {
	const messages: ShaderCompileMessage[] = [];
	const addError = (message: string) => {
		messages.push({ kind: "error", message });
	};
	const addWarning = (message: string) => {
		messages.push({ kind: "warning", message });
	};
	const needs = {
		uv: false,
		position: false,
		time: false,
		texture: false,
	};

	const glslTypeForPort = (type: PortType) => {
		switch (type) {
			case "float":
				return "float";
			case "int":
				return "int";
			case "vec2":
				return "vec2";
			case "vec3":
				return "vec3";
			case "vec4":
				return "vec4";
			case "texture":
				return "sampler2D";
			case "color":
				return "vec4";
		}
	};

	const defaultValueForPort = (type: PortType) => {
		switch (type) {
			case "float":
				return "0.0";
			case "int":
				return "0";
			case "vec2":
				return "vec2(0.0)";
			case "vec3":
				return "vec3(0.0)";
			case "vec4":
				return "vec4(0.0)";
			case "color":
				return "vec4(1.0)";
			case "texture":
				needs.texture = true;
				return "u_texture";
		}
	};

	const sanitizeName = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, "_");

	const inputConnections = new Map<string, Connection>();
	connections.forEach((connection) => {
		inputConnections.set(
			`${connection.to.nodeId}:${connection.to.portId}`,
			connection,
		);
	});

	type ShaderStage = "vertex" | "fragment";
	const usedNodes = new Set<number>();

	const createEmitter = (stage: ShaderStage) => {
		const outputVars = new Map<string, string>();
		const visiting = new Set<string>();
		const lines: string[] = [];
		const emitPortExpression = (ref: PortRef): string => {
			const key = `${ref.nodeId}:${ref.portId}`;
			const cached = outputVars.get(key);
			if (cached) {
				return cached;
			}

			if (visiting.has(key)) {
				addError(`Cycle detected involving node ${ref.nodeId}.`);
				const node = nodes.get(ref.nodeId);
				const port = node?.ports.find(
					(candidate) => candidate.id === ref.portId,
				);
				return port ? defaultValueForPort(port.type) : "0.0";
			}

			const node = nodes.get(ref.nodeId);
			if (!node) {
				addError(`Missing node ${ref.nodeId} for connection.`);
				return "0.0";
			}

			usedNodes.add(node.id);

			const port = node.ports.find((candidate) => candidate.id === ref.portId);
			if (!port || port.direction !== "output") {
				addError(`Missing output port ${ref.portId} on node ${ref.nodeId}.`);
				return port ? defaultValueForPort(port.type) : "0.0";
			}

			visiting.add(key);

			const varName = `n${node.id}_${sanitizeName(port.id)}`;
			const glslType = glslTypeForPort(port.type);
			const getInputExpression = (
				inputId: string,
				type: PortType,
				fallback?: string,
			) => {
				const connection = inputConnections.get(`${node.id}:${inputId}`);
				if (!connection) {
					return fallback ?? defaultValueForPort(type);
				}
				return emitPortExpression(connection.from);
			};

			const getInputPortType = (inputId: string, fallback: PortType) => {
				const inputPort = node.ports.find(
					(candidate) => candidate.id === inputId,
				);
				return inputPort?.type ?? fallback;
			};

			const typeId = node.typeId;
			const defaultState = typeId
				? (getDefaultNodeState(typeId) ?? { version: 1, params: {} })
				: { version: 1, params: {} };
			const normalizedState =
				typeId && node.state
					? (normalizeNodeState(typeId, node.state) ?? node.state)
					: (node.state ?? defaultState);
			const context: NodeCompileContext = {
				node,
				state: normalizedState ?? { version: 1, params: {} },
				portId: port.id,
				stage,
				getInputExpression,
				getInputPortType,
				defaultValueForPort,
				addWarning,
				addError,
				markNeed: (need) => {
					needs[need] = true;
				},
			};

			let expression: string | null = null;
			if (!typeId) {
				addError(`Node "${node.title.text}" is missing a type id.`);
				expression = defaultValueForPort(port.type);
			} else {
				const definition = getNodeDefinition(typeId);
				expression = definition?.compile
					? definition.compile(context)
					: compileFallbackNode(context);
			}
			if (!expression) {
				expression = compileFallbackNode(context);
			}

			lines.push(`${glslType} ${varName} = ${expression};`);
			outputVars.set(key, varName);
			visiting.delete(key);
			return varName;
		};

		return { lines, emitPortExpression };
	};

	const fragmentEmitter = createEmitter("fragment");
	const vertexEmitter = createEmitter("vertex");

	const getNormalizedState = (node: NodeView): NodeState | null => {
		if (!node.typeId) {
			return node.state ?? null;
		}
		const defaultState = getDefaultNodeState(node.typeId) ?? {
			version: 1,
			params: {},
		};
		return (
			normalizeNodeState(node.typeId, node.state ?? defaultState) ??
			node.state ??
			defaultState
		);
	};

	const fragmentNodes = Array.from(nodes.values()).filter((node) => {
		if (node.typeId !== "output") {
			return false;
		}
		const state = getNormalizedState(node);
		return (
			getParamString(
				state ?? { version: 1, params: {} },
				"stage",
				"fragment",
			) === "fragment"
		);
	});

	if (fragmentNodes.length === 0) {
		addError("No Fragment Output node found.");
	} else if (fragmentNodes.length > 1) {
		addWarning("Multiple Fragment Output nodes found. Using the first.");
	}

	const fragmentNode = fragmentNodes[0];
	const fragmentColorPort = fragmentNode?.ports.find(
		(port) => port.direction === "input",
	);
	let fragmentOutput = "vec4(0.0)";
	if (fragmentNode && fragmentColorPort) {
		const connection = inputConnections.get(
			`${fragmentNode.id}:${fragmentColorPort.id}`,
		);
		if (!connection) {
			addWarning("Fragment Output input is unconnected.");
			fragmentOutput = defaultValueForPort(fragmentColorPort.type);
		} else {
			fragmentOutput = fragmentEmitter.emitPortExpression(connection.from);
		}
	}

	const vertexNodes = Array.from(nodes.values()).filter((node) => {
		if (node.typeId !== "output") {
			return false;
		}
		const state = getNormalizedState(node);
		return (
			getParamString(
				state ?? { version: 1, params: {} },
				"stage",
				"fragment",
			) === "vertex"
		);
	});

	if (vertexNodes.length === 0) {
		addWarning("No Vertex Output node found. Using default vertex position.");
	} else if (vertexNodes.length > 1) {
		addWarning("Multiple Vertex Output nodes found. Using the first.");
	}

	const vertexNode = vertexNodes[0];
	const vertexPositionPort = vertexNode?.ports.find(
		(port) => port.direction === "input",
	);
	let vertexPositionExpr = "vec3(a_position, 0.0)";
	let vertexPositionType: PortType = "vec3";

	if (vertexNode && vertexPositionPort) {
		vertexPositionType = vertexPositionPort.type;
		const connection = inputConnections.get(
			`${vertexNode.id}:${vertexPositionPort.id}`,
		);
		if (connection) {
			vertexPositionExpr = vertexEmitter.emitPortExpression(connection.from);
		} else {
			addWarning("Vertex Output input is unconnected.");
		}
	} else if (vertexNode) {
		addWarning(
			`Vertex Output node "${vertexNode.title.text}" is missing input.`,
		);
	}

	usedNodes.forEach((nodeId) => {
		const node = nodes.get(nodeId);
		if (!node) {
			return;
		}
		if (node.typeId === "output") {
			return;
		}
		node.ports.forEach((port) => {
			if (port.direction !== "input") {
				return;
			}
			const key = `${node.id}:${port.id}`;
			if (inputConnections.has(key)) {
				return;
			}
			addWarning(
				`Input "${port.name}" on node "${node.title.text}" is unconnected.`,
			);
		});
	});

	const vertexLines = ["attribute vec2 a_position;"];
	if (needs.uv) {
		vertexLines.push("attribute vec2 a_uv;");
		vertexLines.push("varying vec2 v_uv;");
	}
	if (needs.position) {
		vertexLines.push("varying vec3 v_position;");
	}
	if (needs.time) {
		vertexLines.push("uniform float u_time;");
	}
	if (needs.texture) {
		vertexLines.push("uniform sampler2D u_texture;");
	}
	vertexLines.push("void main() {");
	if (needs.uv) {
		vertexLines.push("\tv_uv = a_uv;");
	}
	if (needs.position) {
		vertexLines.push("\tv_position = vec3(a_position, 0.0);");
	}
	vertexEmitter.lines.forEach((line) => {
		vertexLines.push(`\t${line}`);
	});

	const formatVertexPosition = (expression: string, type: PortType) => {
		switch (type) {
			case "vec4":
			case "color":
				return expression;
			case "vec3":
				return `vec4(${expression}, 1.0)`;
			case "vec2":
				return `vec4(${expression}, 0.0, 1.0)`;
			case "float":
				return `vec4(vec2(${expression}), 0.0, 1.0)`;
			case "int":
				return `vec4(vec2(float(${expression})), 0.0, 1.0)`;
			case "texture":
				return "vec4(0.0, 0.0, 0.0, 1.0)";
		}
	};

	const glPosition =
		vertexNode && vertexPositionPort
			? formatVertexPosition(vertexPositionExpr, vertexPositionType)
			: "vec4(a_position, 0.0, 1.0)";

	vertexLines.push(`\tgl_Position = ${glPosition};`);
	vertexLines.push("}");

	const fragmentLines = ["precision mediump float;"];
	if (needs.uv) {
		fragmentLines.push("varying vec2 v_uv;");
	}
	if (needs.position) {
		fragmentLines.push("varying vec3 v_position;");
	}
	if (needs.time) {
		fragmentLines.push("uniform float u_time;");
	}
	if (needs.texture) {
		fragmentLines.push("uniform sampler2D u_texture;");
	}
	fragmentLines.push("void main() {");
	fragmentEmitter.lines.forEach((line) => {
		fragmentLines.push(`\t${line}`);
	});
	fragmentLines.push(`\tgl_FragColor = ${fragmentOutput};`);
	fragmentLines.push("}");

	return {
		vertexSource: `${vertexLines.join("\n")}\n`,
		fragmentSource: `${fragmentLines.join("\n")}\n`,
		messages,
		hasFragmentOutput: Boolean(fragmentNode && fragmentColorPort),
		nodeCount: nodes.size,
		connectionCount: connections.size,
	};
};
