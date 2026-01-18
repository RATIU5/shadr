import type { Container, Graphics, Text } from "pixi.js";
import { describe, expect, it } from "vitest";
import { compileGraphToGlsl } from "../shader";
import type {
	Connection,
	NodeParamValue,
	NodePort,
	NodeSocketValue,
	NodeView,
	PortDirection,
	PortType,
} from "../types";

const createPort = (
	id: string,
	name: string,
	type: PortType,
	direction: PortDirection,
): NodePort => ({
	id,
	name,
	type,
	direction,
	directionIndex: 0,
	graphics: {} as Graphics,
	hitGraphics: {} as Graphics,
	label: {} as Text,
	isHover: false,
	isDragTarget: false,
	isDragValid: false,
});

const createNode = (
	id: number,
	title: string,
	typeId: string,
	ports: NodePort[],
): NodeView => ({
	id,
	title: { text: title } as Text,
	ports,
	container: {} as Container,
	hitGraphics: {} as Graphics,
	background: {} as Graphics,
	width: 0,
	height: 0,
	isHover: false,
	typeId,
});

const applyLegacyData = (node: NodeView, data: Record<string, unknown>) => {
	const params: Record<string, NodeParamValue> = {};
	const socketValues: Record<string, NodeSocketValue> = {};

	if (typeof data.constType === "string") {
		params.type = data.constType;
		if (typeof data.value === "number" && Number.isFinite(data.value)) {
			socketValues.out = data.value;
		}
		const vector = data.vector;
		if (vector && typeof vector === "object") {
			const record = vector as Record<string, unknown>;
			const x = typeof record.x === "number" ? record.x : 0;
			const y = typeof record.y === "number" ? record.y : 0;
			const z = typeof record.z === "number" ? record.z : undefined;
			const w = typeof record.w === "number" ? record.w : undefined;
			socketValues.out = {
				x,
				y,
				...(z !== undefined ? { z } : {}),
				...(w !== undefined ? { w } : {}),
			};
		}
		const color = data.color;
		if (color && typeof color === "object") {
			const record = color as Record<string, unknown>;
			if (
				typeof record.r === "number" &&
				typeof record.g === "number" &&
				typeof record.b === "number" &&
				typeof record.a === "number"
			) {
				socketValues.out = {
					r: record.r,
					g: record.g,
					b: record.b,
					a: record.a,
				};
			}
		}
	}

	if (typeof data.inputType === "string") {
		params.type = data.inputType;
		if (typeof data.inputValue === "number") {
			socketValues.out = data.inputValue;
		}
		if (typeof data.inputChecked === "boolean") {
			socketValues.out = data.inputChecked;
		}
		if (typeof data.inputText === "string") {
			socketValues.out = data.inputText;
		}
		const color = data.inputColor;
		if (color && typeof color === "object") {
			const record = color as Record<string, unknown>;
			if (
				typeof record.r === "number" &&
				typeof record.g === "number" &&
				typeof record.b === "number" &&
				typeof record.a === "number"
			) {
				socketValues.out = {
					r: record.r,
					g: record.g,
					b: record.b,
					a: record.a,
				};
			}
		}
		if (Array.isArray(data.inputOptions)) {
			const options = data.inputOptions.filter(
				(option): option is string => typeof option === "string",
			);
			if (options.length > 0) {
				params.options = options.join(", ");
				if (
					typeof data.inputSelection === "string" &&
					options.includes(data.inputSelection)
				) {
					socketValues.out = data.inputSelection;
				} else {
					socketValues.out = options[0];
				}
			}
		}
	}

	if (typeof data.mathOp === "string") {
		params.operation = data.mathOp;
	}
	if (typeof data.mathType === "string") {
		params.type = data.mathType;
	}

	if (typeof data.vectorOp === "string") {
		params.operation = data.vectorOp;
	}
	if (typeof data.vectorType === "string") {
		params.type = data.vectorType;
	}
	if (typeof data.component === "string") {
		params.component = data.component;
	}

	if (typeof data.colorOp === "string") {
		params.operation = data.colorOp;
	}
	if (typeof data.conversionOp === "string") {
		params.operation = data.conversionOp;
	}
	if (typeof data.logicOp === "string") {
		params.operation = data.logicOp;
	}
	if (typeof data.textureOp === "string") {
		params.operation = data.textureOp;
	}
	if (typeof data.outputType === "string") {
		params.stage = data.outputType;
	}

	node.state = {
		version: 1,
		params,
	};
	if (Object.keys(socketValues).length > 0) {
		node.socketValues = socketValues;
	}
};

const createConnection = (
	id: string,
	fromNodeId: number,
	fromPortId: string,
	toNodeId: number,
	toPortId: string,
	type: PortType,
): Connection => ({
	id,
	from: { nodeId: fromNodeId, portId: fromPortId },
	to: { nodeId: toNodeId, portId: toPortId },
	type,
});

