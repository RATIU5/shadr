import type {
  GraphDocumentV1,
  GraphId,
  GraphNodeV1,
  GraphSocketDirectionV1,
  GraphSocketV1,
  GraphWireV1,
  JsonObject,
  JsonValue,
  NodeId,
  SocketId,
  SocketTypeId,
  WireId,
} from "@shadr/shared";
import {
  GRAPH_DOCUMENT_V1_SCHEMA_VERSION,
  isSocketTypeCompatible,
} from "@shadr/shared";
import { Effect } from "effect";

export type { GraphId, NodeId, SocketId, WireId } from "@shadr/shared";

export type GraphNode = GraphNodeV1;
export type GraphSocket = GraphSocketV1;
export type GraphWire = GraphWireV1;
export type GraphSocketDirection = GraphSocketDirectionV1;

export type Graph = Readonly<{
  graphId: GraphId;
  nodes: ReadonlyMap<NodeId, GraphNode>;
  sockets: ReadonlyMap<SocketId, GraphSocket>;
  wires: ReadonlyMap<WireId, GraphWire>;
  outgoing: ReadonlyMap<NodeId, ReadonlySet<NodeId>>;
  incoming: ReadonlyMap<NodeId, ReadonlySet<NodeId>>;
}>;

export type GraphError =
  | { _tag: "DuplicateNode"; nodeId: NodeId }
  | { _tag: "DuplicateSocket"; socketId: SocketId }
  | { _tag: "DuplicateWire"; wireId: WireId }
  | { _tag: "MissingWire"; wireId: WireId }
  | { _tag: "MissingNode"; nodeId: NodeId }
  | { _tag: "MissingSocket"; socketId: SocketId }
  | {
      _tag: "InvalidSocketDirection";
      socketId: SocketId;
      expected: GraphSocketDirection;
    }
  | { _tag: "SocketNodeMismatch"; socketId: SocketId; nodeId: NodeId }
  | {
      _tag: "NodeSocketMismatch";
      nodeId: NodeId;
      direction: GraphSocketDirection;
      socketIds: ReadonlyArray<SocketId>;
    }
  | {
      _tag: "IncompatibleSocketTypes";
      fromSocketId: SocketId;
      toSocketId: SocketId;
      fromType: SocketTypeId;
      toType: SocketTypeId;
    }
  | { _tag: "AdjacencyMismatch"; from: NodeId; to: NodeId }
  | { _tag: "SelfLoop"; nodeId: NodeId }
  | { _tag: "CycleDetected"; path: NodeId[] };

export type GraphEffect<T> = Effect.Effect<T, GraphError>;

const succeed = <T>(value: T): GraphEffect<T> => Effect.succeed(value);
const fail = (error: GraphError): GraphEffect<never> => Effect.fail(error);

const cloneSetMap = <K>(
  map: ReadonlyMap<K, ReadonlySet<K>>,
): Map<K, Set<K>> => {
  const clone = new Map<K, Set<K>>();
  for (const [key, value] of map) {
    clone.set(key, new Set(value));
  }
  return clone;
};

const cloneMap = <K, V>(map: ReadonlyMap<K, V>): Map<K, V> => new Map(map);

const sameIdSet = (
  left: ReadonlyArray<SocketId>,
  right: ReadonlyArray<SocketId>,
): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  if (rightSet.size !== right.length) {
    return false;
  }
  for (const socketId of left) {
    if (!rightSet.has(socketId)) {
      return false;
    }
  }
  return true;
};

const sortedNodeIds = (nodeIds: Iterable<NodeId>): NodeId[] =>
  Array.from(nodeIds).sort((left, right) => left.localeCompare(right));

const sortedNodes = (graph: Graph): NodeId[] =>
  sortedNodeIds(graph.nodes.keys());

const sortedOutgoing = (graph: Graph, nodeId: NodeId): NodeId[] => {
  const targets = graph.outgoing.get(nodeId);
  if (!targets) {
    return [];
  }
  return Array.from(targets).sort((left, right) => left.localeCompare(right));
};

export const createGraph = (graphId: GraphId): Graph => ({
  graphId,
  nodes: new Map<NodeId, GraphNode>(),
  sockets: new Map<SocketId, GraphSocket>(),
  wires: new Map<WireId, GraphWire>(),
  outgoing: new Map<NodeId, Set<NodeId>>(),
  incoming: new Map<NodeId, Set<NodeId>>(),
});

