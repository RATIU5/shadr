import { Either, Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  createExecState,
  evaluateSocket,
  evaluateSocketWithStats,
  getNodeErrors,
  markDirty,
} from "@shadr/exec-engine";
import {
  addNode,
  addWire,
  createGraph,
  type GraphEffect,
  type GraphNode,
  type GraphSocket,
  type NodeId,
} from "@shadr/graph-core";
import type { NodeDefinition } from "@shadr/plugin-system";
import type { JsonValue } from "@shadr/shared";
import {
  makeGraphId,
  makeNodeId,
  makeSocketId,
  makeWireId,
} from "@shadr/shared";

const expectOk = <T>(effect: Effect.Effect<T, unknown>): T => {
  const result = Effect.runSync(Effect.either(effect));
  if (Either.isLeft(result)) {
    throw new Error(`Unexpected error: ${String(result.left)}`);
  }
  return result.right;
};

const expectGraphOk = <T>(effect: GraphEffect<T>): T => {
  const result = Effect.runSync(Effect.either(effect));
  if (Either.isLeft(result)) {
    throw new Error(`Unexpected graph error: ${result.left._tag}`);
  }
  return result.right;
};

type InputSpec = Readonly<{
  key: string;
  required?: boolean;
  defaultValue?: JsonValue;
}>;

const createTestNode = (
  id: string,
  type: string,
  inputs: ReadonlyArray<InputSpec>,
  outputs: ReadonlyArray<string>,
): {
  nodeId: NodeId;
  node: GraphNode;
  sockets: GraphSocket[];
  inputSocketIds: Readonly<Record<string, ReturnType<typeof makeSocketId>>>;
  outputSocketIds: Readonly<Record<string, ReturnType<typeof makeSocketId>>>;
} => {
  const nodeId = makeNodeId(id);
  const inputSocketIds: Record<string, ReturnType<typeof makeSocketId>> = {};
  const outputSocketIds: Record<string, ReturnType<typeof makeSocketId>> = {};
  const sockets: GraphSocket[] = [];
  const inputIds: ReturnType<typeof makeSocketId>[] = [];
  const outputIds: ReturnType<typeof makeSocketId>[] = [];

  for (const input of inputs) {
    const socketId = makeSocketId(`${id}.${input.key}`);
    inputSocketIds[input.key] = socketId;
    inputIds.push(socketId);
    sockets.push({
      id: socketId,
      nodeId,
      name: input.key,
      direction: "input",
      dataType: "float",
      required: input.required ?? false,
      defaultValue: input.defaultValue,
    });
  }

  for (const output of outputs) {
    const socketId = makeSocketId(`${id}.${output}`);
    outputSocketIds[output] = socketId;
    outputIds.push(socketId);
    sockets.push({
      id: socketId,
      nodeId,
      name: output,
      direction: "output",
      dataType: "float",
      required: false,
    });
  }

  const node: GraphNode = {
    id: nodeId,
    type,
    position: { x: 0, y: 0 },
    params: {},
    inputs: inputIds,
    outputs: outputIds,
  };

  return { nodeId, node, sockets, inputSocketIds, outputSocketIds };
};

const toNumber = (value: JsonValue | null): number =>
  typeof value === "number" ? value : 0;

