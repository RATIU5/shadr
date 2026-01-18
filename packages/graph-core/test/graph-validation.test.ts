import { Either, Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  addNode,
  addWire,
  createGraph,
  type GraphEffect,
  type GraphNode,
  type GraphSocket,
  validateGraph,
} from "@shadr/graph-core";
import {
  makeGraphId,
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
  const sockets: GraphSocket[] = [
    {
      id: inputId,
      nodeId,
      name: "in",
      direction: "input",
      dataType: inputType,
      required: false,
    },
    {
      id: outputId,
      nodeId,
      name: "out",
      direction: "output",
      dataType: outputType,
      required: false,
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
});
