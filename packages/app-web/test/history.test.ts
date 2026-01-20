import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { Graph, GraphNode, GraphSocket, GraphWire } from "@shadr/graph-core";
import { addNode, addWire, createGraph } from "@shadr/graph-core";
import type { FrameId, NodeId, SocketId } from "@shadr/shared";
import {
  makeFrameId,
  makeGraphId,
  makeNodeId,
  makeSocketId,
  makeWireId,
} from "@shadr/shared";

import type { GraphCommand } from "../src/editor/history";
import {
  createRemoveNodeCommand,
  getUndoCommands,
  isNoopCommand,
} from "../src/editor/history";

const createOutputNode = (nodeId: NodeId): {
  node: GraphNode;
  sockets: GraphSocket[];
} => {
  const socketId = makeSocketId(`${nodeId}.out`);
  const node: GraphNode = {
    id: nodeId,
    type: "test",
    position: { x: 0, y: 0 },
    params: {},
    inputs: [],
    outputs: [socketId],
  };
  const sockets: GraphSocket[] = [
    {
      id: socketId,
      nodeId,
      name: "out",
      direction: "output",
      dataType: "float",
      required: false,
    },
  ];
  return { node, sockets };
};

const createInputNode = (nodeId: NodeId): {
  node: GraphNode;
  sockets: GraphSocket[];
} => {
  const socketId = makeSocketId(`${nodeId}.in`);
  const node: GraphNode = {
    id: nodeId,
    type: "test",
    position: { x: 0, y: 0 },
    params: {},
    inputs: [socketId],
    outputs: [],
  };
  const sockets: GraphSocket[] = [
    {
      id: socketId,
      nodeId,
      name: "in",
      direction: "input",
      dataType: "float",
      required: true,
    },
  ];
  return { node, sockets };
};

const applyGraph = (effect: ReturnType<typeof addNode>): Graph =>
  Effect.runSync(effect);

describe("history helpers", () => {
  it("treats update-param, move, and frame updates as no-ops when identical", () => {
    const updateParam: GraphCommand = {
      kind: "update-param",
      nodeId: makeNodeId("node-1"),
      key: "value",
      before: 1,
      after: 1,
    };
    expect(isNoopCommand(updateParam)).toBe(true);

    const moveNodes: GraphCommand = {
      kind: "move-nodes",
      before: [{ nodeId: makeNodeId("node-1"), position: { x: 0, y: 0 } }],
      after: [{ nodeId: makeNodeId("node-1"), position: { x: 0, y: 0 } }],
    };
    expect(isNoopCommand(moveNodes)).toBe(true);

    const frameId: FrameId = makeFrameId("frame-1");
    const frame = {
      id: frameId,
      title: "Frame",
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
    };
    const updateFrame: GraphCommand = {
      kind: "update-frame",
      before: frame,
      after: frame,
    };
    expect(isNoopCommand(updateFrame)).toBe(true);
  });

  it("captures undo commands for node removals with wires", () => {
    const nodeId = makeNodeId("node-1");
    const wireId = makeWireId("wire-1");
    const command: GraphCommand = {
      kind: "remove-node",
      ...createOutputNode(nodeId),
      wires: [
        {
          id: wireId,
          fromSocketId: makeSocketId(`${nodeId}.out`),
          toSocketId: makeSocketId("node-2.in"),
        },
      ],
    };
    const undo = getUndoCommands(command);
    expect(undo[0]?.kind).toBe("add-node");
    expect(undo.some((entry) => entry.kind === "add-wire")).toBe(true);
  });

  it("collects sockets and wires for remove-node commands", () => {
    let graph = createGraph(makeGraphId("graph"));
    const first = createOutputNode(makeNodeId("node-1"));
    const second = createInputNode(makeNodeId("node-2"));
    graph = applyGraph(addNode(graph, first.node, first.sockets));
    graph = applyGraph(addNode(graph, second.node, second.sockets));

    const wire: GraphWire = {
      id: makeWireId("wire-1"),
      fromSocketId: first.sockets[0].id,
      toSocketId: second.sockets[0].id,
    };
    graph = Effect.runSync(addWire(graph, wire));

    const command = createRemoveNodeCommand(graph, first.node.id);
    if (!command || command.kind !== "remove-node") {
      throw new Error("Expected remove-node command");
    }
    expect(command.sockets).toHaveLength(1);
    expect(command.wires).toHaveLength(1);
  });
});