export const addNode = (
  graph: Graph,
  node: GraphNode,
  sockets: ReadonlyArray<GraphSocket>,
): GraphEffect<Graph> => {
  if (graph.nodes.has(node.id)) {
    return fail({ _tag: "DuplicateNode", nodeId: node.id });
  }

  const socketIds = new Set<SocketId>();
  for (const socket of sockets) {
    if (socketIds.has(socket.id) || graph.sockets.has(socket.id)) {
      return fail({ _tag: "DuplicateSocket", socketId: socket.id });
    }
    if (socket.nodeId !== node.id) {
      return fail({
        _tag: "SocketNodeMismatch",
        socketId: socket.id,
        nodeId: node.id,
      });
    }
    socketIds.add(socket.id);
  }

  const inputIds = sockets
    .filter((socket) => socket.direction === "input")
    .map((socket) => socket.id);
  const outputIds = sockets
    .filter((socket) => socket.direction === "output")
    .map((socket) => socket.id);

  if (!sameIdSet(node.inputs, inputIds)) {
    return fail({
      _tag: "NodeSocketMismatch",
      nodeId: node.id,
      direction: "input",
      socketIds: node.inputs,
    });
  }

  if (!sameIdSet(node.outputs, outputIds)) {
    return fail({
      _tag: "NodeSocketMismatch",
      nodeId: node.id,
      direction: "output",
      socketIds: node.outputs,
    });
  }

  const nodes = cloneMap(graph.nodes);
  nodes.set(node.id, node);

  const socketsMap = cloneMap(graph.sockets);
  for (const socket of sockets) {
    socketsMap.set(socket.id, socket);
  }

  const wires = cloneMap(graph.wires);
  const outgoing = cloneSetMap(graph.outgoing);
  const incoming = cloneSetMap(graph.incoming);
  outgoing.set(node.id, new Set());
  incoming.set(node.id, new Set());

  return succeed({
    graphId: graph.graphId,
    nodes,
    sockets: socketsMap,
    wires,
    outgoing,
    incoming,
  });
};

const findPath = (
  graph: Graph,
  start: NodeId,
  target: NodeId,
): NodeId[] | null => {
  const visited = new Set<NodeId>();
  const stack: Array<{ nodeId: NodeId; path: NodeId[] }> = [
    { nodeId: start, path: [start] },
  ];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const { nodeId, path } = current;
    if (nodeId === target) {
      return path;
    }

    if (visited.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);
    const neighbors = sortedOutgoing(graph, nodeId);
    for (let index = neighbors.length - 1; index >= 0; index -= 1) {
      const neighbor = neighbors[index];
      if (!neighbor) {
        continue;
      }
      stack.push({ nodeId: neighbor, path: [...path, neighbor] });
    }
  }

  return null;
};

export const addWire = (graph: Graph, wire: GraphWire): GraphEffect<Graph> => {
  if (graph.wires.has(wire.id)) {
    return fail({ _tag: "DuplicateWire", wireId: wire.id });
  }

  const fromSocket = graph.sockets.get(wire.fromSocketId);
  if (!fromSocket) {
    return fail({ _tag: "MissingSocket", socketId: wire.fromSocketId });
  }
  const toSocket = graph.sockets.get(wire.toSocketId);
  if (!toSocket) {
    return fail({ _tag: "MissingSocket", socketId: wire.toSocketId });
  }

  if (fromSocket.direction !== "output") {
    return fail({
      _tag: "InvalidSocketDirection",
      socketId: fromSocket.id,
      expected: "output",
    });
  }
  if (toSocket.direction !== "input") {
    return fail({
      _tag: "InvalidSocketDirection",
      socketId: toSocket.id,
      expected: "input",
    });
  }
  if (!isSocketTypeCompatible(fromSocket.dataType, toSocket.dataType)) {
    return fail({
      _tag: "IncompatibleSocketTypes",
      fromSocketId: fromSocket.id,
      toSocketId: toSocket.id,
      fromType: fromSocket.dataType,
      toType: toSocket.dataType,
    });
  }

  const fromNodeId = fromSocket.nodeId;
  const toNodeId = toSocket.nodeId;
  if (!graph.nodes.has(fromNodeId)) {
    return fail({ _tag: "MissingNode", nodeId: fromNodeId });
  }
  if (!graph.nodes.has(toNodeId)) {
    return fail({ _tag: "MissingNode", nodeId: toNodeId });
  }
  if (fromNodeId === toNodeId) {
    return fail({ _tag: "SelfLoop", nodeId: fromNodeId });
  }

  const path = findPath(graph, toNodeId, fromNodeId);
  if (path) {
    return fail({ _tag: "CycleDetected", path: [fromNodeId, ...path] });
  }

  const wires = cloneMap(graph.wires);
  wires.set(wire.id, wire);

  const outgoing = cloneSetMap(graph.outgoing);
  const incoming = cloneSetMap(graph.incoming);

  const nextOutgoing = outgoing.get(fromNodeId) ?? new Set<NodeId>();
  nextOutgoing.add(toNodeId);
  outgoing.set(fromNodeId, nextOutgoing);

  const nextIncoming = incoming.get(toNodeId) ?? new Set<NodeId>();
  nextIncoming.add(fromNodeId);
  incoming.set(toNodeId, nextIncoming);

  return succeed({
    graphId: graph.graphId,
    nodes: cloneMap(graph.nodes),
    sockets: cloneMap(graph.sockets),
    wires,
    outgoing,
    incoming,
  });
};