describe("shader compilation", () => {
	it("compiles a fragment shader with a constant color input", () => {
		const colorNode = createNode(1, "Constant Color", "constants", [
			createPort("out", "Color", "color", "output"),
		]);
		applyLegacyData(colorNode, {
			constType: "color",
			color: { r: 0.2, g: 0.4, b: 0.6, a: 1 },
		});

		const fragmentNode = createNode(2, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[colorNode.id, colorNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"1-2",
				createConnection(
					"1-2",
					colorNode.id,
					"out",
					fragmentNode.id,
					"color",
					"color",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.fragmentSource).toContain("vec4 n1_out = vec4(");
		expect(result.fragmentSource).toContain("gl_FragColor = n1_out;");
	});

	it("compiles a fragment shader with an input color node", () => {
		const inputNode = createNode(10, "Input Color", "inputs", [
			createPort("out", "Color", "color", "output"),
		]);
		applyLegacyData(inputNode, {
			inputType: "color",
			inputColor: { r: 0.25, g: 0.5, b: 0.75, a: 1 },
		});

		const fragmentNode = createNode(11, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[inputNode.id, inputNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"10-11",
				createConnection(
					"10-11",
					inputNode.id,
					"out",
					fragmentNode.id,
					"color",
					"color",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.fragmentSource).toContain(
			"vec4 n10_out = vec4(0.25, 0.5, 0.75, 1.0);",
		);
		expect(result.fragmentSource).toContain("gl_FragColor = n10_out;");
	});

	it("warns when fragment output is unconnected", () => {
		const fragmentNode = createNode(3, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([[fragmentNode.id, fragmentNode]]);
		const result = compileGraphToGlsl(nodes, new Map());

		expect(result.hasFragmentOutput).toBe(true);
		expect(
			result.messages.some(
				(message) =>
					message.kind === "warning" &&
					message.message === "Fragment Output input is unconnected.",
			),
		).toBe(true);
	});

	it("compiles a component extraction node into a vec4 swizzle", () => {
		const vecNode = createNode(11, "Constant Vec4", "constants", [
			createPort("out", "Value", "vec4", "output"),
		]);
		applyLegacyData(vecNode, {
			constType: "vec4",
			vector: { x: 0.1, y: 0.2, z: 0.3, w: 0.4 },
		});

		const componentNode = createNode(12, "Component", "vector", [
			createPort("in", "Vector", "vec4", "input"),
			createPort("out", "Out", "vec4", "output"),
		]);
		applyLegacyData(componentNode, { vectorOp: "component", component: "y" });

		const fragmentNode = createNode(13, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[vecNode.id, vecNode],
			[componentNode.id, componentNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"11-12",
				createConnection(
					"11-12",
					vecNode.id,
					"out",
					componentNode.id,
					"in",
					"vec4",
				),
			],
			[
				"12-13",
				createConnection(
					"12-13",
					componentNode.id,
					"out",
					fragmentNode.id,
					"color",
					"vec4",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.fragmentSource).toContain(
			"vec4 n12_out = vec4((n11_out).y);",
		);
		expect(result.fragmentSource).toContain("gl_FragColor = n12_out;");
	});

	it("compiles texture sampling with UV and texture inputs", () => {
		const uvNode = createNode(30, "Input UV", "texture-uv", [
			createPort("out", "UV", "vec2", "output"),
		]);
		applyLegacyData(uvNode, { textureOp: "uv-input" });

		const textureNode = createNode(31, "Input Texture", "texture-uv", [
			createPort("out", "Texture", "texture", "output"),
		]);
		applyLegacyData(textureNode, { textureOp: "texture-input" });

		const sampleNode = createNode(32, "Texture Sample", "texture-uv", [
			createPort("tex", "Texture", "texture", "input"),
			createPort("uv", "UV", "vec2", "input"),
			createPort("out", "Color", "vec4", "output"),
		]);
		applyLegacyData(sampleNode, { textureOp: "texture-sample" });

		const fragmentNode = createNode(33, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[uvNode.id, uvNode],
			[textureNode.id, textureNode],
			[sampleNode.id, sampleNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"30-32-uv",
				createConnection(
					"30-32-uv",
					uvNode.id,
					"out",
					sampleNode.id,
					"uv",
					"vec2",
				),
			],
			[
				"31-32-tex",
				createConnection(
					"31-32-tex",
					textureNode.id,
					"out",
					sampleNode.id,
					"tex",
					"texture",
				),
			],
			[
				"32-33",
				createConnection(
					"32-33",
					sampleNode.id,
					"out",
					fragmentNode.id,
					"color",
					"vec4",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.vertexSource).toContain("attribute vec2 a_uv;");
		expect(result.vertexSource).toContain("varying vec2 v_uv;");
		expect(result.vertexSource).toContain("v_uv = a_uv;");
		expect(result.fragmentSource).toContain("uniform sampler2D u_texture;");
		expect(result.fragmentSource).toContain("varying vec2 v_uv;");
		expect(result.fragmentSource).toContain("texture2D");
	});

	it("emits a time uniform when the time input is used", () => {
		const timeNode = createNode(34, "Input Time", "texture-uv", [
			createPort("out", "Time", "float", "output"),
		]);
		applyLegacyData(timeNode, { textureOp: "time-input" });

		const yNode = createNode(35, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(yNode, { constType: "float", value: 0.2 });

		const zNode = createNode(36, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(zNode, { constType: "float", value: 0.4 });

		const wNode = createNode(37, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(wNode, { constType: "float", value: 0.8 });

		const composeNode = createNode(38, "Compose", "vector", [
			createPort("x", "X", "float", "input"),
			createPort("y", "Y", "float", "input"),
			createPort("z", "Z", "float", "input"),
			createPort("w", "W", "float", "input"),
			createPort("out", "Out", "vec4", "output"),
		]);
		applyLegacyData(composeNode, { vectorOp: "compose", vectorType: "vec4" });

		const fragmentNode = createNode(39, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[timeNode.id, timeNode],
			[yNode.id, yNode],
			[zNode.id, zNode],
			[wNode.id, wNode],
			[composeNode.id, composeNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"34-38-x",
				createConnection(
					"34-38-x",
					timeNode.id,
					"out",
					composeNode.id,
					"x",
					"float",
				),
			],
			[
				"35-38-y",
				createConnection(
					"35-38-y",
					yNode.id,
					"out",
					composeNode.id,
					"y",
					"float",
				),
			],
			[
				"36-38-z",
				createConnection(
					"36-38-z",
					zNode.id,
					"out",
					composeNode.id,
					"z",
					"float",
				),
			],
			[
				"37-38-w",
				createConnection(
					"37-38-w",
					wNode.id,
					"out",
					composeNode.id,
					"w",
					"float",
				),
			],
			[
				"38-39",
				createConnection(
					"38-39",
					composeNode.id,
					"out",
					fragmentNode.id,
					"color",
					"vec4",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages.some((message) => message.kind === "error")).toBe(
			false,
		);
		expect(result.vertexSource).toContain("uniform float u_time;");
		expect(result.fragmentSource).toContain("uniform float u_time;");
		expect(result.fragmentSource).toContain("u_time");
	});

	it("errors when no fragment output exists", () => {
		const result = compileGraphToGlsl(new Map(), new Map());

		expect(result.hasFragmentOutput).toBe(false);
		expect(
			result.messages.some(
				(message) =>
					message.kind === "error" &&
					message.message === "No Fragment Output node found.",
			),
		).toBe(true);
	});

	it("warns when no vertex output exists", () => {
		const fragmentNode = createNode(9, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([[fragmentNode.id, fragmentNode]]);
		const result = compileGraphToGlsl(nodes, new Map());

		expect(
			result.messages.some(
				(message) =>
					message.kind === "warning" &&
					message.message ===
						"No Vertex Output node found. Using default vertex position.",
			),
		).toBe(true);
	});

	it("warns when vertex output input is unconnected", () => {
		const colorNode = createNode(60, "Constant Color", "constants", [
			createPort("out", "Color", "color", "output"),
		]);
		applyLegacyData(colorNode, {
			constType: "color",
			color: { r: 0.8, g: 0.1, b: 0.2, a: 1 },
		});

		const fragmentNode = createNode(61, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const vertexNode = createNode(62, "Vertex Output", "output", [
			createPort("position", "Position", "vec3", "input"),
		]);
		applyLegacyData(vertexNode, { outputType: "vertex" });

		const nodes = new Map<number, NodeView>([
			[colorNode.id, colorNode],
			[fragmentNode.id, fragmentNode],
			[vertexNode.id, vertexNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"60-61",
				createConnection(
					"60-61",
					colorNode.id,
					"out",
					fragmentNode.id,
					"color",
					"color",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(
			result.messages.some(
				(message) =>
					message.kind === "warning" &&
					message.message === "Vertex Output input is unconnected.",
			),
		).toBe(true);
	});

	it("compiles a vertex shader with a connected vertex output", () => {
		const positionNode = createNode(4, "Constant Vec3", "constants", [
			createPort("out", "Value", "vec3", "output"),
		]);
		applyLegacyData(positionNode, {
			constType: "vec3",
			vector: { x: 1, y: 2, z: 3 },
		});

		const vertexNode = createNode(5, "Vertex Output", "output", [
			createPort("position", "Position", "vec3", "input"),
		]);
		applyLegacyData(vertexNode, { outputType: "vertex" });

		const colorNode = createNode(6, "Constant Color", "constants", [
			createPort("out", "Color", "color", "output"),
		]);
		applyLegacyData(colorNode, {
			constType: "color",
			color: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
		});

		const fragmentNode = createNode(7, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[positionNode.id, positionNode],
			[vertexNode.id, vertexNode],
			[colorNode.id, colorNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"4-5",
				createConnection(
					"4-5",
					positionNode.id,
					"out",
					vertexNode.id,
					"position",
					"vec3",
				),
			],
			[
				"6-7",
				createConnection(
					"6-7",
					colorNode.id,
					"out",
					fragmentNode.id,
					"color",
					"color",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.vertexSource).toContain("gl_Position = vec4(n4_out, 1.0);");
		expect(result.fragmentSource).toContain("gl_FragColor = n6_out;");
	});

	it("compiles vec4-to-vec3 conversion for vertex output", () => {
		const vecNode = createNode(40, "Constant Vec4", "constants", [
			createPort("out", "Value", "vec4", "output"),
		]);
		applyLegacyData(vecNode, {
			constType: "vec4",
			vector: { x: 0.1, y: 0.2, z: 0.3, w: 1 },
		});

		const conversionNode = createNode(41, "Vec4 to Vec3", "conversion", [
			createPort("in", "In", "vec4", "input"),
			createPort("out", "Out", "vec3", "output"),
		]);
		applyLegacyData(conversionNode, { conversionOp: "vec4-to-vec3" });

		const vertexNode = createNode(42, "Vertex Output", "output", [
			createPort("position", "Position", "vec3", "input"),
		]);
		applyLegacyData(vertexNode, { outputType: "vertex" });

		const colorNode = createNode(43, "Constant Color", "constants", [
			createPort("out", "Color", "color", "output"),
		]);
		applyLegacyData(colorNode, {
			constType: "color",
			color: { r: 0.2, g: 0.3, b: 0.4, a: 1 },
		});

		const fragmentNode = createNode(44, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[vecNode.id, vecNode],
			[conversionNode.id, conversionNode],
			[vertexNode.id, vertexNode],
			[colorNode.id, colorNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"40-41",
				createConnection(
					"40-41",
					vecNode.id,
					"out",
					conversionNode.id,
					"in",
					"vec4",
				),
			],
			[
				"41-42",
				createConnection(
					"41-42",
					conversionNode.id,
					"out",
					vertexNode.id,
					"position",
					"vec3",
				),
			],
			[
				"43-44",
				createConnection(
					"43-44",
					colorNode.id,
					"out",
					fragmentNode.id,
					"color",
					"color",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.vertexSource).toContain(".xyz;");
		expect(result.vertexSource).toContain("gl_Position = vec4(");
	});

	it("compiles dot and length vector operations", () => {
		const vecA = createNode(50, "Constant Vec3", "constants", [
			createPort("out", "Value", "vec3", "output"),
		]);
		applyLegacyData(vecA, {
			constType: "vec3",
			vector: { x: 0.1, y: 0.2, z: 0.3 },
		});

		const vecB = createNode(51, "Constant Vec3", "constants", [
			createPort("out", "Value", "vec3", "output"),
		]);
		applyLegacyData(vecB, {
			constType: "vec3",
			vector: { x: 0.4, y: 0.5, z: 0.6 },
		});

		const dotNode = createNode(52, "Dot", "vector", [
			createPort("a", "A", "vec3", "input"),
			createPort("b", "B", "vec3", "input"),
			createPort("out", "Out", "float", "output"),
		]);
		applyLegacyData(dotNode, { vectorOp: "dot", vectorType: "vec3" });

		const lengthNode = createNode(53, "Length", "vector", [
			createPort("in", "In", "vec3", "input"),
			createPort("out", "Out", "float", "output"),
		]);
		applyLegacyData(lengthNode, { vectorOp: "length", vectorType: "vec3" });

		const composeNode = createNode(54, "Compose", "vector", [
			createPort("x", "X", "float", "input"),
			createPort("y", "Y", "float", "input"),
			createPort("z", "Z", "float", "input"),
			createPort("w", "W", "float", "input"),
			createPort("out", "Out", "vec4", "output"),
		]);
		applyLegacyData(composeNode, { vectorOp: "compose", vectorType: "vec4" });

		const fragmentNode = createNode(55, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[vecA.id, vecA],
			[vecB.id, vecB],
			[dotNode.id, dotNode],
			[lengthNode.id, lengthNode],
			[composeNode.id, composeNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"50-52-a",
				createConnection("50-52-a", vecA.id, "out", dotNode.id, "a", "vec3"),
			],
			[
				"51-52-b",
				createConnection("51-52-b", vecB.id, "out", dotNode.id, "b", "vec3"),
			],
			[
				"50-53",
				createConnection("50-53", vecA.id, "out", lengthNode.id, "in", "vec3"),
			],
			[
				"52-54-x",
				createConnection(
					"52-54-x",
					dotNode.id,
					"out",
					composeNode.id,
					"x",
					"float",
				),
			],
			[
				"53-54-y",
				createConnection(
					"53-54-y",
					lengthNode.id,
					"out",
					composeNode.id,
					"y",
					"float",
				),
			],
			[
				"52-54-z",
				createConnection(
					"52-54-z",
					dotNode.id,
					"out",
					composeNode.id,
					"z",
					"float",
				),
			],
			[
				"53-54-w",
				createConnection(
					"53-54-w",
					lengthNode.id,
					"out",
					composeNode.id,
					"w",
					"float",
				),
			],
			[
				"54-55",
				createConnection(
					"54-55",
					composeNode.id,
					"out",
					fragmentNode.id,
					"color",
					"vec4",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.fragmentSource).toContain("dot(");
		expect(result.fragmentSource).toContain("length(");
		expect(result.fragmentSource).toContain("gl_FragColor = n54_out;");
	});

	it("compiles cross, normalize, reflect, and refract vector operations", () => {
		const vecA = createNode(60, "Constant Vec3", "constants", [
			createPort("out", "Value", "vec3", "output"),
		]);
		applyLegacyData(vecA, {
			constType: "vec3",
			vector: { x: 0.2, y: 0.1, z: 0.3 },
		});

		const vecB = createNode(61, "Constant Vec3", "constants", [
			createPort("out", "Value", "vec3", "output"),
		]);
		applyLegacyData(vecB, {
			constType: "vec3",
			vector: { x: 0.7, y: 0.2, z: 0.1 },
		});

		const etaNode = createNode(62, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(etaNode, { constType: "float", value: 0.9 });

		const crossNode = createNode(63, "Cross", "vector", [
			createPort("a", "A", "vec3", "input"),
			createPort("b", "B", "vec3", "input"),
			createPort("out", "Out", "vec3", "output"),
		]);
		applyLegacyData(crossNode, { vectorOp: "cross", vectorType: "vec3" });

		const normalizeNode = createNode(64, "Normalize", "vector", [
			createPort("in", "In", "vec3", "input"),
			createPort("out", "Out", "vec3", "output"),
		]);
		applyLegacyData(normalizeNode, {
			vectorOp: "normalize",
			vectorType: "vec3",
		});

		const reflectNode = createNode(65, "Reflect", "vector", [
			createPort("i", "I", "vec3", "input"),
			createPort("n", "N", "vec3", "input"),
			createPort("out", "Out", "vec3", "output"),
		]);
		applyLegacyData(reflectNode, { vectorOp: "reflect", vectorType: "vec3" });

		const refractNode = createNode(66, "Refract", "vector", [
			createPort("i", "I", "vec3", "input"),
			createPort("n", "N", "vec3", "input"),
			createPort("eta", "Eta", "float", "input"),
			createPort("out", "Out", "vec3", "output"),
		]);
		applyLegacyData(refractNode, { vectorOp: "refract", vectorType: "vec3" });

		const conversionNode = createNode(67, "Vec3 to Vec4", "conversion", [
			createPort("in", "In", "vec3", "input"),
			createPort("out", "Out", "vec4", "output"),
		]);
		applyLegacyData(conversionNode, { conversionOp: "vec3-to-vec4" });

		const fragmentNode = createNode(68, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[vecA.id, vecA],
			[vecB.id, vecB],
			[etaNode.id, etaNode],
			[crossNode.id, crossNode],
			[normalizeNode.id, normalizeNode],
			[reflectNode.id, reflectNode],
			[refractNode.id, refractNode],
			[conversionNode.id, conversionNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"60-63-a",
				createConnection("60-63-a", vecA.id, "out", crossNode.id, "a", "vec3"),
			],
			[
				"61-63-b",
				createConnection("61-63-b", vecB.id, "out", crossNode.id, "b", "vec3"),
			],
			[
				"63-64",
				createConnection(
					"63-64",
					crossNode.id,
					"out",
					normalizeNode.id,
					"in",
					"vec3",
				),
			],
			[
				"64-65-i",
				createConnection(
					"64-65-i",
					normalizeNode.id,
					"out",
					reflectNode.id,
					"i",
					"vec3",
				),
			],
			[
				"61-65-n",
				createConnection(
					"61-65-n",
					vecB.id,
					"out",
					reflectNode.id,
					"n",
					"vec3",
				),
			],
			[
				"65-66-i",
				createConnection(
					"65-66-i",
					reflectNode.id,
					"out",
					refractNode.id,
					"i",
					"vec3",
				),
			],
			[
				"61-66-n",
				createConnection(
					"61-66-n",
					vecB.id,
					"out",
					refractNode.id,
					"n",
					"vec3",
				),
			],
			[
				"62-66-eta",
				createConnection(
					"62-66-eta",
					etaNode.id,
					"out",
					refractNode.id,
					"eta",
					"float",
				),
			],
			[
				"66-67",
				createConnection(
					"66-67",
					refractNode.id,
					"out",
					conversionNode.id,
					"in",
					"vec3",
				),
			],
			[
				"67-68",
				createConnection(
					"67-68",
					conversionNode.id,
					"out",
					fragmentNode.id,
					"color",
					"vec4",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.fragmentSource).toContain("cross(");
		expect(result.fragmentSource).toContain("normalize(");
		expect(result.fragmentSource).toContain("reflect(");
		expect(result.fragmentSource).toContain("refract(");
		expect(result.fragmentSource).toContain("gl_FragColor = n67_out;");
	});

	it("compiles logic and/or/not operations", () => {
		const floatA = createNode(70, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(floatA, { constType: "float", value: 0.2 });

		const floatB = createNode(71, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(floatB, { constType: "float", value: 0.8 });

		const floatC = createNode(72, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(floatC, { constType: "float", value: 0.4 });

		const logicAnd = createNode(73, "Logic", "logic", [
			createPort("a", "A", "float", "input"),
			createPort("b", "B", "float", "input"),
			createPort("out", "Out", "float", "output"),
		]);
		applyLegacyData(logicAnd, { logicOp: "and" });

		const logicOr = createNode(74, "Logic", "logic", [
			createPort("a", "A", "float", "input"),
			createPort("b", "B", "float", "input"),
			createPort("out", "Out", "float", "output"),
		]);
		applyLegacyData(logicOr, { logicOp: "or" });

		const logicNot = createNode(75, "Logic", "logic", [
			createPort("in", "In", "float", "input"),
			createPort("out", "Out", "float", "output"),
		]);
		applyLegacyData(logicNot, { logicOp: "not" });

		const composeNode = createNode(76, "Compose", "vector", [
			createPort("x", "X", "float", "input"),
			createPort("y", "Y", "float", "input"),
			createPort("z", "Z", "float", "input"),
			createPort("w", "W", "float", "input"),
			createPort("out", "Out", "vec4", "output"),
		]);
		applyLegacyData(composeNode, { vectorOp: "compose", vectorType: "vec4" });

		const fragmentNode = createNode(77, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[floatA.id, floatA],
			[floatB.id, floatB],
			[floatC.id, floatC],
			[logicAnd.id, logicAnd],
			[logicOr.id, logicOr],
			[logicNot.id, logicNot],
			[composeNode.id, composeNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"70-73-a",
				createConnection(
					"70-73-a",
					floatA.id,
					"out",
					logicAnd.id,
					"a",
					"float",
				),
			],
			[
				"71-73-b",
				createConnection(
					"71-73-b",
					floatB.id,
					"out",
					logicAnd.id,
					"b",
					"float",
				),
			],
			[
				"70-74-a",
				createConnection("70-74-a", floatA.id, "out", logicOr.id, "a", "float"),
			],
			[
				"71-74-b",
				createConnection("71-74-b", floatB.id, "out", logicOr.id, "b", "float"),
			],
			[
				"72-75",
				createConnection("72-75", floatC.id, "out", logicNot.id, "in", "float"),
			],
			[
				"73-76-x",
				createConnection(
					"73-76-x",
					logicAnd.id,
					"out",
					composeNode.id,
					"x",
					"float",
				),
			],
			[
				"74-76-y",
				createConnection(
					"74-76-y",
					logicOr.id,
					"out",
					composeNode.id,
					"y",
					"float",
				),
			],
			[
				"75-76-z",
				createConnection(
					"75-76-z",
					logicNot.id,
					"out",
					composeNode.id,
					"z",
					"float",
				),
			],
			[
				"70-76-w",
				createConnection(
					"70-76-w",
					floatA.id,
					"out",
					composeNode.id,
					"w",
					"float",
				),
			],
			[
				"76-77",
				createConnection(
					"76-77",
					composeNode.id,
					"out",
					fragmentNode.id,
					"color",
					"vec4",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.fragmentSource).toContain("step(0.5");
		expect(result.fragmentSource).toContain("1.0 - step(0.5");
		expect(result.fragmentSource).toContain("max(");
	});

	it("compiles logic select operations for float and vec3", () => {
		const floatA = createNode(80, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(floatA, { constType: "float", value: 0.2 });

		const floatB = createNode(81, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(floatB, { constType: "float", value: 0.9 });

		const condNode = createNode(82, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(condNode, { constType: "float", value: 0.6 });

		const vecA = createNode(83, "Constant Vec3", "constants", [
			createPort("out", "Value", "vec3", "output"),
		]);
		applyLegacyData(vecA, {
			constType: "vec3",
			vector: { x: 0.1, y: 0.2, z: 0.3 },
		});

		const vecB = createNode(84, "Constant Vec3", "constants", [
			createPort("out", "Value", "vec3", "output"),
		]);
		applyLegacyData(vecB, {
			constType: "vec3",
			vector: { x: 0.7, y: 0.5, z: 0.4 },
		});

		const selectFloat = createNode(85, "Logic", "logic", [
			createPort("a", "A", "float", "input"),
			createPort("b", "B", "float", "input"),
			createPort("cond", "Condition", "float", "input"),
			createPort("out", "Out", "float", "output"),
		]);
		applyLegacyData(selectFloat, { logicOp: "select" });

		const selectVec3 = createNode(86, "Logic", "logic", [
			createPort("a", "A", "vec3", "input"),
			createPort("b", "B", "vec3", "input"),
			createPort("cond", "Condition", "float", "input"),
			createPort("out", "Out", "vec3", "output"),
		]);
		applyLegacyData(selectVec3, { logicOp: "select-vec3" });

		const conversionNode = createNode(87, "Vec3 to Vec4", "conversion", [
			createPort("in", "In", "vec3", "input"),
			createPort("w", "W", "float", "input"),
			createPort("out", "Out", "vec4", "output"),
		]);
		applyLegacyData(conversionNode, { conversionOp: "vec3-to-vec4" });

		const fragmentNode = createNode(88, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[floatA.id, floatA],
			[floatB.id, floatB],
			[condNode.id, condNode],
			[vecA.id, vecA],
			[vecB.id, vecB],
			[selectFloat.id, selectFloat],
			[selectVec3.id, selectVec3],
			[conversionNode.id, conversionNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"80-85-a",
				createConnection(
					"80-85-a",
					floatA.id,
					"out",
					selectFloat.id,
					"a",
					"float",
				),
			],
			[
				"81-85-b",
				createConnection(
					"81-85-b",
					floatB.id,
					"out",
					selectFloat.id,
					"b",
					"float",
				),
			],
			[
				"82-85-cond",
				createConnection(
					"82-85-cond",
					condNode.id,
					"out",
					selectFloat.id,
					"cond",
					"float",
				),
			],
			[
				"83-86-a",
				createConnection("83-86-a", vecA.id, "out", selectVec3.id, "a", "vec3"),
			],
			[
				"84-86-b",
				createConnection("84-86-b", vecB.id, "out", selectVec3.id, "b", "vec3"),
			],
			[
				"82-86-cond",
				createConnection(
					"82-86-cond",
					condNode.id,
					"out",
					selectVec3.id,
					"cond",
					"float",
				),
			],
			[
				"86-87",
				createConnection(
					"86-87",
					selectVec3.id,
					"out",
					conversionNode.id,
					"in",
					"vec3",
				),
			],
			[
				"85-87-w",
				createConnection(
					"85-87-w",
					selectFloat.id,
					"out",
					conversionNode.id,
					"w",
					"float",
				),
			],
			[
				"87-88",
				createConnection(
					"87-88",
					conversionNode.id,
					"out",
					fragmentNode.id,
					"color",
					"vec4",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.fragmentSource).toContain("mix(");
		expect(result.fragmentSource).toContain("clamp(");
	});

	it("compiles conversion nodes for scalar and vector types", () => {
		const floatNode = createNode(100, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(floatNode, { constType: "float", value: 2.9 });

		const floatToIntNode = createNode(101, "Float to Int", "conversion", [
			createPort("in", "In", "float", "input"),
			createPort("out", "Out", "int", "output"),
		]);
		applyLegacyData(floatToIntNode, { conversionOp: "float-to-int" });

		const intToFloatNode = createNode(102, "Int to Float", "conversion", [
			createPort("in", "In", "int", "input"),
			createPort("out", "Out", "float", "output"),
		]);
		applyLegacyData(intToFloatNode, { conversionOp: "int-to-float" });

		const vec2Node = createNode(103, "Constant Vec2", "constants", [
			createPort("out", "Value", "vec2", "output"),
		]);
		applyLegacyData(vec2Node, {
			constType: "vec2",
			vector: { x: 0.2, y: 0.4 },
		});

		const zNode = createNode(104, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(zNode, { constType: "float", value: 0.6 });

		const vec2ToVec3Node = createNode(105, "Vec2 to Vec3", "conversion", [
			createPort("in", "In", "vec2", "input"),
			createPort("z", "Z", "float", "input"),
			createPort("out", "Out", "vec3", "output"),
		]);
		applyLegacyData(vec2ToVec3Node, { conversionOp: "vec2-to-vec3" });

		const vec3ToVec2Node = createNode(106, "Vec3 to Vec2", "conversion", [
			createPort("in", "In", "vec3", "input"),
			createPort("out", "Out", "vec2", "output"),
		]);
		applyLegacyData(vec3ToVec2Node, { conversionOp: "vec3-to-vec2" });

		const z2Node = createNode(107, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(z2Node, { constType: "float", value: 0.7 });

		const vec2ToVec3NodeB = createNode(108, "Vec2 to Vec3", "conversion", [
			createPort("in", "In", "vec2", "input"),
			createPort("z", "Z", "float", "input"),
			createPort("out", "Out", "vec3", "output"),
		]);
		applyLegacyData(vec2ToVec3NodeB, { conversionOp: "vec2-to-vec3" });

		const wNode = createNode(109, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(wNode, { constType: "float", value: 0.8 });

		const vec3ToVec4Node = createNode(110, "Vec3 to Vec4", "conversion", [
			createPort("in", "In", "vec3", "input"),
			createPort("w", "W", "float", "input"),
			createPort("out", "Out", "vec4", "output"),
		]);
		applyLegacyData(vec3ToVec4Node, { conversionOp: "vec3-to-vec4" });

		const fragmentNode = createNode(111, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[floatNode.id, floatNode],
			[floatToIntNode.id, floatToIntNode],
			[intToFloatNode.id, intToFloatNode],
			[vec2Node.id, vec2Node],
			[zNode.id, zNode],
			[vec2ToVec3Node.id, vec2ToVec3Node],
			[vec3ToVec2Node.id, vec3ToVec2Node],
			[z2Node.id, z2Node],
			[vec2ToVec3NodeB.id, vec2ToVec3NodeB],
			[wNode.id, wNode],
			[vec3ToVec4Node.id, vec3ToVec4Node],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"100-101",
				createConnection(
					"100-101",
					floatNode.id,
					"out",
					floatToIntNode.id,
					"in",
					"float",
				),
			],
			[
				"101-102",
				createConnection(
					"101-102",
					floatToIntNode.id,
					"out",
					intToFloatNode.id,
					"in",
					"int",
				),
			],
			[
				"103-105",
				createConnection(
					"103-105",
					vec2Node.id,
					"out",
					vec2ToVec3Node.id,
					"in",
					"vec2",
				),
			],
			[
				"104-105",
				createConnection(
					"104-105",
					zNode.id,
					"out",
					vec2ToVec3Node.id,
					"z",
					"float",
				),
			],
			[
				"105-106",
				createConnection(
					"105-106",
					vec2ToVec3Node.id,
					"out",
					vec3ToVec2Node.id,
					"in",
					"vec3",
				),
			],
			[
				"106-108",
				createConnection(
					"106-108",
					vec3ToVec2Node.id,
					"out",
					vec2ToVec3NodeB.id,
					"in",
					"vec2",
				),
			],
			[
				"107-108",
				createConnection(
					"107-108",
					z2Node.id,
					"out",
					vec2ToVec3NodeB.id,
					"z",
					"float",
				),
			],
			[
				"108-110",
				createConnection(
					"108-110",
					vec2ToVec3NodeB.id,
					"out",
					vec3ToVec4Node.id,
					"in",
					"vec3",
				),
			],
			[
				"109-110",
				createConnection(
					"109-110",
					wNode.id,
					"out",
					vec3ToVec4Node.id,
					"w",
					"float",
				),
			],
			[
				"110-111",
				createConnection(
					"110-111",
					vec3ToVec4Node.id,
					"out",
					fragmentNode.id,
					"color",
					"vec4",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.fragmentSource).toContain("int(n100_out)");
		expect(result.fragmentSource).toContain("float(n101_out)");
		expect(result.fragmentSource).toContain("vec3(n103_out, n104_out)");
		expect(result.fragmentSource).toContain("(n105_out).xy");
		expect(result.fragmentSource).toContain("vec3(n106_out, n107_out)");
		expect(result.fragmentSource).toContain("vec4(n108_out, n109_out)");
	});

	it("compiles checkbox, text, and select input nodes", () => {
		const checkboxNode = createNode(120, "Input Checkbox", "inputs", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(checkboxNode, {
			inputType: "checkbox",
			inputChecked: true,
		});

		const textNode = createNode(121, "Input Text", "inputs", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(textNode, { inputType: "text", inputText: "2.5" });

		const selectNode = createNode(122, "Input Select", "inputs", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(selectNode, {
			inputType: "select",
			inputOptions: ["10", "20"],
			inputSelection: "20",
		});

		const fallbackNode = createNode(123, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(fallbackNode, { constType: "float", value: 0.7 });

		const composeNode = createNode(124, "Compose", "vector", [
			createPort("x", "X", "float", "input"),
			createPort("y", "Y", "float", "input"),
			createPort("z", "Z", "float", "input"),
			createPort("w", "W", "float", "input"),
			createPort("out", "Out", "vec4", "output"),
		]);
		applyLegacyData(composeNode, { vectorOp: "compose", vectorType: "vec4" });

		const fragmentNode = createNode(125, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[checkboxNode.id, checkboxNode],
			[textNode.id, textNode],
			[selectNode.id, selectNode],
			[fallbackNode.id, fallbackNode],
			[composeNode.id, composeNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"120-124-x",
				createConnection(
					"120-124-x",
					checkboxNode.id,
					"out",
					composeNode.id,
					"x",
					"float",
				),
			],
			[
				"121-124-y",
				createConnection(
					"121-124-y",
					textNode.id,
					"out",
					composeNode.id,
					"y",
					"float",
				),
			],
			[
				"122-124-z",
				createConnection(
					"122-124-z",
					selectNode.id,
					"out",
					composeNode.id,
					"z",
					"float",
				),
			],
			[
				"123-124-w",
				createConnection(
					"123-124-w",
					fallbackNode.id,
					"out",
					composeNode.id,
					"w",
					"float",
				),
			],
			[
				"124-125",
				createConnection(
					"124-125",
					composeNode.id,
					"out",
					fragmentNode.id,
					"color",
					"vec4",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.fragmentSource).toContain("float n120_out = 1.0;");
		expect(result.fragmentSource).toContain("float n121_out = 2.5;");
		expect(result.fragmentSource).toContain("float n122_out = 20.0;");
		expect(result.fragmentSource).toContain("vec4 n124_out = vec4(");
	});

	it("compiles sine and cosine math operations", () => {
		const floatA = createNode(130, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(floatA, { constType: "float", value: 0.5 });

		const floatB = createNode(131, "Constant Float", "constants", [
			createPort("out", "Value", "float", "output"),
		]);
		applyLegacyData(floatB, { constType: "float", value: 0.25 });

		const sineNode = createNode(132, "Sine", "math", [
			createPort("in", "In", "float", "input"),
			createPort("out", "Out", "float", "output"),
		]);
		applyLegacyData(sineNode, { mathOp: "sine", mathType: "float" });

		const cosineNode = createNode(133, "Cosine", "math", [
			createPort("in", "In", "float", "input"),
			createPort("out", "Out", "float", "output"),
		]);
		applyLegacyData(cosineNode, { mathOp: "cosine", mathType: "float" });

		const composeNode = createNode(134, "Compose", "vector", [
			createPort("x", "X", "float", "input"),
			createPort("y", "Y", "float", "input"),
			createPort("z", "Z", "float", "input"),
			createPort("w", "W", "float", "input"),
			createPort("out", "Out", "vec4", "output"),
		]);
		applyLegacyData(composeNode, { vectorOp: "compose", vectorType: "vec4" });

		const fragmentNode = createNode(135, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[floatA.id, floatA],
			[floatB.id, floatB],
			[sineNode.id, sineNode],
			[cosineNode.id, cosineNode],
			[composeNode.id, composeNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"130-132",
				createConnection(
					"130-132",
					floatA.id,
					"out",
					sineNode.id,
					"in",
					"float",
				),
			],
			[
				"131-133",
				createConnection(
					"131-133",
					floatB.id,
					"out",
					cosineNode.id,
					"in",
					"float",
				),
			],
			[
				"132-134-x",
				createConnection(
					"132-134-x",
					sineNode.id,
					"out",
					composeNode.id,
					"x",
					"float",
				),
			],
			[
				"133-134-y",
				createConnection(
					"133-134-y",
					cosineNode.id,
					"out",
					composeNode.id,
					"y",
					"float",
				),
			],
			[
				"130-134-z",
				createConnection(
					"130-134-z",
					floatA.id,
					"out",
					composeNode.id,
					"z",
					"float",
				),
			],
			[
				"131-134-w",
				createConnection(
					"131-134-w",
					floatB.id,
					"out",
					composeNode.id,
					"w",
					"float",
				),
			],
			[
				"134-135",
				createConnection(
					"134-135",
					composeNode.id,
					"out",
					fragmentNode.id,
					"color",
					"vec4",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(result.messages).toHaveLength(0);
		expect(result.fragmentSource).toContain("sin(");
		expect(result.fragmentSource).toContain("cos(");
	});

	it("errors when shader graph has a cycle", () => {
		const firstMathNode = createNode(21, "Math", "math", [
			createPort("a", "A", "vec4", "input"),
			createPort("b", "B", "vec4", "input"),
			createPort("out", "Out", "vec4", "output"),
		]);
		applyLegacyData(firstMathNode, { mathOp: "add" });

		const secondMathNode = createNode(22, "Math", "math", [
			createPort("a", "A", "vec4", "input"),
			createPort("b", "B", "vec4", "input"),
			createPort("out", "Out", "vec4", "output"),
		]);
		applyLegacyData(secondMathNode, { mathOp: "add" });

		const fragmentNode = createNode(23, "Fragment Output", "output", [
			createPort("color", "Color", "vec4", "input"),
		]);
		applyLegacyData(fragmentNode, { outputType: "fragment" });

		const nodes = new Map<number, NodeView>([
			[firstMathNode.id, firstMathNode],
			[secondMathNode.id, secondMathNode],
			[fragmentNode.id, fragmentNode],
		]);
		const connections = new Map<string, Connection>([
			[
				"21-22",
				createConnection(
					"21-22",
					firstMathNode.id,
					"out",
					secondMathNode.id,
					"a",
					"vec4",
				),
			],
			[
				"22-21",
				createConnection(
					"22-21",
					secondMathNode.id,
					"out",
					firstMathNode.id,
					"a",
					"vec4",
				),
			],
			[
				"21-23",
				createConnection(
					"21-23",
					firstMathNode.id,
					"out",
					fragmentNode.id,
					"color",
					"vec4",
				),
			],
		]);

		const result = compileGraphToGlsl(nodes, connections);

		expect(
			result.messages.some(
				(message) =>
					message.kind === "error" &&
					message.message.includes("Cycle detected"),
			),
		).toBe(true);
	});
});
