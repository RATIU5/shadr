import { describe, expect, it } from "vitest";

import {
	addEdge,
	addNode,
	createGraph,
	type GraphResult,
	validateGraph
} from "@shadr/graph-core";

const expectOk = <T>(result: GraphResult<T>): T => {
	if (!result.ok) {
		throw new Error(`Unexpected error: ${result.error._tag}`);
	}
	return result.value;
};

describe("validateGraph", () => {
	it("accepts an acyclic graph", () => {
		let graph = createGraph();
		graph = expectOk(addNode(graph, "A"));
		graph = expectOk(addNode(graph, "B"));
		graph = expectOk(addNode(graph, "C"));
		graph = expectOk(addEdge(graph, "A", "B"));
		graph = expectOk(addEdge(graph, "B", "C"));

		const result = validateGraph(graph);
		expect(result.ok).toBe(true);
	});

	it("reports a cycle", () => {
		let graph = createGraph();
		graph = expectOk(addNode(graph, "A"));
		graph = expectOk(addNode(graph, "B"));
		graph = expectOk(addNode(graph, "C"));
		graph = expectOk(addEdge(graph, "A", "B"));
		graph = expectOk(addEdge(graph, "B", "C"));
		const cycleResult = addEdge(graph, "C", "A");

		expect(cycleResult.ok).toBe(false);
		if (!cycleResult.ok) {
			expect(cycleResult.error._tag).toBe("CycleDetected");
			expect(cycleResult.error.path).toEqual(["C", "A", "B", "C"]);
		}
	});
});