export const removeWire = (
  graph: Graph,
  wireId: WireId,
): GraphEffect<Graph> => {
  const wire = graph.wires.get(wireId);
  if (!wire) {
    return fail({ _tag: "MissingWire", wireId });
  }

  const fromSocket = graph.sockets.get(wire.fromSocketId);
  if (!fromSocket) {
    return fail({ _tag: "MissingSocket", socketId: wire.fromSocketId });
  }
  const toSocket = graph.sockets.get(wire.toSocketId);
  if (!toSocket) {
    return fail({ _tag: "MissingSocket", socketId: wire.toSocketId });
  }

  const fromNodeId = fromSocket.nodeId;
  const toNodeId = toSocket.nodeId;
  if (!graph.nodes.has(fromNodeId)) {
    return fail({ _tag: "MissingNode", nodeId: fromNodeId });
  }
  if (!graph.nodes.has(toNodeId)) {
    return fail({ _tag: "MissingNode", nodeId: toNodeId });
  }

  const wires = cloneMap(graph.wires);
  wires.delete(wireId);

  const outgoing = cloneSetMap(graph.outgoing);
  const incoming = cloneSetMap(graph.incoming);

  const stillConnected = Array.from(wires.values()).some((candidate) => {
    const candidateFrom = graph.sockets.get(candidate.fromSocketId);
    const candidateTo = graph.sockets.get(candidate.toSocketId);
    if (!candidateFrom || !candidateTo) {
      return false;
    }
    return (
      candidateFrom.nodeId === fromNodeId && candidateTo.nodeId === toNodeId
    );
  });

  if (!stillConnected) {
    const nextOutgoing = outgoing.get(fromNodeId);
    if (nextOutgoing) {
      nextOutgoing.delete(toNodeId);
    }
    const nextIncoming = incoming.get(toNodeId);
    if (nextIncoming) {
      nextIncoming.delete(fromNodeId);
    }
  }

  return succeed({
    graphId: graph.graphId,
    nodes: cloneMap(graph.nodes),
    sockets: cloneMap(graph.sockets),
    wires,
    outgoing,
    incoming,
  });
};

export const removeNode = (
  graph: Graph,
  nodeId: NodeId,
): GraphEffect<Graph> => {
  const node = graph.nodes.get(nodeId);
  if (!node) {
    return fail({ _tag: "MissingNode", nodeId });
  }

  const nodes = cloneMap(graph.nodes);
  nodes.delete(nodeId);

  const sockets = cloneMap(graph.sockets);
  const removedSockets = new Set<SocketId>([...node.inputs, ...node.outputs]);
  for (const socketId of removedSockets) {
    sockets.delete(socketId);
  }

  const wires = cloneMap(graph.wires);
  for (const [wireId, wire] of wires) {
    if (
      removedSockets.has(wire.fromSocketId) ||
      removedSockets.has(wire.toSocketId)
    ) {
      wires.delete(wireId);
    }
  }

  const outgoing = cloneSetMap(graph.outgoing);
  const incoming = cloneSetMap(graph.incoming);
  outgoing.delete(nodeId);
  incoming.delete(nodeId);

  for (const targets of outgoing.values()) {
    targets.delete(nodeId);
  }
  for (const sources of incoming.values()) {
    sources.delete(nodeId);
  }

  return succeed({
    graphId: graph.graphId,
    nodes,
    sockets,
    wires,
    outgoing,
    incoming,
  });
};

