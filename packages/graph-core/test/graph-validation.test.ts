import { Either, Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  addNode,
  addWire,
  createGraph,
  collectGraphWarnings,
  type GraphEffect,
  type GraphNode,
  type GraphSocket,
  validateGraph,
} from "@shadr/graph-core";
import {
  makeGraphId,
  type JsonValue,
  makeNodeId,
  makeSocketId,
  makeWireId,
} from "@shadr/shared";

const expectOk = <T>(effect: GraphEffect<T>): T => {
  const result = Effect.runSync(Effect.either(effect));
  if (Either.isLeft(result)) {
    throw new Error(`Unexpected error: ${result.left._tag}`);
  }
  return result.right;
};

const createTestNode = (
  id: string,
  socketTypes?: Readonly<{ input?: string; output?: string }>,
  socketLimits?: Readonly<{
    input?: Readonly<{ min?: number; max?: number }>;
    output?: Readonly<{ min?: number; max?: number }>;
  }>,
  socketOverrides?: Readonly<{
    input?: Readonly<{ required?: boolean; defaultValue?: JsonValue }>;
  }>,
): {
  nodeId: ReturnType<typeof makeNodeId>;
  inputId: ReturnType<typeof makeSocketId>;
  outputId: ReturnType<typeof makeSocketId>;
  node: GraphNode;
  sockets: GraphSocket[];
} => {
  const nodeId = makeNodeId(id);
  const inputId = makeSocketId(`${id}.in`);
  const outputId = makeSocketId(`${id}.out`);
  const node: GraphNode = {
    id: nodeId,
    type: "test",
    position: { x: 0, y: 0 },
    params: {},
    inputs: [inputId],
    outputs: [outputId],
  };
  const inputType = socketTypes?.input ?? "float";
  const outputType = socketTypes?.output ?? "float";
  const inputRequired = socketOverrides?.input?.required ?? false;
  const inputDefaultValue = socketOverrides?.input?.defaultValue;
  const sockets: GraphSocket[] = [
    {
      id: inputId,
      nodeId,
      name: "in",
      direction: "input",
      dataType: inputType,
      required: inputRequired,
      defaultValue: inputDefaultValue,
      minConnections: socketLimits?.input?.min,
      maxConnections: socketLimits?.input?.max,
    },
    {
      id: outputId,
      nodeId,
      name: "out",
      direction: "output",
      dataType: outputType,
      required: false,
      minConnections: socketLimits?.output?.min,
      maxConnections: socketLimits?.output?.max,
    },
  ];
  return { nodeId, inputId, outputId, node, sockets };
};

