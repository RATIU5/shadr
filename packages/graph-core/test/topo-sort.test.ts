import { describe, expect, it } from "vitest";

import {
	addEdge,
	addNode,
	createGraph,
	type GraphResult,
	topoSort
} from "@shadr/graph-core";

const expectOk = <T>(result: GraphResult<T>): T => {
	if (!result.ok) {
		throw new Error(`Unexpected error: ${result.error._tag}`);
	}
	return result.value;
};

describe("topoSort", () => {
	it("returns a deterministic topological order", () => {
		let graph = createGraph();
		graph = expectOk(addNode(graph, "A"));
		graph = expectOk(addNode(graph, "B"));
		graph = expectOk(addNode(graph, "C"));
		graph = expectOk(addNode(graph, "D"));
		graph = expectOk(addEdge(graph, "A", "B"));
		graph = expectOk(addEdge(graph, "A", "C"));
		graph = expectOk(addEdge(graph, "B", "D"));
		graph = expectOk(addEdge(graph, "C", "D"));

		const result = topoSort(graph);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toEqual(["A", "B", "C", "D"]);
		}
	});
});