export const moveNode = (
  graph: Graph,
  nodeId: NodeId,
  position: GraphNode["position"],
): GraphEffect<Graph> => {
  const node = graph.nodes.get(nodeId);
  if (!node) {
    return fail({ _tag: "MissingNode", nodeId });
  }

  const nodes = cloneMap(graph.nodes);
  nodes.set(nodeId, { ...node, position });

  return succeed({
    graphId: graph.graphId,
    nodes,
    sockets: cloneMap(graph.sockets),
    wires: cloneMap(graph.wires),
    outgoing: cloneSetMap(graph.outgoing),
    incoming: cloneSetMap(graph.incoming),
  });
};

export type NodePositionUpdate = Readonly<{
  nodeId: NodeId;
  position: GraphNode["position"];
}>;

export const moveNodes = (
  graph: Graph,
  updates: ReadonlyArray<NodePositionUpdate>,
): GraphEffect<Graph> => {
  for (const update of updates) {
    if (!graph.nodes.has(update.nodeId)) {
      return fail({ _tag: "MissingNode", nodeId: update.nodeId });
    }
  }

  const nodes = cloneMap(graph.nodes);
  for (const update of updates) {
    const node = nodes.get(update.nodeId);
    if (!node) {
      return fail({ _tag: "MissingNode", nodeId: update.nodeId });
    }
    nodes.set(update.nodeId, { ...node, position: update.position });
  }

  return succeed({
    graphId: graph.graphId,
    nodes,
    sockets: cloneMap(graph.sockets),
    wires: cloneMap(graph.wires),
    outgoing: cloneSetMap(graph.outgoing),
    incoming: cloneSetMap(graph.incoming),
  });
};

export const updateParam = (
  graph: Graph,
  nodeId: NodeId,
  key: string,
  value: JsonValue,
): GraphEffect<Graph> => {
  const node = graph.nodes.get(nodeId);
  if (!node) {
    return fail({ _tag: "MissingNode", nodeId });
  }

  const nodes = cloneMap(graph.nodes);
  nodes.set(nodeId, {
    ...node,
    params: { ...node.params, [key]: value },
  });

  return succeed({
    graphId: graph.graphId,
    nodes,
    sockets: cloneMap(graph.sockets),
    wires: cloneMap(graph.wires),
    outgoing: cloneSetMap(graph.outgoing),
    incoming: cloneSetMap(graph.incoming),
  });
};

export const detectCycle = (graph: Graph): NodeId[] | null => {
  const visited = new Set<NodeId>();
  const visiting = new Set<NodeId>();

  const visit = (nodeId: NodeId, path: NodeId[]): NodeId[] | null => {
    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart >= 0) {
        return [...path.slice(cycleStart), nodeId];
      }
      return [nodeId, nodeId];
    }

    if (visited.has(nodeId)) {
      return null;
    }

    visiting.add(nodeId);
    const nextPath = [...path, nodeId];
    for (const neighbor of sortedOutgoing(graph, nodeId)) {
      const cycle = visit(neighbor, nextPath);
      if (cycle) {
        return cycle;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    return null;
  };

  for (const nodeId of sortedNodes(graph)) {
    const cycle = visit(nodeId, []);
    if (cycle) {
      return cycle;
    }
  }

  return null;
};

