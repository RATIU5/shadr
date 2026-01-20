import type {
  FrameId,
  Graph,
  GraphSocket,
  NodeId,
  SocketId,
  WireId,
} from "@shadr/graph-core";
import { isSocketTypeCompatible } from "@shadr/shared";

import type { GraphCommand } from "~/editor/history";
import {
  createRemoveFrameCommand,
  createRemoveNodeCommand,
  createRemoveWireCommand,
} from "~/editor/history";

export type DeleteSelectionMode = "remove" | "bridge";

type DeleteSelectionInput = Readonly<{
  graph: Graph;
  nodeIds: ReadonlyArray<NodeId>;
  frameIds: ReadonlyArray<FrameId>;
  wireIds: ReadonlyArray<WireId>;
  reconnectMode: DeleteSelectionMode;
  createWireId: () => WireId;
}>;

type WireEndpoint = Readonly<{
  fromSocket: GraphSocket;
  toSocket: GraphSocket;
}>;

const getSocketMaxConnections = (socket: GraphSocket): number =>
  socket.maxConnections ??
  (socket.direction === "input" ? 1 : Number.POSITIVE_INFINITY);

const addEdge = (
  outgoing: Map<NodeId, Set<NodeId>>,
  fromNodeId: NodeId,
  toNodeId: NodeId,
): void => {
  const targets = outgoing.get(fromNodeId);
  if (targets) {
    targets.add(toNodeId);
    return;
  }
  outgoing.set(fromNodeId, new Set([toNodeId]));
};

