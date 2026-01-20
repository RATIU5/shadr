import type {
  FrameId,
  FramePositionUpdate,
  Graph,
  GraphEffect,
  GraphFrame,
  GraphNode,
  GraphSocket,
  GraphWire,
  NodeId,
  NodePositionUpdate,
  SocketId,
  WireId,
} from "@shadr/graph-core";
import {
  addFrame,
  addNode,
  addWire,
  moveFrames,
  moveNodes,
  removeFrame,
  removeNode,
  removeWire,
  replaceNodeIo,
  updateFrame,
  updateNodeIo,
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
      kind: "add-frame";
      frame: GraphFrame;
    }>
  | Readonly<{
      kind: "remove-node";
      node: GraphNode;
      sockets: ReadonlyArray<GraphSocket>;
      wires: ReadonlyArray<GraphWire>;
    }>
  | Readonly<{
      kind: "remove-frame";
      frame: GraphFrame;
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
      kind: "move-frames";
      before: ReadonlyArray<FramePositionUpdate>;
      after: ReadonlyArray<FramePositionUpdate>;
    }>
  | Readonly<{
      kind: "update-frame";
      before: GraphFrame;
      after: GraphFrame;
    }>
  | Readonly<{
      kind: "update-param";
      nodeId: NodeId;
      key: string;
      before: JsonValue;
      after: JsonValue;
    }>
  | Readonly<{
      kind: "update-node-io";
      before: Readonly<{
        node: GraphNode;
        sockets: ReadonlyArray<GraphSocket>;
      }>;
      after: Readonly<{ node: GraphNode; sockets: ReadonlyArray<GraphSocket> }>;
    }>
  | Readonly<{
      kind: "replace-node-io";
      before: Readonly<{
        node: GraphNode;
        sockets: ReadonlyArray<GraphSocket>;
      }>;
      after: Readonly<{ node: GraphNode; sockets: ReadonlyArray<GraphSocket> }>;
      removedWires: ReadonlyArray<GraphWire>;
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

const framePositionsEqual = (
  left: FramePositionUpdate,
  right: FramePositionUpdate,
): boolean =>
  left.frameId === right.frameId &&
  left.position.x === right.position.x &&
  left.position.y === right.position.y;

export const isNoopCommand = (command: GraphCommand): boolean => {
  if (command.kind === "update-param") {
    return isJsonValueEqual(command.before, command.after);
  }
  if (command.kind === "update-node-io") {
    return (
      isNodeEqual(command.before.node, command.after.node) &&
      areSocketsEqual(command.before.sockets, command.after.sockets)
    );
  }
  if (command.kind === "replace-node-io") {
    return (
      isNodeEqual(command.before.node, command.after.node) &&
      areSocketsEqual(command.before.sockets, command.after.sockets)
    );
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
  if (command.kind === "move-frames") {
    if (command.before.length !== command.after.length) {
      return false;
    }
    const afterByFrame = new Map<FrameId, FramePositionUpdate>();
    for (const update of command.after) {
      afterByFrame.set(update.frameId, update);
    }
    for (const update of command.before) {
      const next = afterByFrame.get(update.frameId);
      if (!next || !framePositionsEqual(update, next)) {
        return false;
      }
    }
    return true;
  }
  if (command.kind === "update-frame") {
    return isFrameEqual(command.before, command.after);
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
    case "add-frame":
      return addFrame(graph, command.frame);
    case "remove-node":
      return removeNode(graph, command.node.id);
    case "remove-frame":
      return removeFrame(graph, command.frame.id);
    case "add-wire":
      return addWire(graph, command.wire);
    case "remove-wire":
      return removeWire(graph, command.wire.id);
    case "move-nodes":
      return moveNodes(graph, command.after);
    case "move-frames":
      return moveFrames(graph, command.after);
    case "update-frame":
      return updateFrame(graph, command.after.id, command.after);
    case "update-param":
      return updateParam(graph, command.nodeId, command.key, command.after);
    case "update-node-io":
      return updateNodeIo(graph, command.after.node, command.after.sockets);
    case "replace-node-io":
      return replaceNodeIo(graph, command.after.node, command.after.sockets);
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
    case "add-frame":
      return [{ kind: "remove-frame", frame: command.frame }];
    case "remove-node":
      return [
        { kind: "add-node", node: command.node, sockets: command.sockets },
        ...command.wires.map(
          (wire): GraphCommand => ({ kind: "add-wire", wire }),
        ),
      ];
    case "remove-frame":
      return [{ kind: "add-frame", frame: command.frame }];
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
    case "move-frames":
      return [
        {
          kind: "move-frames",
          before: command.after,
          after: command.before,
        },
      ];
    case "update-frame":
      return [
        {
          kind: "update-frame",
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
    case "update-node-io":
      return [
        {
          kind: "update-node-io",
          before: command.after,
          after: command.before,
        },
      ];
    case "replace-node-io":
      return [
        {
          kind: "replace-node-io",
          before: command.after,
          after: command.before,
          removedWires: command.removedWires,
        },
        ...command.removedWires.map(
          (wire): GraphCommand => ({ kind: "add-wire", wire }),
        ),
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

export const createRemoveFrameCommand = (
  graph: Graph,
  frameId: FrameId,
): GraphCommand | null => {
  const frame = graph.frames.get(frameId);
  if (!frame) {
    return null;
  }
  return { kind: "remove-frame", frame };
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

export const createMoveFramesCommand = (
  before: ReadonlyArray<FramePositionUpdate>,
  after: ReadonlyArray<FramePositionUpdate>,
): GraphCommand => ({
  kind: "move-frames",
  before,
  after,
});

export const createUpdateFrameCommand = (
  before: GraphFrame,
  after: GraphFrame,
): GraphCommand => ({
  kind: "update-frame",
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

export const createUpdateNodeIoCommand = (
  before: Readonly<{ node: GraphNode; sockets: ReadonlyArray<GraphSocket> }>,
  after: Readonly<{ node: GraphNode; sockets: ReadonlyArray<GraphSocket> }>,
): GraphCommand => ({
  kind: "update-node-io",
  before,
  after,
});

export const commandAffectsExecution = (command: GraphCommand): boolean =>
  [
    "add-wire",
    "remove-wire",
    "remove-node",
    "update-param",
    "update-node-io",
    "replace-node-io",
  ].includes(command.kind);

export const createReplaceNodeIoCommand = (
  graph: Graph,
  before: Readonly<{ node: GraphNode; sockets: ReadonlyArray<GraphSocket> }>,
  after: Readonly<{ node: GraphNode; sockets: ReadonlyArray<GraphSocket> }>,
): GraphCommand => {
  const beforeSocketIds = new Set<SocketId>([
    ...before.node.inputs,
    ...before.node.outputs,
  ]);
  const afterSocketIds = new Set<SocketId>([
    ...after.node.inputs,
    ...after.node.outputs,
  ]);
  const removedSocketIds = new Set<SocketId>();
  for (const socketId of beforeSocketIds) {
    if (!afterSocketIds.has(socketId)) {
      removedSocketIds.add(socketId);
    }
  }
  const removedWires: GraphWire[] = [];
  for (const wire of graph.wires.values()) {
    if (
      removedSocketIds.has(wire.fromSocketId) ||
      removedSocketIds.has(wire.toSocketId)
    ) {
      removedWires.push(wire);
    }
  }
  return {
    kind: "replace-node-io",
    before,
    after,
    removedWires,
  };
};

const isNodeEqual = (left: GraphNode, right: GraphNode): boolean => {
  if (
    left.id !== right.id ||
    left.type !== right.type ||
    left.position.x !== right.position.x ||
    left.position.y !== right.position.y ||
    !isJsonValueEqual(left.params, right.params)
  ) {
    return false;
  }
  if (!arrayEqual(left.inputs, right.inputs)) {
    return false;
  }
  if (!arrayEqual(left.outputs, right.outputs)) {
    return false;
  }
  return true;
};

const isFrameEqual = (left: GraphFrame, right: GraphFrame): boolean => {
  if (
    left.id !== right.id ||
    left.title !== right.title ||
    left.description !== right.description ||
    left.color !== right.color ||
    left.collapsed !== right.collapsed ||
    left.position.x !== right.position.x ||
    left.position.y !== right.position.y ||
    left.size.width !== right.size.width ||
    left.size.height !== right.size.height
  ) {
    return false;
  }
  if (!arrayEqual(left.exposedInputs ?? [], right.exposedInputs ?? [])) {
    return false;
  }
  if (!arrayEqual(left.exposedOutputs ?? [], right.exposedOutputs ?? [])) {
    return false;
  }
  return true;
};

const arrayEqual = (
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>,
) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const areSocketsEqual = (
  left: ReadonlyArray<GraphSocket>,
  right: ReadonlyArray<GraphSocket>,
): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  const rightById = new Map<SocketId, GraphSocket>();
  for (const socket of right) {
    rightById.set(socket.id, socket);
  }
  for (const socket of left) {
    const candidate = rightById.get(socket.id);
    if (!candidate || !isSocketEqual(socket, candidate)) {
      return false;
    }
  }
  return true;
};

const isLabelSettingsEqual = (
  left: GraphSocket["labelSettings"],
  right: GraphSocket["labelSettings"],
): boolean => {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  if (left.visible !== right.visible) {
    return false;
  }
  if (left.position !== right.position) {
    return false;
  }
  const leftOffset = left.offset;
  const rightOffset = right.offset;
  if (!leftOffset && !rightOffset) {
    return true;
  }
  if (!leftOffset || !rightOffset) {
    return false;
  }
  return leftOffset.x === rightOffset.x && leftOffset.y === rightOffset.y;
};

const isSocketMetadataEqual = (
  left: GraphSocket["metadata"],
  right: GraphSocket["metadata"],
): boolean => {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.units === right.units &&
    left.min === right.min &&
    left.max === right.max &&
    left.step === right.step &&
    left.format === right.format
  );
};

const isSocketEqual = (left: GraphSocket, right: GraphSocket): boolean => {
  if (
    left.id !== right.id ||
    left.nodeId !== right.nodeId ||
    left.name !== right.name ||
    left.label !== right.label ||
    left.direction !== right.direction ||
    left.dataType !== right.dataType ||
    left.required !== right.required ||
    left.minConnections !== right.minConnections ||
    left.maxConnections !== right.maxConnections ||
    !isLabelSettingsEqual(left.labelSettings, right.labelSettings) ||
    !isSocketMetadataEqual(left.metadata, right.metadata)
  ) {
    return false;
  }
  return isJsonValueEqual(
    left.defaultValue ?? null,
    right.defaultValue ?? null,
  );
};