describe("evaluateSocket", () => {
  it("computes only the requested closure", () => {
    const counters = new Map<NodeId, number>();
    const constValues = new Map<NodeId, number>();

    const nodeA = createTestNode("A", "const", [], ["out"]);
    const nodeB = createTestNode(
      "B",
      "inc",
      [{ key: "in", required: true }],
      ["out"],
    );
    const nodeC = createTestNode(
      "C",
      "inc",
      [{ key: "in", required: true }],
      ["out"],
    );
    const nodeD = createTestNode("D", "const", [], ["out"]);

    constValues.set(nodeA.nodeId, 1);
    constValues.set(nodeD.nodeId, 10);

    const bump = (nodeId: NodeId): void => {
      counters.set(nodeId, (counters.get(nodeId) ?? 0) + 1);
    };

    const definitions: NodeDefinition[] = [
      {
        typeId: "const",
        label: "Const",
        description: "const",
        inputs: [],
        outputs: [
          {
            key: "out",
            label: "Out",
            dataType: "float",
            direction: "output",
          },
        ],
        compute: (_inputs, _params, context) => {
          bump(context.nodeId);
          return { out: constValues.get(context.nodeId) ?? 0 };
        },
      },
      {
        typeId: "inc",
        label: "Inc",
        description: "inc",
        inputs: [
          {
            key: "in",
            label: "In",
            dataType: "float",
            direction: "input",
          },
        ],
        outputs: [
          {
            key: "out",
            label: "Out",
            dataType: "float",
            direction: "output",
          },
        ],
        compute: (inputs, _params, context) => {
          bump(context.nodeId);
          return { out: toNumber(inputs.in) + 1 };
        },
      },
    ];

    const resolveNodeDefinition = (
      nodeType: string,
    ): NodeDefinition | undefined =>
      definitions.find((definition) => definition.typeId === nodeType);

    let graph = createGraph(makeGraphId("graph"));
    graph = expectGraphOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectGraphOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectGraphOk(addNode(graph, nodeC.node, nodeC.sockets));
    graph = expectGraphOk(addNode(graph, nodeD.node, nodeD.sockets));
    graph = expectGraphOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputSocketIds.out,
        toSocketId: nodeB.inputSocketIds.in,
      }),
    );
    graph = expectGraphOk(
      addWire(graph, {
        id: makeWireId("B-C"),
        fromSocketId: nodeB.outputSocketIds.out,
        toSocketId: nodeC.inputSocketIds.in,
      }),
    );

    const value = expectOk(
      evaluateSocket(graph, nodeC.outputSocketIds.out, resolveNodeDefinition),
    );

    expect(value).toBe(3);
    expect(counters.get(nodeA.nodeId)).toBe(1);
    expect(counters.get(nodeB.nodeId)).toBe(1);
    expect(counters.get(nodeC.nodeId)).toBe(1);
    expect(counters.get(nodeD.nodeId)).toBeUndefined();
  });

  it("caches shared upstream nodes within one evaluation", () => {
    const counters = new Map<NodeId, number>();
    const bump = (nodeId: NodeId): void => {
      counters.set(nodeId, (counters.get(nodeId) ?? 0) + 1);
    };

    const definitions: NodeDefinition[] = [
      {
        typeId: "const",
        label: "Const",
        description: "const",
        inputs: [],
        outputs: [
          {
            key: "out",
            label: "Out",
            dataType: "float",
            direction: "output",
          },
        ],
        compute: (_inputs, _params, context) => {
          bump(context.nodeId);
          return { out: 2 };
        },
      },
      {
        typeId: "inc",
        label: "Inc",
        description: "inc",
        inputs: [
          {
            key: "in",
            label: "In",
            dataType: "float",
            direction: "input",
          },
        ],
        outputs: [
          {
            key: "out",
            label: "Out",
            dataType: "float",
            direction: "output",
          },
        ],
        compute: (inputs, _params, context) => {
          bump(context.nodeId);
          return { out: toNumber(inputs.in) + 1 };
        },
      },
      {
        typeId: "sum2",
        label: "Sum2",
        description: "sum2",
        inputs: [
          {
            key: "left",
            label: "Left",
            dataType: "float",
            direction: "input",
          },
          {
            key: "right",
            label: "Right",
            dataType: "float",
            direction: "input",
          },
        ],
        outputs: [
          {
            key: "out",
            label: "Out",
            dataType: "float",
            direction: "output",
          },
        ],
        compute: (inputs, _params, context) => {
          bump(context.nodeId);
          return { out: toNumber(inputs.left) + toNumber(inputs.right) };
        },
      },
    ];

    const resolveNodeDefinition = (
      nodeType: string,
    ): NodeDefinition | undefined =>
      definitions.find((definition) => definition.typeId === nodeType);

    const nodeA = createTestNode("A", "const", [], ["out"]);
    const nodeB = createTestNode(
      "B",
      "inc",
      [{ key: "in", required: true }],
      ["out"],
    );
    const nodeC = createTestNode(
      "C",
      "inc",
      [{ key: "in", required: true }],
      ["out"],
    );
    const nodeD = createTestNode(
      "D",
      "sum2",
      [
        { key: "left", required: true },
        { key: "right", required: true },
      ],
      ["out"],
    );

    let graph = createGraph(makeGraphId("graph"));
    graph = expectGraphOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectGraphOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectGraphOk(addNode(graph, nodeC.node, nodeC.sockets));
    graph = expectGraphOk(addNode(graph, nodeD.node, nodeD.sockets));
    graph = expectGraphOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputSocketIds.out,
        toSocketId: nodeB.inputSocketIds.in,
      }),
    );
    graph = expectGraphOk(
      addWire(graph, {
        id: makeWireId("A-C"),
        fromSocketId: nodeA.outputSocketIds.out,
        toSocketId: nodeC.inputSocketIds.in,
      }),
    );
    graph = expectGraphOk(
      addWire(graph, {
        id: makeWireId("B-D"),
        fromSocketId: nodeB.outputSocketIds.out,
        toSocketId: nodeD.inputSocketIds.left,
      }),
    );
    graph = expectGraphOk(
      addWire(graph, {
        id: makeWireId("C-D"),
        fromSocketId: nodeC.outputSocketIds.out,
        toSocketId: nodeD.inputSocketIds.right,
      }),
    );

    const value = expectOk(
      evaluateSocket(graph, nodeD.outputSocketIds.out, resolveNodeDefinition),
    );

    expect(value).toBe(6);
    expect(counters.get(nodeA.nodeId)).toBe(1);
    expect(counters.get(nodeB.nodeId)).toBe(1);
    expect(counters.get(nodeC.nodeId)).toBe(1);
    expect(counters.get(nodeD.nodeId)).toBe(1);
  });

  it("captures evaluation stats and cache hits", () => {
    const nodeA = createTestNode("A", "const", [], ["out"]);
    const nodeB = createTestNode(
      "B",
      "inc",
      [{ key: "in", required: true }],
      ["out"],
    );

    const definitions: NodeDefinition[] = [
      {
        typeId: "const",
        label: "Const",
        description: "const",
        inputs: [],
        outputs: [
          {
            key: "out",
            label: "Out",
            dataType: "float",
            direction: "output",
          },
        ],
        compute: () => ({ out: 2 }),
      },
      {
        typeId: "inc",
        label: "Inc",
        description: "inc",
        inputs: [
          {
            key: "in",
            label: "In",
            dataType: "float",
            direction: "input",
          },
        ],
        outputs: [
          {
            key: "out",
            label: "Out",
            dataType: "float",
            direction: "output",
          },
        ],
        compute: (inputs) => ({ out: toNumber(inputs.in) + 1 }),
      },
    ];

    const resolveNodeDefinition = (
      nodeType: string,
    ): NodeDefinition | undefined =>
      definitions.find((definition) => definition.typeId === nodeType);

    let graph = createGraph(makeGraphId("graph"));
    graph = expectGraphOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectGraphOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectGraphOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputSocketIds.out,
        toSocketId: nodeB.inputSocketIds.in,
      }),
    );

    const state = createExecState();
    const first = expectOk(
      evaluateSocketWithStats(
        graph,
        nodeB.outputSocketIds.out,
        resolveNodeDefinition,
        state,
      ),
    );
    expect(first.value).toBe(3);
    expect(first.stats.cacheHits).toBe(0);
    expect(first.stats.cacheMisses).toBe(2);
    expect(first.stats.nodeTimings).toHaveLength(2);
    expect(first.stats.totalMs).toBeGreaterThanOrEqual(0);

    const second = expectOk(
      evaluateSocketWithStats(
        graph,
        nodeB.outputSocketIds.out,
        resolveNodeDefinition,
        state,
      ),
    );
    expect(second.value).toBe(3);
    expect(second.stats.cacheHits).toBe(1);
    expect(second.stats.cacheMisses).toBe(0);
    expect(second.stats.nodeTimings).toHaveLength(1);
    expect(second.stats.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("reuses cached outputs across evaluations until invalidated", () => {
    const counters = new Map<NodeId, number>();
    const bump = (nodeId: NodeId): void => {
      counters.set(nodeId, (counters.get(nodeId) ?? 0) + 1);
    };

    const definitions: NodeDefinition[] = [
      {
        typeId: "const",
        label: "Const",
        description: "const",
        inputs: [],
        outputs: [
          {
            key: "out",
            label: "Out",
            dataType: "float",
            direction: "output",
          },
        ],
        compute: (_inputs, _params, context) => {
          bump(context.nodeId);
          return { out: 1 };
        },
      },
      {
        typeId: "inc",
        label: "Inc",
        description: "inc",
        inputs: [
          {
            key: "in",
            label: "In",
            dataType: "float",
            direction: "input",
          },
        ],
        outputs: [
          {
            key: "out",
            label: "Out",
            dataType: "float",
            direction: "output",
          },
        ],
        compute: (inputs, _params, context) => {
          bump(context.nodeId);
          return { out: toNumber(inputs.in) + 1 };
        },
      },
    ];

    const resolveNodeDefinition = (
      nodeType: string,
    ): NodeDefinition | undefined =>
      definitions.find((definition) => definition.typeId === nodeType);

    const nodeA = createTestNode("A", "const", [], ["out"]);
    const nodeB = createTestNode(
      "B",
      "inc",
      [{ key: "in", required: true }],
      ["out"],
    );

    let graph = createGraph(makeGraphId("graph"));
    graph = expectGraphOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectGraphOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectGraphOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputSocketIds.out,
        toSocketId: nodeB.inputSocketIds.in,
      }),
    );

    let state = createExecState();
    const first = expectOk(
      evaluateSocket(
        graph,
        nodeB.outputSocketIds.out,
        resolveNodeDefinition,
        state,
      ),
    );
    const second = expectOk(
      evaluateSocket(
        graph,
        nodeB.outputSocketIds.out,
        resolveNodeDefinition,
        state,
      ),
    );

    expect(first).toBe(2);
    expect(second).toBe(2);
    expect(counters.get(nodeA.nodeId)).toBe(1);
    expect(counters.get(nodeB.nodeId)).toBe(1);

    state = markDirty(graph, state, nodeA.nodeId);
    const third = expectOk(
      evaluateSocket(
        graph,
        nodeB.outputSocketIds.out,
        resolveNodeDefinition,
        state,
      ),
    );

    expect(third).toBe(2);
    expect(counters.get(nodeA.nodeId)).toBe(2);
    expect(counters.get(nodeB.nodeId)).toBe(2);
  });

  it("records missing required inputs and returns null output", () => {
    const definitions: NodeDefinition[] = [
      {
        typeId: "pass",
        label: "Pass",
        description: "pass",
        inputs: [
          {
            key: "in",
            label: "In",
            dataType: "float",
            direction: "input",
          },
        ],
        outputs: [
          {
            key: "out",
            label: "Out",
            dataType: "float",
            direction: "output",
          },
        ],
        compute: (inputs) => ({ out: inputs.in ?? null }),
      },
    ];

    const resolveNodeDefinition = (
      nodeType: string,
    ): NodeDefinition | undefined =>
      definitions.find((definition) => definition.typeId === nodeType);

    const nodeA = createTestNode(
      "A",
      "pass",
      [{ key: "in", required: true }],
      ["out"],
    );

    let graph = createGraph(makeGraphId("graph"));
    graph = expectGraphOk(addNode(graph, nodeA.node, nodeA.sockets));

    const state = createExecState();
    const result = Effect.runSync(
      Effect.either(
        evaluateSocket(
          graph,
          nodeA.outputSocketIds.out,
          resolveNodeDefinition,
          state,
        ),
      ),
    );

    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toBeNull();
    }

    const errors = getNodeErrors(state, nodeA.nodeId);
    expect(errors).toHaveLength(1);
    if (errors[0]) {
      expect(errors[0]._tag).toBe("MissingRequiredInput");
      expect(errors[0].socketName).toBe("in");
    }
  });

  it("captures compute failures as node runtime errors", () => {
    const definitions: NodeDefinition[] = [
      {
        typeId: "explode",
        label: "Explode",
        description: "explode",
        inputs: [],
        outputs: [
          {
            key: "out",
            label: "Out",
            dataType: "float",
            direction: "output",
          },
        ],
        compute: () => {
          throw new Error("boom");
        },
      },
    ];

    const resolveNodeDefinition = (
      nodeType: string,
    ): NodeDefinition | undefined =>
      definitions.find((definition) => definition.typeId === nodeType);

    const nodeA = createTestNode("A", "explode", [], ["out"]);

    let graph = createGraph(makeGraphId("graph"));
    graph = expectGraphOk(addNode(graph, nodeA.node, nodeA.sockets));

    const state = createExecState();
    const result = Effect.runSync(
      Effect.either(
        evaluateSocket(
          graph,
          nodeA.outputSocketIds.out,
          resolveNodeDefinition,
          state,
        ),
      ),
    );

    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toBeNull();
    }

    const errors = getNodeErrors(state, nodeA.nodeId);
    expect(errors).toHaveLength(1);
    if (errors[0]) {
      expect(errors[0]._tag).toBe("NodeComputeFailed");
      expect(errors[0].nodeId).toBe(nodeA.nodeId);
    }
  });
});
