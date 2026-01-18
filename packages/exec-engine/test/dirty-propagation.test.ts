import { describe, expect, it } from "vitest";

import { createDirtyState, isDirty, markDirty } from "@shadr/exec-engine";
import { addEdge, addNode, createGraph, type GraphResult } from "@shadr/graph-core";

const expectOk = <T>(result: GraphResult<T>): T => {
	if (!result.ok) {
		throw new Error(`Unexpected error: ${result.error._tag}`);
	}
	return result.value;
};

describe("dirty propagation", () => {
	it("marks downstream nodes as dirty", () => {
		let graph = createGraph();
		graph = expectOk(addNode(graph, "A"));
		graph = expectOk(addNode(graph, "B"));
		graph = expectOk(addNode(graph, "C"));
		graph = expectOk(addNode(graph, "D"));
		graph = expectOk(addEdge(graph, "A", "B"));
		graph = expectOk(addEdge(graph, "B", "C"));
		graph = expectOk(addEdge(graph, "A", "D"));

		const dirty = markDirty(graph, createDirtyState(), "A");

		expect(isDirty(dirty, "A")).toBe(true);
		expect(isDirty(dirty, "B")).toBe(true);
		expect(isDirty(dirty, "C")).toBe(true);
		expect(isDirty(dirty, "D")).toBe(true);
	});

	it("does not mark upstream nodes as dirty", () => {
		let graph = createGraph();
		graph = expectOk(addNode(graph, "A"));
		graph = expectOk(addNode(graph, "B"));
		graph = expectOk(addNode(graph, "C"));
		graph = expectOk(addEdge(graph, "A", "B"));
		graph = expectOk(addEdge(graph, "B", "C"));

		const dirty = markDirty(graph, createDirtyState(), "C");

		expect(isDirty(dirty, "C")).toBe(true);
		expect(isDirty(dirty, "B")).toBe(false);
		expect(isDirty(dirty, "A")).toBe(false);
	});
});
