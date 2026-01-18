import type {
  Graph,
  GraphNode,
  GraphSocket,
  SocketId,
} from "@shadr/graph-core";

import type { Point, Size } from "./types.js";

export type NodeLayout = Readonly<{
  width: number;
  minHeight: number;
  headerHeight: number;
  bodyPadding: number;
  socketSpacing: number;
  socketOffsetX: number;
}>;

export const defaultNodeLayout: NodeLayout = {
  width: 180,
  minHeight: 80,
  headerHeight: 24,
  bodyPadding: 12,
  socketSpacing: 18,
  socketOffsetX: 8,
};

export const getNodeSize = (node: GraphNode, layout: NodeLayout): Size => {
  const socketCount = Math.max(node.inputs.length, node.outputs.length, 1);
  const contentHeight =
    layout.headerHeight +
    layout.bodyPadding * 2 +
    socketCount * layout.socketSpacing;
  const height = Math.max(layout.minHeight, contentHeight);
  return { width: layout.width, height };
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
  const socketIndex = findSocketIndex(node, socket);
  if (socketIndex === null) {
    return null;
  }
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
      : layout.width - layout.socketOffsetX);
  return { x, y };
};
