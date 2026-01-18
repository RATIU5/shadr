import { Either, Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  createDirtyState,
  isDirty,
  markDirty,
  markDirtyForWireChange,
} from "@shadr/exec-engine";
import {
  addNode,
  addWire,
  createGraph,
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

describe("dirty propagation", () => {
  it("marks downstream nodes as dirty", () => {
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
        id: makeWireId("B-C"),
        fromSocketId: nodeB.outputId,
        toSocketId: nodeC.inputId,
      }),
    );
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("A-D"),
        fromSocketId: nodeA.outputId,
        toSocketId: nodeD.inputId,
      }),
    );

    const dirty = markDirty(graph, createDirtyState(), nodeA.nodeId);

    expect(isDirty(dirty, nodeA.nodeId)).toBe(true);
    expect(isDirty(dirty, nodeB.nodeId)).toBe(true);
    expect(isDirty(dirty, nodeC.nodeId)).toBe(true);
    expect(isDirty(dirty, nodeD.nodeId)).toBe(true);
  });

  it("does not mark upstream nodes as dirty", () => {
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

    const dirty = markDirty(graph, createDirtyState(), nodeC.nodeId);

    expect(isDirty(dirty, nodeC.nodeId)).toBe(true);
    expect(isDirty(dirty, nodeB.nodeId)).toBe(false);
    expect(isDirty(dirty, nodeA.nodeId)).toBe(false);
  });

  it("marks downstream nodes when a wire changes", () => {
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

    const dirty = Effect.runSync(
      markDirtyForWireChange(graph, createDirtyState(), makeWireId("A-B")),
    );

    expect(isDirty(dirty, nodeA.nodeId)).toBe(false);
    expect(isDirty(dirty, nodeB.nodeId)).toBe(true);
    expect(isDirty(dirty, nodeC.nodeId)).toBe(true);
  });
});