describe("validateGraph", () => {
  it("accepts an acyclic graph", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A");
    const nodeB = createTestNode("B");
    const nodeC = createTestNode("C");

    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectOk(addNode(graph, nodeC.node, nodeC.sockets));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeB.inputId,
      }),
    );
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("B-C"),
        fromSocketId: nodeB.outputId,
        toSocketId: nodeC.inputId,
      }),
    );

    const result = Effect.runSync(Effect.either(validateGraph(graph)));
    expect(Either.isRight(result)).toBe(true);
  });

  it("reports a cycle", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A");
    const nodeB = createTestNode("B");
    const nodeC = createTestNode("C");

    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectOk(addNode(graph, nodeC.node, nodeC.sockets));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeB.inputId,
      }),
    );
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("B-C"),
        fromSocketId: nodeB.outputId,
        toSocketId: nodeC.inputId,
      }),
    );
    const cycleResult = Effect.runSync(
      Effect.either(
        addWire(graph, {
          id: makeWireId("C-A"),
          fromSocketId: nodeC.outputId,
          toSocketId: nodeA.inputId,
        }),
      ),
    );

    expect(Either.isLeft(cycleResult)).toBe(true);
    if (Either.isLeft(cycleResult)) {
      expect(cycleResult.left._tag).toBe("CycleDetected");
      expect(cycleResult.left.path).toEqual([
        nodeC.nodeId,
        nodeA.nodeId,
        nodeB.nodeId,
        nodeC.nodeId,
      ]);
    }
  });

  it("rejects incompatible socket types", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A", { output: "float" });
    const nodeB = createTestNode("B", { input: "vec3" });

    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));

    const result = Effect.runSync(
      Effect.either(
        addWire(graph, {
          id: makeWireId("A-B"),
          fromSocketId: nodeA.outputId,
          toSocketId: nodeB.inputId,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("IncompatibleSocketTypes");
      expect(result.left.fromType).toBe("float");
      expect(result.left.toType).toBe("vec3");
    }
  });

  it("rejects input connections beyond max", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A");
    const nodeB = createTestNode("B");
    const nodeC = createTestNode("C");

    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectOk(addNode(graph, nodeC.node, nodeC.sockets));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeB.inputId,
      }),
    );

    const result = Effect.runSync(
      Effect.either(
        addWire(graph, {
          id: makeWireId("C-B"),
          fromSocketId: nodeC.outputId,
          toSocketId: nodeB.inputId,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("SocketConnectionLimitExceeded");
      expect(result.left.socketId).toBe(nodeB.inputId);
    }
  });

  it("rejects output connections beyond max", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A", undefined, { output: { max: 1 } });
    const nodeB = createTestNode("B");
    const nodeC = createTestNode("C");

    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectOk(addNode(graph, nodeC.node, nodeC.sockets));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeB.inputId,
      }),
    );

    const result = Effect.runSync(
      Effect.either(
        addWire(graph, {
          id: makeWireId("A-C"),
          fromSocketId: nodeA.outputId,
          toSocketId: nodeC.inputId,
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("SocketConnectionLimitExceeded");
      expect(result.left.socketId).toBe(nodeA.outputId);
    }
  });

  it("fails validation when below min connections", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A", undefined, { input: { min: 1 } });

    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));

    const result = Effect.runSync(Effect.either(validateGraph(graph)));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("SocketConnectionBelowMin");
      expect(result.left.socketId).toBe(nodeA.inputId);
    }
  });
});

describe("collectGraphWarnings", () => {
  it("warns on missing required inputs without defaults", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode(
      "A",
      undefined,
      undefined,
      { input: { required: true } },
    );
    const nodeB = createTestNode("B");

    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeB.inputId,
      }),
    );

    const warnings = collectGraphWarnings(graph);
    expect(warnings).toEqual([
      {
        _tag: "MissingRequiredInput",
        nodeId: nodeA.nodeId,
        socketId: nodeA.inputId,
        socketName: "in",
      },
    ]);
  });

  it("does not warn when required input has a default", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode(
      "A",
      undefined,
      undefined,
      { input: { required: true, defaultValue: 0 } },
    );
    const nodeB = createTestNode("B");

    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeB.inputId,
      }),
    );

    const warnings = collectGraphWarnings(graph);
    expect(warnings).toEqual([]);
  });

  it("warns on incompatible socket connections", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A", { output: "float" });
    const nodeB = createTestNode("B", { input: "vec3" });

    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));

    const wire = {
      id: makeWireId("A-B"),
      fromSocketId: nodeA.outputId,
      toSocketId: nodeB.inputId,
    };

    const wires = new Map(graph.wires);
    wires.set(wire.id, wire);

    const outgoing = new Map(graph.outgoing);
    outgoing.set(nodeA.nodeId, new Set([nodeB.nodeId]));
    const incoming = new Map(graph.incoming);
    incoming.set(nodeB.nodeId, new Set([nodeA.nodeId]));

    const nextGraph: typeof graph = {
      graphId: graph.graphId,
      nodes: graph.nodes,
      sockets: graph.sockets,
      wires,
      outgoing,
      incoming,
    };

    const warnings = collectGraphWarnings(nextGraph);
    expect(warnings).toEqual([
      {
        _tag: "IncompatibleSocketTypes",
        wireId: wire.id,
        fromSocketId: wire.fromSocketId,
        toSocketId: wire.toSocketId,
        fromType: "float",
        toType: "vec3",
      },
    ]);
  });

  it("warns on unused nodes", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A");
    const nodeB = createTestNode("B");
    const nodeC = createTestNode("C");

    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectOk(addNode(graph, nodeC.node, nodeC.sockets));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeB.inputId,
      }),
    );

    const warnings = collectGraphWarnings(graph);
    expect(warnings).toEqual([{ _tag: "UnusedNode", nodeId: nodeC.nodeId }]);
  });
});
