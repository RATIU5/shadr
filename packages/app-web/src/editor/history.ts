import type {
  Graph,
  GraphEffect,
  GraphNode,
  GraphSocket,
  GraphWire,
  NodeId,
  NodePositionUpdate,
  SocketId,
  WireId,
} from "@shadr/graph-core";
import {
  addNode,
  addWire,
  moveNodes,
  removeNode,
  removeWire,
  updateParam,
} from "@shadr/graph-core";
import type { JsonValue } from "@shadr/shared";

export type GraphCommand =
  | Readonly<{
      kind: "add-node";
      node: GraphNode;
      sockets: ReadonlyArray<GraphSocket>;
    }>
  | Readonly<{
      kind: "remove-node";
      node: GraphNode;
      sockets: ReadonlyArray<GraphSocket>;
      wires: ReadonlyArray<GraphWire>;
    }>
  | Readonly<{
      kind: "add-wire";
      wire: GraphWire;
    }>
  | Readonly<{
      kind: "remove-wire";
      wire: GraphWire;
    }>
  | Readonly<{
      kind: "move-nodes";
      before: ReadonlyArray<NodePositionUpdate>;
      after: ReadonlyArray<NodePositionUpdate>;
    }>
  | Readonly<{
      kind: "update-param";
      nodeId: NodeId;
      key: string;
      before: JsonValue;
      after: JsonValue;
    }>;

export type HistoryEntry = Readonly<{
  label?: string;
  commands: ReadonlyArray<GraphCommand>;
}>;

const isJsonValueEqual = (left: JsonValue, right: JsonValue): boolean => {
  if (left === right) {
    return true;
  }
  if (left === null || right === null) {
    return left === right;
  }
  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!isJsonValueEqual(left[index] ?? null, right[index] ?? null)) {
        return false;
      }
    }
    return true;
  }
  if (typeof left === "object" && typeof right === "object") {
    const leftRecord = left as Record<string, JsonValue>;
    const rightRecord = right as Record<string, JsonValue>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(rightRecord, key)) {
        return false;
      }
      if (
        !isJsonValueEqual(leftRecord[key] ?? null, rightRecord[key] ?? null)
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
};

const positionsEqual = (
  left: NodePositionUpdate,
  right: NodePositionUpdate,
): boolean =>
  left.nodeId === right.nodeId &&
  left.position.x === right.position.x &&
  left.position.y === right.position.y;

export const isNoopCommand = (command: GraphCommand): boolean => {
  if (command.kind === "update-param") {
    return isJsonValueEqual(command.before, command.after);
  }
  if (command.kind === "move-nodes") {
    if (command.before.length !== command.after.length) {
      return false;
    }
    const afterByNode = new Map<NodeId, NodePositionUpdate>();
    for (const update of command.after) {
      afterByNode.set(update.nodeId, update);
    }
    for (const update of command.before) {
      const next = afterByNode.get(update.nodeId);
      if (!next || !positionsEqual(update, next)) {
        return false;
      }
    }
    return true;
  }
  return false;
};

export const applyCommandEffect = (
  graph: Graph,
  command: GraphCommand,
): GraphEffect<Graph> => {
  switch (command.kind) {
    case "add-node":
      return addNode(graph, command.node, command.sockets);
    case "remove-node":
      return removeNode(graph, command.node.id);
    case "add-wire":
      return addWire(graph, command.wire);
    case "remove-wire":
      return removeWire(graph, command.wire.id);
    case "move-nodes":
      return moveNodes(graph, command.after);
    case "update-param":
      return updateParam(graph, command.nodeId, command.key, command.after);
  }
};

export const getUndoCommands = (
  command: GraphCommand,
): ReadonlyArray<GraphCommand> => {
  switch (command.kind) {
    case "add-node":
      return [
        {
          kind: "remove-node",
          node: command.node,
          sockets: command.sockets,
          wires: [],
        },
      ];
    case "remove-node":
      return [
        { kind: "add-node", node: command.node, sockets: command.sockets },
        ...command.wires.map((wire) => ({ kind: "add-wire", wire })),
      ];
    case "add-wire":
      return [{ kind: "remove-wire", wire: command.wire }];
    case "remove-wire":
      return [{ kind: "add-wire", wire: command.wire }];
    case "move-nodes":
      return [
        {
          kind: "move-nodes",
          before: command.after,
          after: command.before,
        },
      ];
    case "update-param":
      return [
        {
          kind: "update-param",
          nodeId: command.nodeId,
          key: command.key,
          before: command.after,
          after: command.before,
        },
      ];
  }
};

export const createRemoveNodeCommand = (
  graph: Graph,
  nodeId: NodeId,
): GraphCommand | null => {
  const node = graph.nodes.get(nodeId);
  if (!node) {
    return null;
  }
  const socketIds = new Set<SocketId>([...node.inputs, ...node.outputs]);
  const sockets: GraphSocket[] = [];
  for (const socketId of socketIds) {
    const socket = graph.sockets.get(socketId);
    if (!socket) {
      return null;
    }
    sockets.push(socket);
  }
  const wires: GraphWire[] = [];
  for (const wire of graph.wires.values()) {
    if (socketIds.has(wire.fromSocketId) || socketIds.has(wire.toSocketId)) {
      wires.push(wire);
    }
  }
  return {
    kind: "remove-node",
    node,
    sockets,
    wires,
  };
};

export const createRemoveWireCommand = (
  graph: Graph,
  wireId: WireId,
): GraphCommand | null => {
  const wire = graph.wires.get(wireId);
  if (!wire) {
    return null;
  }
  return { kind: "remove-wire", wire };
};

export const createMoveNodesCommand = (
  before: ReadonlyArray<NodePositionUpdate>,
  after: ReadonlyArray<NodePositionUpdate>,
): GraphCommand => ({
  kind: "move-nodes",
  before,
  after,
});

export const createUpdateParamCommand = (
  nodeId: NodeId,
  key: string,
  before: JsonValue,
  after: JsonValue,
): GraphCommand => ({
  kind: "update-param",
  nodeId,
  key,
  before,
  after,
});

export const commandAffectsExecution = (command: GraphCommand): boolean =>
  ["add-wire", "remove-wire", "remove-node", "update-param"].includes(
    command.kind,
  );
