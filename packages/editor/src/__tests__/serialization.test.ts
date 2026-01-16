import { parseGraph } from "../serialization";
import type { SerializableGraph } from "../types";

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

export const runSerializationTests = () => {
	runTest({
		name: "parses a valid snapshot with camera and node data",
		run: () => {
			const snapshot: SerializableGraph = {
				version: 1,
				nodes: [
					{
						id: 1,
						title: "Constant Float",
						x: 12,
						y: -8,
						templateId: "const-float",
						data: { value: 0.75 },
						ports: [
							{
								id: "out",
								name: "Out",
								type: "float",
								direction: "output",
							},
						],
					},
				],
				connections: [],
				camera: {
					pivotX: 5,
					pivotY: -3,
					scale: 1.5,
				},
			};

			const parsed = parseGraph(snapshot);

			assert(parsed !== null, "expected snapshot to parse");
			assert(parsed?.camera?.scale === 1.5, "expected camera scale");
			assert(parsed?.nodes.length === 1, "expected one node");
			assert(
				parsed?.nodes[0]?.data?.value === 0.75,
				"expected node data value",
			);
		},
	});

	runTest({
		name: "drops invalid node data payloads instead of failing",
		run: () => {
			const snapshot: SerializableGraph = {
				version: 1,
				nodes: [
					{
						id: 2,
						title: "Constant Vec2",
						x: 0,
						y: 0,
						templateId: "const-vec2",
						data: { vector: { x: 0.5, y: Number.NaN } },
						ports: [
							{
								id: "out",
								name: "Out",
								type: "vec2",
								direction: "output",
							},
						],
					},
				],
				connections: [],
			};

			const parsed = parseGraph(snapshot);

			assert(parsed !== null, "expected snapshot to parse");
			assert(
				parsed?.nodes[0]?.data === undefined,
				"expected invalid data to be removed",
			);
		},
	});

	runTest({
		name: "rejects snapshots with invalid port types",
		run: () => {
			const snapshot = {
				version: 1,
				nodes: [
					{
						id: 3,
						title: "Bad Node",
						x: 0,
						y: 0,
						ports: [
							{
								id: "out",
								name: "Out",
								type: "mat4",
								direction: "output",
							},
						],
					},
				],
				connections: [],
			};

			const parsed = parseGraph(snapshot);

			assert(parsed === null, "expected snapshot to be rejected");
		},
	});

	runTest({
		name: "filters out invalid connections while keeping the snapshot",
		run: () => {
			const snapshot = {
				version: 1,
				nodes: [
					{
						id: 4,
						title: "Constant Float",
						x: 10,
						y: 20,
						ports: [
							{
								id: "out",
								name: "Out",
								type: "float",
								direction: "output",
							},
						],
					},
					{
						id: 5,
						title: "Fragment Output",
						x: 50,
						y: 50,
						ports: [
							{
								id: "color",
								name: "Color",
								type: "float",
								direction: "input",
							},
						],
					},
				],
				connections: [
					{
						from: { nodeId: 4, portId: "out" },
						to: { nodeId: 5, portId: "color" },
						type: "float",
					},
					{
						from: { nodeId: 99, portId: 12 },
						to: { nodeId: 5, portId: "color" },
						type: "float",
					},
				],
			};

			const parsed = parseGraph(snapshot);

			assert(parsed !== null, "expected snapshot to parse");
			assert(
				parsed?.connections.length === 1,
				"expected only valid connections",
			);
		},
	});
};