const wouldCreateCycle = (
  outgoing: Map<NodeId, Set<NodeId>>,
  fromNodeId: NodeId,
  toNodeId: NodeId,
): boolean => {
  if (fromNodeId === toNodeId) {
    return true;
  }
  const visited = new Set<NodeId>();
  const stack: NodeId[] = [toNodeId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    if (current === fromNodeId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const neighbors = outgoing.get(current);
    if (!neighbors) {
      continue;
    }
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }
  return false;
};

const sortBySocketId = (left: WireEndpoint, right: WireEndpoint): number => {
  const fromCompare = left.fromSocket.id.localeCompare(right.fromSocket.id);
  if (fromCompare !== 0) {
    return fromCompare;
  }
  return left.toSocket.id.localeCompare(right.toSocket.id);
};

const buildBridgeWireCommands = (
  graph: Graph,
  nodeIds: ReadonlyArray<NodeId>,
  wireIdsToRemove: ReadonlySet<WireId>,
  createWireId: () => WireId,
): GraphCommand[] => {
  if (nodeIds.length === 0) {
    return [];
  }
  const removedNodeIds = new Set(nodeIds);
  const incomingByNode = new Map<NodeId, WireEndpoint[]>();
  const outgoingByNode = new Map<NodeId, WireEndpoint[]>();

  for (const wire of graph.wires.values()) {
    if (!wireIdsToRemove.has(wire.id)) {
      continue;
    }
    const fromSocket = graph.sockets.get(wire.fromSocketId);
    const toSocket = graph.sockets.get(wire.toSocketId);
    if (!fromSocket || !toSocket) {
      continue;
    }
    const fromRemoved = removedNodeIds.has(fromSocket.nodeId);
    const toRemoved = removedNodeIds.has(toSocket.nodeId);
    if (!fromRemoved && toRemoved) {
      if (fromSocket.direction !== "output" || toSocket.direction !== "input") {
        continue;
      }
      const list = incomingByNode.get(toSocket.nodeId) ?? [];
      list.push({ fromSocket, toSocket });
      incomingByNode.set(toSocket.nodeId, list);
    } else if (fromRemoved && !toRemoved) {
      if (fromSocket.direction !== "output" || toSocket.direction !== "input") {
        continue;
      }
      const list = outgoingByNode.get(fromSocket.nodeId) ?? [];
      list.push({ fromSocket, toSocket });
      outgoingByNode.set(fromSocket.nodeId, list);
    }
  }

  const connectionCounts = new Map<SocketId, number>();
  const existingPairs = new Set<string>();
  const outgoing = new Map<NodeId, Set<NodeId>>();

  for (const wire of graph.wires.values()) {
    if (wireIdsToRemove.has(wire.id)) {
      continue;
    }
    const fromSocket = graph.sockets.get(wire.fromSocketId);
    const toSocket = graph.sockets.get(wire.toSocketId);
    if (!fromSocket || !toSocket) {
      continue;
    }
    if (
      removedNodeIds.has(fromSocket.nodeId) ||
      removedNodeIds.has(toSocket.nodeId)
    ) {
      continue;
    }
    connectionCounts.set(
      fromSocket.id,
      (connectionCounts.get(fromSocket.id) ?? 0) + 1,
    );
    connectionCounts.set(
      toSocket.id,
      (connectionCounts.get(toSocket.id) ?? 0) + 1,
    );
    existingPairs.add(`${fromSocket.id}|${toSocket.id}`);
    addEdge(outgoing, fromSocket.nodeId, toSocket.nodeId);
  }

  const commands: GraphCommand[] = [];
  const sortedNodeIds = [...removedNodeIds].sort((left, right) =>
    left.localeCompare(right),
  );
  for (const nodeId of sortedNodeIds) {
    const incoming = (incomingByNode.get(nodeId) ?? []).sort(sortBySocketId);
    const outgoingLinks = (outgoingByNode.get(nodeId) ?? []).sort(
      sortBySocketId,
    );
    if (incoming.length === 0 || outgoingLinks.length === 0) {
      continue;
    }
    for (const incomingLink of incoming) {
      const fromSocket = incomingLink.fromSocket;
      if (fromSocket.direction !== "output") {
        continue;
      }
      for (const outgoingLink of outgoingLinks) {
        const toSocket = outgoingLink.toSocket;
        if (toSocket.direction !== "input") {
          continue;
        }
        if (fromSocket.nodeId === toSocket.nodeId) {
          continue;
        }
        if (!isSocketTypeCompatible(fromSocket.dataType, toSocket.dataType)) {
          continue;
        }
        if (wouldCreateCycle(outgoing, fromSocket.nodeId, toSocket.nodeId)) {
          continue;
        }
        const fromCount = connectionCounts.get(fromSocket.id) ?? 0;
        if (fromCount + 1 > getSocketMaxConnections(fromSocket)) {
          continue;
        }
        const toCount = connectionCounts.get(toSocket.id) ?? 0;
        if (toCount + 1 > getSocketMaxConnections(toSocket)) {
          continue;
        }
        const pairKey = `${fromSocket.id}|${toSocket.id}`;
        if (existingPairs.has(pairKey)) {
          continue;
        }
        const wireId = createWireId();
        commands.push({
          kind: "add-wire",
          wire: {
            id: wireId,
            fromSocketId: fromSocket.id,
            toSocketId: toSocket.id,
          },
        });
        existingPairs.add(pairKey);
        connectionCounts.set(fromSocket.id, fromCount + 1);
        connectionCounts.set(toSocket.id, toCount + 1);
        addEdge(outgoing, fromSocket.nodeId, toSocket.nodeId);
      }
    }
  }

  return commands;
};

export const buildDeleteSelectionCommands = (
  input: DeleteSelectionInput,
): GraphCommand[] => {
  const { graph, nodeIds, frameIds, wireIds, reconnectMode, createWireId } =
    input;
  const nodeCommands = nodeIds
    .map((nodeId) => createRemoveNodeCommand(graph, nodeId))
    .filter((command): command is NonNullable<typeof command> => !!command);
  const frameCommands = frameIds
    .map((frameId) => createRemoveFrameCommand(graph, frameId))
    .filter((command): command is NonNullable<typeof command> => !!command);

  const removedWireIds = new Set<WireId>();
  for (const command of nodeCommands) {
    if (command.kind !== "remove-node") {
      continue;
    }
    for (const wire of command.wires) {
      removedWireIds.add(wire.id);
    }
  }

  const extraWireIds = wireIds.filter((wireId) => !removedWireIds.has(wireId));
  const wireCommands = extraWireIds
    .map((wireId) => createRemoveWireCommand(graph, wireId))
    .filter((command): command is NonNullable<typeof command> => !!command);

  const wireIdsToRemove = new Set<WireId>(removedWireIds);
  for (const wireCommand of wireCommands) {
    if (wireCommand.kind === "remove-wire") {
      wireIdsToRemove.add(wireCommand.wire.id);
    }
  }

  const bridgeCommands =
    reconnectMode === "bridge"
      ? buildBridgeWireCommands(graph, nodeIds, wireIdsToRemove, createWireId)
      : [];

  return [
    ...nodeCommands,
    ...frameCommands,
    ...wireCommands,
    ...bridgeCommands,
  ];
};