export const validateGraph = (graph: Graph): GraphEffect<Graph> => {
  for (const [nodeId, node] of graph.nodes) {
    const outgoing = graph.outgoing.get(nodeId);
    const incoming = graph.incoming.get(nodeId);
    if (!outgoing || !incoming) {
      return fail({ _tag: "MissingNode", nodeId });
    }

    const nodeSocketIds = new Set<SocketId>([...node.inputs, ...node.outputs]);
    for (const socketId of nodeSocketIds) {
      const socket = graph.sockets.get(socketId);
      if (!socket) {
        return fail({ _tag: "MissingSocket", socketId });
      }
      if (socket.nodeId !== nodeId) {
        return fail({
          _tag: "SocketNodeMismatch",
          socketId,
          nodeId,
        });
      }
      if (socket.direction === "input" && !node.inputs.includes(socketId)) {
        return fail({
          _tag: "NodeSocketMismatch",
          nodeId,
          direction: "input",
          socketIds: node.inputs,
        });
      }
      if (socket.direction === "output" && !node.outputs.includes(socketId)) {
        return fail({
          _tag: "NodeSocketMismatch",
          nodeId,
          direction: "output",
          socketIds: node.outputs,
        });
      }
    }

    for (const target of outgoing) {
      if (!graph.nodes.has(target)) {
        return fail({ _tag: "MissingNode", nodeId: target });
      }
    }
    for (const source of incoming) {
      if (!graph.nodes.has(source)) {
        return fail({ _tag: "MissingNode", nodeId: source });
      }
    }
  }

  for (const wire of graph.wires.values()) {
    const fromSocket = graph.sockets.get(wire.fromSocketId);
    if (!fromSocket) {
      return fail({ _tag: "MissingSocket", socketId: wire.fromSocketId });
    }
    const toSocket = graph.sockets.get(wire.toSocketId);
    if (!toSocket) {
      return fail({ _tag: "MissingSocket", socketId: wire.toSocketId });
    }
    if (fromSocket.direction !== "output") {
      return fail({
        _tag: "InvalidSocketDirection",
        socketId: fromSocket.id,
        expected: "output",
      });
    }
    if (toSocket.direction !== "input") {
      return fail({
        _tag: "InvalidSocketDirection",
        socketId: toSocket.id,
        expected: "input",
      });
    }
    if (!isSocketTypeCompatible(fromSocket.dataType, toSocket.dataType)) {
      return fail({
        _tag: "IncompatibleSocketTypes",
        fromSocketId: fromSocket.id,
        toSocketId: toSocket.id,
        fromType: fromSocket.dataType,
        toType: toSocket.dataType,
      });
    }
    const fromNodeId = fromSocket.nodeId;
    const toNodeId = toSocket.nodeId;
    if (!graph.nodes.has(fromNodeId)) {
      return fail({ _tag: "MissingNode", nodeId: fromNodeId });
    }
    if (!graph.nodes.has(toNodeId)) {
      return fail({ _tag: "MissingNode", nodeId: toNodeId });
    }
    if (fromNodeId === toNodeId) {
      return fail({ _tag: "SelfLoop", nodeId: fromNodeId });
    }
    const outgoing = graph.outgoing.get(fromNodeId);
    const incoming = graph.incoming.get(toNodeId);
    if (!outgoing?.has(toNodeId) || !incoming?.has(fromNodeId)) {
      return fail({
        _tag: "AdjacencyMismatch",
        from: fromNodeId,
        to: toNodeId,
      });
    }
  }

  const cycle = detectCycle(graph);
  if (cycle) {
    return fail({ _tag: "CycleDetected", path: cycle });
  }

  return succeed(graph);
};

export const topoSort = (graph: Graph): GraphEffect<NodeId[]> =>
  Effect.flatMap(validateGraph(graph), () => {
    const inDegree = new Map<NodeId, number>();
    for (const nodeId of graph.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const [from, targets] of graph.outgoing) {
      if (!graph.nodes.has(from)) {
        return fail({ _tag: "MissingNode", nodeId: from });
      }
      for (const to of targets) {
        if (!graph.nodes.has(to)) {
          return fail({ _tag: "MissingNode", nodeId: to });
        }
        inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
      }
    }

    const ready = sortedNodes(graph).filter(
      (nodeId) => (inDegree.get(nodeId) ?? 0) === 0,
    );
    const order: NodeId[] = [];

    while (ready.length > 0) {
      const next = ready.shift();
      if (!next) {
        continue;
      }
      order.push(next);
      for (const neighbor of sortedOutgoing(graph, next)) {
        const remaining = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, remaining);
        if (remaining === 0) {
          ready.push(neighbor);
          ready.sort((left, right) => left.localeCompare(right));
        }
      }
    }

    if (order.length !== graph.nodes.size) {
      const cycle = detectCycle(graph);
      if (cycle) {
        return fail({ _tag: "CycleDetected", path: cycle });
      }
    }

    return succeed(order);
  });

