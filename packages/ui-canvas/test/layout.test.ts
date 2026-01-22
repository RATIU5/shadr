import { Either, Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { GraphNode, GraphSocket } from "@shadr/graph-core";
import { addNode, createGraph, type GraphEffect } from "@shadr/graph-core";
import { makeGraphId, makeNodeId, makeSocketId } from "@shadr/shared";

import {
  defaultNodeLayout,
  getNodeHeaderToggleBounds,
  getNodeSize,
  getSocketPosition,
  type NodeLayout,
} from "@shadr/ui-canvas";

const expectOk = <T>(effect: GraphEffect<T>): T => {
  const result = Effect.runSync(Effect.either(effect));
  if (Either.isLeft(result)) {
    throw new Error(`Unexpected error: ${result.left._tag}`);
  }
  return result.right;
};

const createTestNode = (
  id: string,
  position: Readonly<{ x: number; y: number }>,
  inputCount: number,
  outputCount: number,
): {
  node: GraphNode;
  sockets: GraphSocket[];
  inputIds: ReturnType<typeof makeSocketId>[];
  outputIds: ReturnType<typeof makeSocketId>[];
} => {
  const nodeId = makeNodeId(id);
  const inputIds: ReturnType<typeof makeSocketId>[] = [];
  const outputIds: ReturnType<typeof makeSocketId>[] = [];
  const sockets: GraphSocket[] = [];

  for (let i = 0; i < inputCount; i += 1) {
    const socketId = makeSocketId(`${id}.in.${i}`);
    inputIds.push(socketId);
    sockets.push({
      id: socketId,
      nodeId,
      name: `in${i}`,
      direction: "input",
      dataType: "float",
      required: false,
    });
  }

  for (let i = 0; i < outputCount; i += 1) {
    const socketId = makeSocketId(`${id}.out.${i}`);
    outputIds.push(socketId);
    sockets.push({
      id: socketId,
      nodeId,
      name: `out${i}`,
      direction: "output",
      dataType: "float",
      required: false,
    });
  }

  return {
    node: {
      id: nodeId,
      type: "test",
      position,
      params: {},
      inputs: inputIds,
      outputs: outputIds,
    },
    sockets,
    inputIds,
    outputIds,
  };
};

describe("layout helpers", () => {
  it("derives node size from sockets and content", () => {
    const { node } = createTestNode("A", { x: 0, y: 0 }, 2, 4);
    const layout: NodeLayout = {
      ...defaultNodeLayout,
      getContentSize: () => ({ width: 260, height: 120 }),
    };

    const size = getNodeSize(node, layout);

    expect(size.width).toBe(284);
    expect(size.height).toBe(168);
  });

  it("respects size overrides when provided", () => {
    const { node } = createTestNode("B", { x: 0, y: 0 }, 1, 1);
    const layout: NodeLayout = {
      ...defaultNodeLayout,
      getNodeSizeOverride: () => ({ width: 42, height: 55 }),
    };

    const size = getNodeSize(node, layout);

    expect(size.width).toBe(42);
    expect(size.height).toBe(55);
  });

  it("keeps header toggle bounds inside the header area", () => {
    const layout: NodeLayout = { ...defaultNodeLayout, headerHeight: 16 };
    const bounds = getNodeHeaderToggleBounds(layout);

    expect(bounds.size).toBeGreaterThanOrEqual(8);
    expect(bounds.size).toBeLessThanOrEqual(layout.headerHeight);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.size).toBeLessThanOrEqual(layout.headerHeight);
  });

  it("computes socket positions and handles missing sockets", () => {
    const graphId = makeGraphId("graph");
    let graph = createGraph(graphId);
    const { node, sockets, inputIds, outputIds } = createTestNode(
      "C",
      { x: 10, y: 20 },
      2,
      1,
    );
    graph = expectOk(addNode(graph, node, sockets));

    const inputPosition = getSocketPosition(graph, inputIds[1]!, defaultNodeLayout);
    expect(inputPosition).toEqual({ x: 10, y: 83 });

    const outputPosition = getSocketPosition(
      graph,
      outputIds[0]!,
      defaultNodeLayout,
    );
    expect(outputPosition).toEqual({ x: 190, y: 65 });

    const missing = getSocketPosition(graph, makeSocketId("missing"), defaultNodeLayout);
    expect(missing).toBeNull();
  });
});
