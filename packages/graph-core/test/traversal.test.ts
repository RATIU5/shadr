import { Either, Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  addNode,
  addWire,
  connectedComponents,
  createGraph,
  downstreamClosure,
  executionSubgraphByOutputSockets,
  type GraphEffect,
  type GraphNode,
  type GraphSocket,
  upstreamClosure,
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

const sortIds = <T extends string>(values: ReadonlyArray<T>): T[] =>
  [...values].sort((left, right) => left.localeCompare(right));

describe("traversal utilities", () => {
  it("computes upstream and downstream closures", () => {
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

    const upstream = expectOk(upstreamClosure(graph, [nodeC.nodeId]));
    const downstream = expectOk(downstreamClosure(graph, [nodeA.nodeId]));

    expect(upstream).toEqual(
      sortIds([nodeA.nodeId, nodeB.nodeId, nodeC.nodeId]),
    );
    expect(downstream).toEqual(
      sortIds([nodeA.nodeId, nodeB.nodeId, nodeC.nodeId]),
    );
  });

  it("computes connected components", () => {
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
        id: makeWireId("D-E"),
        fromSocketId: nodeD.outputId,
        toSocketId: nodeE.inputId,
      }),
    );

    const components = expectOk(connectedComponents(graph));

    expect(components).toEqual([
      sortIds([nodeA.nodeId, nodeB.nodeId]),
      [nodeC.nodeId],
      sortIds([nodeD.nodeId, nodeE.nodeId]),
    ]);
  });

  it("derives execution subgraph from output sockets", () => {
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
        id: makeWireId("B-C"),
        fromSocketId: nodeB.outputId,
        toSocketId: nodeC.inputId,
      }),
    );
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("D-E"),
        fromSocketId: nodeD.outputId,
        toSocketId: nodeE.inputId,
      }),
    );

    const result = expectOk(
      executionSubgraphByOutputSockets(graph, [nodeC.outputId]),
    );

    expect(sortIds([...result.nodes])).toEqual(
      sortIds([nodeA.nodeId, nodeB.nodeId, nodeC.nodeId]),
    );
    expect(sortIds([...result.wires])).toEqual(
      sortIds([makeWireId("A-B"), makeWireId("B-C")]),
    );
    expect(sortIds([...result.sockets])).toEqual(
      sortIds([
        nodeA.inputId,
        nodeA.outputId,
        nodeB.inputId,
        nodeB.outputId,
        nodeC.inputId,
        nodeC.outputId,
      ]),
    );
    expect(sortIds([...result.outputSockets])).toEqual([nodeC.outputId]);
  });

  it("rejects non-output sockets for execution subgraph", () => {
    let graph = createGraph(makeGraphId("graph"));
    const nodeA = createTestNode("A");
    graph = expectOk(addNode(graph, nodeA.node, nodeA.sockets));

    const result = Effect.runSync(
      Effect.either(executionSubgraphByOutputSockets(graph, [nodeA.inputId])),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("InvalidSocketDirection");
      expect(result.left.socketId).toBe(nodeA.inputId);
    }
  });
});
