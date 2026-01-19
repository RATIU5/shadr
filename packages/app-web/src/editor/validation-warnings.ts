import type { Graph, GraphWarning, NodeId, SocketId } from "@shadr/graph-core";
import { collectGraphWarnings } from "@shadr/graph-core";
import type { ConversionRegistry, SocketTypeId } from "@shadr/shared";
import { isSocketTypeCompatible } from "@shadr/shared";

export type ConnectionAttemptReason =
  | "type-mismatch"
  | "cycle"
  | "connection-limit"
  | "direction"
  | "self-loop"
  | "missing-socket";

export type ConnectionAttempt = Readonly<{
  id: number;
  timestamp: number;
  fromSocketId: SocketId;
  toSocketId: SocketId;
  fromType?: SocketTypeId;
  toType?: SocketTypeId;
  reason: ConnectionAttemptReason;
}>;

export type ValidationWarning =
  | GraphWarning
  | Readonly<{
      _tag: "TypeMismatchAttempt";
      attemptId: number;
      fromSocketId: SocketId;
      toSocketId: SocketId;
      fromType?: SocketTypeId;
      toType?: SocketTypeId;
      timestamp: number;
    }>
  | Readonly<{
      _tag: "CycleAttempt";
      attemptId: number;
      fromSocketId: SocketId;
      toSocketId: SocketId;
      timestamp: number;
    }>
  | Readonly<{
      _tag: "UnreachableOutput";
      nodeId: NodeId;
      socketId: SocketId;
    }>
  | Readonly<{
      _tag: "RedundantConversion";
      nodeId: NodeId;
      fromType: SocketTypeId;
      toType: SocketTypeId;
      reason: "compatible-pair" | "back-and-forth";
      relatedNodeId?: NodeId;
    }>;

// eslint-disable-next-line no-unused-vars -- type-only param name improves clarity.
type OutputNodeTypeCheck = (_nodeType: string) => boolean;

const pushWarning = (
  list: ValidationWarning[],
  seen: Set<string>,
  warning: ValidationWarning,
  key: string,
): void => {
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  list.push(warning);
};

export const collectValidationWarnings = (
  graph: Graph,
  attempts: ReadonlyArray<ConnectionAttempt>,
  options: Readonly<{
    conversionRegistry: ConversionRegistry;
    isOutputNodeType: OutputNodeTypeCheck;
  }>,
): ReadonlyArray<ValidationWarning> => {
  const warnings: ValidationWarning[] = [...collectGraphWarnings(graph)];
  const seen = new Set<string>();

  const connectionCounts = new Map<SocketId, number>();
  for (const wire of graph.wires.values()) {
    connectionCounts.set(
      wire.fromSocketId,
      (connectionCounts.get(wire.fromSocketId) ?? 0) + 1,
    );
    connectionCounts.set(
      wire.toSocketId,
      (connectionCounts.get(wire.toSocketId) ?? 0) + 1,
    );
  }

  for (const node of graph.nodes.values()) {
    if (!options.isOutputNodeType(node.type)) {
      continue;
    }
    let hasInputConnection = false;
    for (const socketId of node.inputs) {
      if ((connectionCounts.get(socketId) ?? 0) > 0) {
        hasInputConnection = true;
        break;
      }
    }
    if (!hasInputConnection) {
      for (const socketId of node.outputs) {
        warnings.push({
          _tag: "UnreachableOutput",
          nodeId: node.id,
          socketId,
        });
      }
    }
  }

  const conversionByNodeType = new Map(
    options.conversionRegistry.entries.map((entry) => [entry.nodeType, entry]),
  );
  const conversionNodes = new Map<NodeId, SocketTypeId[]>();

  for (const node of graph.nodes.values()) {
    const conversion = conversionByNodeType.get(node.type);
    if (!conversion) {
      continue;
    }
    conversionNodes.set(node.id, [conversion.fromType, conversion.toType]);
    if (isSocketTypeCompatible(conversion.fromType, conversion.toType)) {
      warnings.push({
        _tag: "RedundantConversion",
        nodeId: node.id,
        fromType: conversion.fromType,
        toType: conversion.toType,
        reason: "compatible-pair",
      });
    }
  }

  for (const wire of graph.wires.values()) {
    const fromSocket = graph.sockets.get(wire.fromSocketId);
    const toSocket = graph.sockets.get(wire.toSocketId);
    if (!fromSocket || !toSocket) {
      continue;
    }
    const fromConversion = conversionNodes.get(fromSocket.nodeId);
    const toConversion = conversionNodes.get(toSocket.nodeId);
    if (!fromConversion || !toConversion) {
      continue;
    }
    const [fromType, viaType] = fromConversion;
    const [toFromType, toType] = toConversion;
    if (viaType !== toFromType) {
      continue;
    }
    if (fromType !== toType) {
      continue;
    }
    pushWarning(
      warnings,
      seen,
      {
        _tag: "RedundantConversion",
        nodeId: fromSocket.nodeId,
        fromType,
        toType: viaType,
        reason: "back-and-forth",
        relatedNodeId: toSocket.nodeId,
      },
      `redundant:${fromSocket.nodeId}:${toSocket.nodeId}`,
    );
    pushWarning(
      warnings,
      seen,
      {
        _tag: "RedundantConversion",
        nodeId: toSocket.nodeId,
        fromType: toFromType,
        toType,
        reason: "back-and-forth",
        relatedNodeId: fromSocket.nodeId,
      },
      `redundant:${toSocket.nodeId}:${fromSocket.nodeId}`,
    );
  }

  for (const attempt of attempts) {
    if (attempt.reason === "type-mismatch") {
      warnings.push({
        _tag: "TypeMismatchAttempt",
        attemptId: attempt.id,
        fromSocketId: attempt.fromSocketId,
        toSocketId: attempt.toSocketId,
        fromType: attempt.fromType,
        toType: attempt.toType,
        timestamp: attempt.timestamp,
      });
    }
    if (attempt.reason === "cycle") {
      warnings.push({
        _tag: "CycleAttempt",
        attemptId: attempt.id,
        fromSocketId: attempt.fromSocketId,
        toSocketId: attempt.toSocketId,
        timestamp: attempt.timestamp,
      });
    }
  }

  return warnings;
};
