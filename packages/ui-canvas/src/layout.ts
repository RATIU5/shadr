import type {
  Graph,
  GraphNode,
  GraphSocket,
  SocketId,
} from "@shadr/graph-core";

import type { Point, Size } from "./types.js";

/* eslint-disable no-unused-vars -- function types keep args for clarity */
export type NodeLayout = Readonly<{
  width: number;
  minHeight: number;
  headerHeight: number;
  bodyPadding: number;
  socketSpacing: number;
  socketOffsetX: number;
  getNodeTitle?: (node: GraphNode) => string;
  getContentSize?: (node: GraphNode) => Size | null;
  getNodeSizeOverride?: (node: GraphNode) => Size | null;
  getSocketPositionOverride?: (
    node: GraphNode,
    socket: GraphSocket,
    layout: NodeLayout,
  ) => Point | null;
  isRerouteNode?: (node: GraphNode) => boolean;
}>;
/* eslint-enable no-unused-vars */

export const defaultNodeLayout: NodeLayout = {
  width: 180,
  minHeight: 80,
  headerHeight: 24,
  bodyPadding: 12,
  socketSpacing: 18,
  socketOffsetX: 8,
};

export type NodeHeaderToggleBounds = Readonly<{
  x: number;
  y: number;
  size: number;
}>;

const DEFAULT_TOGGLE_SIZE = 12;
const MIN_TOGGLE_SIZE = 8;
const TOGGLE_LEFT_PADDING = 8;

export const getNodeHeaderToggleBounds = (
  layout: NodeLayout,
): NodeHeaderToggleBounds => {
  const size = Math.max(
    MIN_TOGGLE_SIZE,
    Math.min(DEFAULT_TOGGLE_SIZE, layout.headerHeight - 8),
  );
  const x = TOGGLE_LEFT_PADDING;
  const y = (layout.headerHeight - size) / 2;
  return { x, y, size };
};

export const getNodeSize = (node: GraphNode, layout: NodeLayout): Size => {
  const overrideSize = layout.getNodeSizeOverride?.(node) ?? null;
  if (overrideSize) {
    return overrideSize;
  }
  const socketCount = Math.max(node.inputs.length, node.outputs.length, 1);
  const contentSize = layout.getContentSize?.(node) ?? null;
  const socketHeight = socketCount * layout.socketSpacing;
  const innerHeight = Math.max(socketHeight, contentSize?.height ?? 0);
  const height = Math.max(
    layout.minHeight,
    layout.headerHeight + layout.bodyPadding * 2 + innerHeight,
  );
  const width = Math.max(
    layout.width,
    (contentSize?.width ?? 0) + layout.bodyPadding * 2,
  );
  return { width, height };
};

const findSocketIndex = (
  node: GraphNode,
  socket: GraphSocket,
): number | null => {
  const socketIds = socket.direction === "input" ? node.inputs : node.outputs;
  const index = socketIds.indexOf(socket.id);
  return index >= 0 ? index : null;
};

export const getSocketPosition = (
  graph: Graph,
  socketId: SocketId,
  layout: NodeLayout,
): Point | null => {
  const socket = graph.sockets.get(socketId);
  if (!socket) {
    return null;
  }
  const node = graph.nodes.get(socket.nodeId);
  if (!node) {
    return null;
  }
  const overridePosition =
    layout.getSocketPositionOverride?.(node, socket, layout) ?? null;
  if (overridePosition) {
    return overridePosition;
  }
  const socketIndex = findSocketIndex(node, socket);
  if (socketIndex === null) {
    return null;
  }
  const { width } = getNodeSize(node, layout);
  const startY =
    node.position.y +
    layout.headerHeight +
    layout.bodyPadding +
    layout.socketSpacing / 2;
  const y = startY + socketIndex * layout.socketSpacing;
  const x =
    node.position.x +
    (socket.direction === "input"
      ? layout.socketOffsetX
      : width - layout.socketOffsetX);
  return { x, y };
};
