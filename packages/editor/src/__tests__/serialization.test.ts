import { describe, expect, it } from "vitest";
import { GRAPH_SCHEMA_VERSION } from "../graph-version";
import { parseGraph, parseGraphWithReport } from "../serialization";

describe("graph serialization", () => {
	it("parses a valid snapshot with camera and node data", () => {
		const snapshot = {
			version: GRAPH_SCHEMA_VERSION,
			nodes: [
				{
					id: 1,
					title: "Constant Float",
					x: 12,
					y: -8,
					familyId: "constants",
					data: { constType: "float", value: 0.75 },
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

		expect(parsed).not.toBeNull();
		expect(parsed?.camera?.scale).toBe(1.5);
		expect(parsed?.nodes.length).toBe(1);
		expect(parsed?.nodes[0]?.typeId).toBe("constants");
		expect(parsed?.nodes[0]?.socketValues?.out).toBe(0.75);
	});

	it("drops invalid node data payloads instead of failing", () => {
		const snapshot = {
			version: GRAPH_SCHEMA_VERSION,
			nodes: [
				{
					id: 2,
					title: "Constant Vec2",
					x: 0,
					y: 0,
					familyId: "constants",
					data: { constType: "vec2", vector: { x: 0.5, y: Number.NaN } },
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

		expect(parsed).not.toBeNull();
		expect(parsed?.nodes[0]?.state?.params.type).toBe("float");
	});

	it("parses groups and filters invalid node references", () => {
		const snapshot = {
			version: GRAPH_SCHEMA_VERSION,
			nodes: [
				{
					id: 7,
					title: "Constant Float",
					x: 0,
					y: 0,
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
			groups: [
				{
					id: 1,
					title: "Group 1",
					nodeIds: [7, 99],
					collapsed: true,
					x: 12,
					y: -6,
				},
			],
		};

		const parsed = parseGraph(snapshot);

		expect(parsed).not.toBeNull();
		expect(parsed?.groups?.length).toBe(1);
		expect(parsed?.groups?.[0]?.nodeIds).toEqual([7]);
		expect(parsed?.groups?.[0]?.collapsed).toBe(true);
	});

	it("preserves group parent ids when provided", () => {
		const snapshot = {
			version: GRAPH_SCHEMA_VERSION,
			nodes: [
				{
					id: 7,
					title: "Constant Float",
					x: 0,
					y: 0,
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
			groups: [
				{
					id: 1,
					title: "Parent",
					nodeIds: [7],
					collapsed: false,
					x: 0,
					y: 0,
				},
				{
					id: 2,
					title: "Child",
					nodeIds: [],
					parentId: 1,
					collapsed: true,
					x: 10,
					y: 10,
				},
			],
		};

		const parsed = parseGraph(snapshot);

		expect(parsed?.groups?.[1]?.parentId).toBe(1);
	});

	it("keeps dropdown component data for vector component nodes", () => {
		const snapshot = {
			version: GRAPH_SCHEMA_VERSION,
			nodes: [
				{
					id: 6,
					title: "Component",
					x: 0,
					y: 0,
					familyId: "vector",
					data: { vectorOp: "component", component: "z" },
					ports: [
						{
							id: "in",
							name: "Vector",
							type: "vec4",
							direction: "input",
						},
						{
							id: "out",
							name: "Out",
							type: "vec4",
							direction: "output",
						},
					],
				},
			],
			connections: [],
		};

		const parsed = parseGraph(snapshot);

		expect(parsed).not.toBeNull();
		expect(parsed?.nodes[0]?.typeId).toBe("vector");
		expect(parsed?.nodes[0]?.state?.params.operation).toBe("component");
		expect(parsed?.nodes[0]?.state?.params.component).toBe("z");
	});

	it("keeps math operation data for math family nodes", () => {
		const snapshot = {
			version: GRAPH_SCHEMA_VERSION,
			nodes: [
				{
					id: 8,
					title: "Math",
					x: 0,
					y: 0,
					familyId: "math",
					data: { mathOp: "multiply", mathType: "vec2" },
					ports: [
						{
							id: "a",
							name: "A",
							type: "vec2",
							direction: "input",
						},
						{
							id: "b",
							name: "B",
							type: "vec2",
							direction: "input",
						},
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

		expect(parsed).not.toBeNull();
		expect(parsed?.nodes[0]?.typeId).toBe("math");
		expect(parsed?.nodes[0]?.state?.params.operation).toBe("multiply");
		expect(parsed?.nodes[0]?.state?.params.type).toBe("vec2");
	});

	it("migrates legacy template ids into node families", () => {
		const snapshot = {
			version: GRAPH_SCHEMA_VERSION,
			nodes: [
				{
					id: 10,
					title: "Legacy Float",
					x: 0,
					y: 0,
					templateId: "const-float",
					data: { value: 0.5 },
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
					id: 11,
					title: "Legacy Math",
					x: 0,
					y: 0,
					templateId: "math-add-vec3",
					data: { mathOp: "add" },
					ports: [
						{
							id: "out",
							name: "Out",
							type: "vec3",
							direction: "output",
						},
					],
				},
			],
			connections: [],
		};

		const parsed = parseGraph(snapshot);

		expect(parsed).not.toBeNull();
		expect(parsed?.nodes[0]?.typeId).toBe("constants");
		expect(parsed?.nodes[0]?.state?.params.type).toBe("float");
		expect(parsed?.nodes[0]?.socketValues?.out).toBe(0.5);
		expect(parsed?.nodes[1]?.typeId).toBe("math");
		expect(parsed?.nodes[1]?.state?.params.type).toBe("vec3");
	});

	it("rejects snapshots with invalid port types", () => {
		const snapshot = {
			version: GRAPH_SCHEMA_VERSION,
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

		expect(parsed).toBeNull();
	});

	it("filters out invalid connections while keeping the snapshot", () => {
		const snapshot = {
			version: GRAPH_SCHEMA_VERSION,
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

		expect(parsed).not.toBeNull();
		expect(parsed?.connections.length).toBe(1);
		expect(parsed?.connections[0]?.from.nodeId).toBe(4);
	});

	it("reports errors for unsupported graph versions", () => {
		const snapshot = {
			version: GRAPH_SCHEMA_VERSION + 1,
			nodes: [],
			connections: [],
		};

		const result = parseGraphWithReport(snapshot);

		expect(result.snapshot).toBeNull();
		expect(result.errors[0]).toContain("newer");
	});

	it("loads graphs with invalid nodes while reporting warnings", () => {
		const snapshot = {
			version: GRAPH_SCHEMA_VERSION,
			nodes: [
				{
					id: 1,
					title: "Constant Float",
					x: 0,
					y: 0,
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
					id: "bad-node",
					title: "Broken",
					x: 1,
					y: 1,
					ports: [],
				},
			],
			connections: [],
		};

		const result = parseGraphWithReport(snapshot);

		expect(result.snapshot).not.toBeNull();
		expect(result.snapshot?.nodes.length).toBe(1);
		expect(result.errors.length).toBe(1);
		expect(result.errors[0]).toContain("invalid node");
	});
});