export const topoSortSubgraph = (
  graph: Graph,
  nodes: ReadonlySet<NodeId>,
): GraphEffect<NodeId[]> =>
  Effect.flatMap(validateGraph(graph), () => {
    for (const nodeId of nodes) {
      if (!graph.nodes.has(nodeId)) {
        return fail({ _tag: "MissingNode", nodeId });
      }
    }

    const inDegree = new Map<NodeId, number>();
    for (const nodeId of nodes) {
      inDegree.set(nodeId, 0);
    }

    for (const from of nodes) {
      const targets = graph.outgoing.get(from);
      if (!targets) {
        return fail({ _tag: "MissingNode", nodeId: from });
      }
      for (const to of targets) {
        if (!nodes.has(to)) {
          continue;
        }
        inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
      }
    }

    const ready = sortedNodeIds(nodes).filter(
      (nodeId) => (inDegree.get(nodeId) ?? 0) === 0,
    );
    const order: NodeId[] = [];

    while (ready.length > 0) {
      const next = ready.shift();
      if (!next) {
        continue;
      }
      order.push(next);
      for (const neighbor of sortedOutgoing(graph, next)) {
        if (!nodes.has(neighbor)) {
          continue;
        }
        const remaining = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, remaining);
        if (remaining === 0) {
          ready.push(neighbor);
          ready.sort((left, right) => left.localeCompare(right));
        }
      }
    }

    if (order.length !== nodes.size) {
      const cycle = detectCycle(graph);
      if (cycle) {
        return fail({ _tag: "CycleDetected", path: cycle });
      }
    }

    return succeed(order);
  });

const collectClosure = (
  graph: Graph,
  startNodes: ReadonlyArray<NodeId>,
  adjacency: ReadonlyMap<NodeId, ReadonlySet<NodeId>>,
): GraphEffect<NodeId[]> => {
  for (const nodeId of startNodes) {
    if (!graph.nodes.has(nodeId)) {
      return fail({ _tag: "MissingNode", nodeId });
    }
  }

  const visited = new Set<NodeId>();
  const stack: NodeId[] = [...startNodes];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const neighbors = adjacency.get(current);
    if (!neighbors) {
      return fail({ _tag: "MissingNode", nodeId: current });
    }
    for (const neighbor of neighbors) {
      stack.push(neighbor);
    }
  }

  return succeed(
    Array.from(visited).sort((left, right) => left.localeCompare(right)),
  );
};

export const upstreamClosure = (
  graph: Graph,
  startNodes: ReadonlyArray<NodeId>,
): GraphEffect<NodeId[]> => collectClosure(graph, startNodes, graph.incoming);

export const downstreamClosure = (
  graph: Graph,
  startNodes: ReadonlyArray<NodeId>,
): GraphEffect<NodeId[]> => collectClosure(graph, startNodes, graph.outgoing);

