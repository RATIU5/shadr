import { describe, expect, it } from "vitest";

import type { GraphNode, GraphSocket } from "@shadr/graph-core";
import type { NodeId } from "@shadr/shared";
import { makeFrameId, makeNodeId, makeSocketId, makeWireId } from "@shadr/shared";

import { createEditorStore } from "../src/editor/store";

const createOutputNode = (nodeId: NodeId): {
  node: GraphNode;
  sockets: GraphSocket[];
} => {
  const socketId = makeSocketId(`${nodeId}.out`);
  return {
    node: {
      id: nodeId,
      type: "test",
      position: { x: 0, y: 0 },
      params: {},
      inputs: [],
      outputs: [socketId],
    },
    sockets: [
      {
        id: socketId,
        nodeId,
        name: "out",
        direction: "output",
        dataType: "float",
        required: false,
      },
    ],
  };
};

describe("editor store history and selection", () => {
  it("tracks undo/redo for graph commands", () => {
    const store = createEditorStore();
    const { node, sockets } = createOutputNode(makeNodeId("node-1"));

    expect(store.canUndo()).toBe(false);
    expect(store.applyGraphCommand({ kind: "add-node", node, sockets })).toBe(
      true,
    );
    expect(store.graph().nodes.has(node.id)).toBe(true);
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);

    store.undo();
    expect(store.graph().nodes.has(node.id)).toBe(false);
    expect(store.canRedo()).toBe(true);

    store.redo();
    expect(store.graph().nodes.has(node.id)).toBe(true);
    expect(store.canUndo()).toBe(true);
  });

  it("batches history entries and undoes them together", () => {
    const store = createEditorStore();
    const first = createOutputNode(makeNodeId("node-1"));
    const second = createOutputNode(makeNodeId("node-2"));

    store.beginHistoryBatch("add-two");
    store.applyGraphCommand({ kind: "add-node", ...first });
    store.applyGraphCommand({ kind: "add-node", ...second });
    store.commitHistoryBatch();

    expect(store.graph().nodes.size).toBe(2);
    store.undo();
    expect(store.graph().nodes.size).toBe(0);
  });

  it("clears other selections when setting a new selection", () => {
    const store = createEditorStore();
    store.setFrameSelection(new Set([makeFrameId("frame-1")]));
    store.setWireSelection(new Set([makeWireId("wire-1")]));

    const nodeId = makeNodeId("node-1");
    store.setNodeSelection(new Set([nodeId]));

    expect(store.selectedNodes().has(nodeId)).toBe(true);
    expect(store.selectedFrames().size).toBe(0);
    expect(store.selectedWires().size).toBe(0);
  });
});
