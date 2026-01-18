import { describe, expect, it } from "vitest";

import {
	addEdge,
	addNode,
	createGraph,
	detectCycle,
	type GraphResult
} from "@shadr/graph-core";

const expectOk = <T>(result: GraphResult<T>): T => {
	if (!result.ok) {
		throw new Error(`Unexpected error: ${result.error._tag}`);
	}
	return result.value;
};

describe("detectCycle", () => {
	it("returns null for DAGs", () => {
		let graph = createGraph();
		graph = expectOk(addNode(graph, "A"));
		graph = expectOk(addNode(graph, "B"));
		graph = expectOk(addNode(graph, "C"));
		graph = expectOk(addEdge(graph, "A", "B"));
		graph = expectOk(addEdge(graph, "B", "C"));

		expect(detectCycle(graph)).toBeNull();
	});

	it("returns the first detected cycle path", () => {
		let graph = createGraph();
		graph = expectOk(addNode(graph, "A"));
		graph = expectOk(addNode(graph, "B"));
		graph = expectOk(addNode(graph, "C"));
		graph = expectOk(addEdge(graph, "A", "B"));
		graph = expectOk(addEdge(graph, "B", "C"));
		graph = expectOk(addEdge(graph, "C", "A"));

		expect(detectCycle(graph)).toEqual(["A", "B", "C", "A"]);
	});
});