export const connectedComponents = (
  graph: Graph,
): GraphEffect<ReadonlyArray<NodeId[]>> => {
  const visited = new Set<NodeId>();
  const components: NodeId[][] = [];

  for (const nodeId of sortedNodes(graph)) {
    if (visited.has(nodeId)) {
      continue;
    }
    const component = new Set<NodeId>();
    const stack: NodeId[] = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }
      if (component.has(current)) {
        continue;
      }
      component.add(current);
      visited.add(current);

      const outgoing = graph.outgoing.get(current);
      const incoming = graph.incoming.get(current);
      if (!outgoing || !incoming) {
        return fail({ _tag: "MissingNode", nodeId: current });
      }
      for (const neighbor of outgoing) {
        if (!component.has(neighbor)) {
          stack.push(neighbor);
        }
      }
      for (const neighbor of incoming) {
        if (!component.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    components.push(
      Array.from(component).sort((left, right) => left.localeCompare(right)),
    );
  }

  components.sort((left, right) => {
    const leftKey = left[0] ?? "";
    const rightKey = right[0] ?? "";
    return leftKey.localeCompare(rightKey);
  });

  return succeed(components);
};

export type ExecutionSubgraph = Readonly<{
  nodes: ReadonlySet<NodeId>;
  sockets: ReadonlySet<SocketId>;
  wires: ReadonlySet<WireId>;
  outputSockets: ReadonlySet<SocketId>;
}>;

export const executionSubgraphByOutputSockets = (
  graph: Graph,
  outputSocketIds: ReadonlyArray<SocketId>,
): GraphEffect<ExecutionSubgraph> => {
  const outputSockets = new Set<SocketId>();
  const targetNodes: NodeId[] = [];

  for (const socketId of outputSocketIds) {
    const socket = graph.sockets.get(socketId);
    if (!socket) {
      return fail({ _tag: "MissingSocket", socketId });
    }
    if (socket.direction !== "output") {
      return fail({
        _tag: "InvalidSocketDirection",
        socketId,
        expected: "output",
      });
    }
    if (!graph.nodes.has(socket.nodeId)) {
      return fail({ _tag: "MissingNode", nodeId: socket.nodeId });
    }
    outputSockets.add(socketId);
    targetNodes.push(socket.nodeId);
  }

  return Effect.flatMap(
    collectClosure(graph, targetNodes, graph.incoming),
    (list) => {
      const nodes = new Set<NodeId>(list);
      const sockets = new Set<SocketId>();
      const wires = new Set<WireId>();

      for (const nodeId of nodes) {
        const node = graph.nodes.get(nodeId);
        if (!node) {
          return fail({ _tag: "MissingNode", nodeId });
        }
        for (const socketId of node.inputs) {
          if (!graph.sockets.has(socketId)) {
            return fail({ _tag: "MissingSocket", socketId });
          }
          sockets.add(socketId);
        }
        for (const socketId of node.outputs) {
          if (!graph.sockets.has(socketId)) {
            return fail({ _tag: "MissingSocket", socketId });
          }
          sockets.add(socketId);
        }
      }

      for (const [wireId, wire] of graph.wires) {
        const fromSocket = graph.sockets.get(wire.fromSocketId);
        if (!fromSocket) {
          return fail({ _tag: "MissingSocket", socketId: wire.fromSocketId });
        }
        const toSocket = graph.sockets.get(wire.toSocketId);
        if (!toSocket) {
          return fail({ _tag: "MissingSocket", socketId: wire.toSocketId });
        }
        if (nodes.has(fromSocket.nodeId) && nodes.has(toSocket.nodeId)) {
          wires.add(wireId);
        }
      }

      return succeed({
        nodes,
        sockets,
        wires,
        outputSockets,
      });
    },
  );
};

export const topoSortExecutionSubgraphByOutputSockets = (
  graph: Graph,
  outputSocketIds: ReadonlyArray<SocketId>,
): GraphEffect<NodeId[]> =>
  Effect.flatMap(
    executionSubgraphByOutputSockets(graph, outputSocketIds),
    (subgraph) => topoSortSubgraph(graph, subgraph.nodes),
  );

export const graphToDocumentV1 = (
  graph: Graph,
  metadata?: JsonObject,
): GraphDocumentV1 => ({
  schemaVersion: GRAPH_DOCUMENT_V1_SCHEMA_VERSION,
  graphId: graph.graphId,
  nodes: Array.from(graph.nodes.values()),
  sockets: Array.from(graph.sockets.values()),
  wires: Array.from(graph.wires.values()),
  ...(metadata ? { metadata } : {}),
});

export const graphFromDocumentV1 = (
  document: GraphDocumentV1,
): GraphEffect<Graph> =>
  Effect.gen(function* (_) {
    const nodeIds = new Set<NodeId>(document.nodes.map((node) => node.id));
    const socketsByNode = new Map<NodeId, GraphSocket[]>();

    for (const socket of document.sockets) {
      if (!nodeIds.has(socket.nodeId)) {
        return yield* _(fail({ _tag: "MissingNode", nodeId: socket.nodeId }));
      }
      const list = socketsByNode.get(socket.nodeId);
      if (list) {
        list.push(socket);
      } else {
        socketsByNode.set(socket.nodeId, [socket]);
      }
    }

    let graph = createGraph(document.graphId);
    for (const node of document.nodes) {
      const sockets = socketsByNode.get(node.id) ?? [];
      graph = yield* _(addNode(graph, node, sockets));
    }

    for (const wire of document.wires) {
      graph = yield* _(addWire(graph, wire));
    }

    return graph;
  });
