import { Either, Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  addNode,
  addWire,
  createGraph,
  type GraphEffect,
  type GraphNode,
  type GraphSocket,
  topoSortExecutionSubgraphByOutputSockets,
  topoSort,
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
  const sockets: GraphSocket[] = [
    {
      id: inputId,
      nodeId,
      name: "in",
      direction: "input",
      dataType: "float",
      required: false,
    },
    {
      id: outputId,
      nodeId,
      name: "out",
      direction: "output",
      dataType: "float",
      required: false,
    },
  ];
  return { nodeId, inputId, outputId, node, sockets };
};

describe("topoSort", () => {
  it("returns a deterministic topological order", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A");
    const nodeB = createTestNode("B");
    const nodeC = createTestNode("C");
    const nodeD = createTestNode("D");

    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectOk(addNode(graph, nodeC.node, nodeC.sockets));
    graph = expectOk(addNode(graph, nodeD.node, nodeD.sockets));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeB.inputId,
      }),
    );
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("A-C"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeC.inputId,
      }),
    );
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("B-D"),
        fromSocketId: nodeB.outputId,
        toSocketId: nodeD.inputId,
      }),
    );
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("C-D"),
        fromSocketId: nodeC.outputId,
        toSocketId: nodeD.inputId,
      }),
    );

    const result = Effect.runSync(Effect.either(topoSort(graph)));
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toEqual([
        nodeA.nodeId,
        nodeB.nodeId,
        nodeC.nodeId,
        nodeD.nodeId,
      ]);
    }
  });

  it("returns a deterministic topological order for the execution subgraph", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A");
    const nodeB = createTestNode("B");
    const nodeC = createTestNode("C");
    const nodeD = createTestNode("D");
    const nodeE = createTestNode("E");

    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));
    graph = expectOk(addNode(graph, nodeB.node, nodeB.sockets));
    graph = expectOk(addNode(graph, nodeC.node, nodeC.sockets));
    graph = expectOk(addNode(graph, nodeD.node, nodeD.sockets));
    graph = expectOk(addNode(graph, nodeE.node, nodeE.sockets));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("A-B"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeB.inputId,
      }),
    );
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("A-C"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeC.inputId,
      }),
    );
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("B-D"),
        fromSocketId: nodeB.outputId,
        toSocketId: nodeD.inputId,
      }),
    );
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("C-D"),
        fromSocketId: nodeC.outputId,
        toSocketId: nodeD.inputId,
      }),
    );

    const result = Effect.runSync(
      Effect.either(
        topoSortExecutionSubgraphByOutputSockets(graph, [nodeD.outputId]),
      ),
    );
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toEqual([
        nodeA.nodeId,
        nodeB.nodeId,
        nodeC.nodeId,
        nodeD.nodeId,
      ]);
      expect(result.right).not.toContain(nodeE.nodeId);
    }
  });
});
