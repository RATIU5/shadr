import type { Container, Graphics, Text } from "pixi.js";
import { compileGraphToGlsl } from "../shader";
import type {
	Connection,
	NodePort,
	NodeView,
	PortDirection,
	PortType,
} from "../types";

type TestCase = {
	name: string;
	run: () => void;
};

const assert = (condition: boolean, message: string) => {
	if (!condition) {
		throw new Error(message);
	}
};

const runTest = ({ name, run }: TestCase) => {
	try {
		run();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`${name} failed: ${message}`);
	}
};

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
	graphics: {} as Graphics,
	label: {} as Text,
	isHover: false,
	isDragTarget: false,
	isDragValid: false,
});

const createNode = (
	id: number,
	title: string,
	templateId: string,
	ports: NodePort[],
): NodeView => ({
	id,
	title: { text: title } as Text,
	templateId,
	ports,
	container: {} as Container,
	background: {} as Graphics,
	width: 0,
	height: 0,
	isHover: false,
});

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

export const runShaderCompileTests = () => {
	runTest({
		name: "compiles a fragment shader with a constant color input",
		run: () => {
			const colorNode = createNode(1, "Constant Color", "const-color", [
				createPort("out", "Color", "color", "output"),
			]);
			colorNode.data = { color: { r: 0.2, g: 0.4, b: 0.6, a: 1 } };

			const fragmentNode = createNode(2, "Fragment Output", "fragment-output", [
				createPort("color", "Color", "vec4", "input"),
			]);

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

			assert(result.messages.length === 0, "expected no compile messages");
			assert(
				result.fragmentSource.includes("vec4 n1_out = vec4("),
				"expected constant color expression",
			);
			assert(
				result.fragmentSource.includes("gl_FragColor = n1_out;"),
				"expected fragment output assignment",
			);
		},
	});

	runTest({
		name: "warns when fragment output is unconnected",
		run: () => {
			const fragmentNode = createNode(3, "Fragment Output", "fragment-output", [
				createPort("color", "Color", "vec4", "input"),
			]);

			const nodes = new Map<number, NodeView>([
				[fragmentNode.id, fragmentNode],
			]);
			const result = compileGraphToGlsl(nodes, new Map());

			assert(result.hasFragmentOutput, "expected fragment output flag");
			assert(
				result.messages.some(
					(message) =>
						message.kind === "warning" &&
						message.message === "Fragment Output input is unconnected.",
				),
				"expected unconnected fragment output warning",
			);
		},
	});

	runTest({
		name: "errors when no fragment output exists",
		run: () => {
			const result = compileGraphToGlsl(new Map(), new Map());

			assert(!result.hasFragmentOutput, "expected no fragment output flag");
			assert(
				result.messages.some(
					(message) =>
						message.kind === "error" &&
						message.message === "No Fragment Output node found.",
				),
				"expected missing fragment output error",
			);
		},
	});

	runTest({
		name: "compiles a vertex shader with a connected vertex output",
		run: () => {
			const positionNode = createNode(4, "Constant Vec3", "const-vec3", [
				createPort("out", "Value", "vec3", "output"),
			]);
			positionNode.data = { vector: { x: 1, y: 2, z: 3 } };

			const vertexNode = createNode(5, "Vertex Output", "vertex-output", [
				createPort("position", "Position", "vec3", "input"),
			]);

			const colorNode = createNode(6, "Constant Color", "const-color", [
				createPort("out", "Color", "color", "output"),
			]);
			colorNode.data = { color: { r: 0.1, g: 0.2, b: 0.3, a: 1 } };

			const fragmentNode = createNode(7, "Fragment Output", "fragment-output", [
				createPort("color", "Color", "vec4", "input"),
			]);

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

			assert(result.messages.length === 0, "expected no compile messages");
			assert(
				result.vertexSource.includes("vec3 n4_out = vec3(1.0, 2.0, 3.0);"),
				"expected vertex position expression",
			);
			assert(
				result.vertexSource.includes("gl_Position = vec4(n4_out, 1.0);"),
				"expected vertex output assignment",
			);
		},
	});

	runTest({
		name: "warns when vertex output is unconnected",
		run: () => {
			const vertexNode = createNode(8, "Vertex Output", "vertex-output", [
				createPort("position", "Position", "vec3", "input"),
			]);

			const colorNode = createNode(9, "Constant Color", "const-color", [
				createPort("out", "Color", "color", "output"),
			]);
			colorNode.data = { color: { r: 0.4, g: 0.5, b: 0.6, a: 1 } };

			const fragmentNode = createNode(
				10,
				"Fragment Output",
				"fragment-output",
				[createPort("color", "Color", "vec4", "input")],
			);

			const nodes = new Map<number, NodeView>([
				[vertexNode.id, vertexNode],
				[colorNode.id, colorNode],
				[fragmentNode.id, fragmentNode],
			]);
			const connections = new Map<string, Connection>([
				[
					"9-10",
					createConnection(
						"9-10",
						colorNode.id,
						"out",
						fragmentNode.id,
						"color",
						"color",
					),
				],
			]);

			const result = compileGraphToGlsl(nodes, connections);

			assert(
				result.messages.some(
					(message) =>
						message.kind === "warning" &&
						message.message === "Vertex Output input is unconnected.",
				),
				"expected unconnected vertex output warning",
			);
		},
	});
};
