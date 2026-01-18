export type NodeId = string;

export type Graph = Readonly<{
  nodes: ReadonlySet<NodeId>;
  outgoing: ReadonlyMap<NodeId, ReadonlySet<NodeId>>;
  incoming: ReadonlyMap<NodeId, ReadonlySet<NodeId>>;
}>;

export type GraphError =
  | { _tag: "DuplicateNode"; nodeId: NodeId }
  | { _tag: "MissingNode"; nodeId: NodeId }
  | { _tag: "SelfLoop"; nodeId: NodeId }
  | { _tag: "DuplicateEdge"; from: NodeId; to: NodeId }
  | { _tag: "CycleDetected"; path: NodeId[] };

export type GraphResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GraphError };

const ok = <T>(value: T): GraphResult<T> => ({ ok: true, value });
const err = <T>(error: GraphError): GraphResult<T> => ({ ok: false, error });

const cloneEdgeMap = (
  map: ReadonlyMap<NodeId, ReadonlySet<NodeId>>,
): Map<NodeId, Set<NodeId>> => {
  const clone = new Map<NodeId, Set<NodeId>>();
  for (const [nodeId, targets] of map) {
    clone.set(nodeId, new Set(targets));
  }
  return clone;
};

const sortedNodes = (graph: Graph): NodeId[] => Array.from(graph.nodes).sort();

const sortedOutgoing = (graph: Graph, nodeId: NodeId): NodeId[] => {
  const targets = graph.outgoing.get(nodeId);
  if (!targets) {
    return [];
  }
  return Array.from(targets).sort();
};

export const createGraph = (): Graph => ({
  nodes: new Set<NodeId>(),
  outgoing: new Map<NodeId, Set<NodeId>>(),
  incoming: new Map<NodeId, Set<NodeId>>(),
});

export const addNode = (graph: Graph, nodeId: NodeId): GraphResult<Graph> => {
  if (graph.nodes.has(nodeId)) {
    return err({ _tag: "DuplicateNode", nodeId });
  }

  const nodes = new Set(graph.nodes);
  nodes.add(nodeId);

  const outgoing = cloneEdgeMap(graph.outgoing);
  const incoming = cloneEdgeMap(graph.incoming);
  outgoing.set(nodeId, new Set());
  incoming.set(nodeId, new Set());

  return ok({
    nodes,
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

export const addEdge = (
  graph: Graph,
  from: NodeId,
  to: NodeId,
): GraphResult<Graph> => {
  if (!graph.nodes.has(from)) {
    return err({ _tag: "MissingNode", nodeId: from });
  }
  if (!graph.nodes.has(to)) {
    return err({ _tag: "MissingNode", nodeId: to });
  }
  if (from === to) {
    return err({ _tag: "SelfLoop", nodeId: from });
  }

  const existing = graph.outgoing.get(from);
  if (existing?.has(to)) {
    return err({ _tag: "DuplicateEdge", from, to });
  }

  const path = findPath(graph, to, from);
  if (path) {
    return err({ _tag: "CycleDetected", path: [from, ...path] });
  }

  const outgoing = cloneEdgeMap(graph.outgoing);
  const incoming = cloneEdgeMap(graph.incoming);

  const nextOutgoing = outgoing.get(from) ?? new Set<NodeId>();
  nextOutgoing.add(to);
  outgoing.set(from, nextOutgoing);

  const nextIncoming = incoming.get(to) ?? new Set<NodeId>();
  nextIncoming.add(from);
  incoming.set(to, nextIncoming);

  return ok({
    nodes: new Set(graph.nodes),
    outgoing,
    incoming,
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

export const validateGraph = (graph: Graph): GraphResult<Graph> => {
  for (const nodeId of graph.nodes) {
    const outgoing = graph.outgoing.get(nodeId);
    const incoming = graph.incoming.get(nodeId);
    if (!outgoing || !incoming) {
      return err({ _tag: "MissingNode", nodeId });
    }
    for (const target of outgoing) {
      if (!graph.nodes.has(target)) {
        return err({ _tag: "MissingNode", nodeId: target });
      }
    }
    for (const source of incoming) {
      if (!graph.nodes.has(source)) {
        return err({ _tag: "MissingNode", nodeId: source });
      }
    }
  }

  const cycle = detectCycle(graph);
  if (cycle) {
    return err({ _tag: "CycleDetected", path: cycle });
  }

  return ok(graph);
};

export const topoSort = (graph: Graph): GraphResult<NodeId[]> => {
  const validation = validateGraph(graph);
  if (!validation.ok) {
    return validation;
  }

  const inDegree = new Map<NodeId, number>();
  for (const nodeId of graph.nodes) {
    inDegree.set(nodeId, 0);
  }

  for (const [from, targets] of graph.outgoing) {
    if (!graph.nodes.has(from)) {
      return err({ _tag: "MissingNode", nodeId: from });
    }
    for (const to of targets) {
      if (!graph.nodes.has(to)) {
        return err({ _tag: "MissingNode", nodeId: to });
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
        ready.sort();
      }
    }
  }

  if (order.length !== graph.nodes.size) {
    const cycle = detectCycle(graph);
    if (cycle) {
      return err({ _tag: "CycleDetected", path: cycle });
    }
  }

  return ok(order);
};
