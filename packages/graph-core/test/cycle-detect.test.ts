import { Either, Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  addNode,
  addWire,
  createGraph,
  detectCycle,
  type Graph,
  type GraphEffect,
  type GraphNode,
  type GraphSocket,
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

const addWireUnchecked = (
  graph: Graph,
  wire: { id: ReturnType<typeof makeWireId>; fromSocketId: GraphSocket["id"]; toSocketId: GraphSocket["id"] },
): Graph => {
  const fromSocket = graph.sockets.get(wire.fromSocketId);
  const toSocket = graph.sockets.get(wire.toSocketId);
  if (!fromSocket || !toSocket) {
    throw new Error("Missing socket for unchecked wire add");
  }

  const wires = new Map(graph.wires);
  wires.set(wire.id, wire);

  const outgoing = new Map(graph.outgoing);
  const incoming = new Map(graph.incoming);

  const nextOutgoing = new Set(outgoing.get(fromSocket.nodeId) ?? []);
  nextOutgoing.add(toSocket.nodeId);
  outgoing.set(fromSocket.nodeId, nextOutgoing);

  const nextIncoming = new Set(incoming.get(toSocket.nodeId) ?? []);
  nextIncoming.add(fromSocket.nodeId);
  incoming.set(toSocket.nodeId, nextIncoming);

  return {
    graphId: graph.graphId,
    nodes: graph.nodes,
    sockets: graph.sockets,
    wires,
    frames: graph.frames,
    outgoing,
    incoming,
  };
};

describe("detectCycle", () => {
  it("returns null for DAGs", () => {
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

    expect(detectCycle(graph)).toBeNull();
  });

  it("returns the first detected cycle path", () => {
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
    graph = addWireUnchecked(graph, {
      id: makeWireId("C-A"),
      fromSocketId: nodeC.outputId,
      toSocketId: nodeA.inputId,
    });

    expect(detectCycle(graph)).toEqual([
      nodeA.nodeId,
      nodeB.nodeId,
      nodeC.nodeId,
      nodeA.nodeId,
    ]);
  });
});
