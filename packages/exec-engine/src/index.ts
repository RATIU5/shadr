import type { Graph, NodeId } from "@shadr/graph-core";

export type DirtyState = Readonly<{
  dirty: ReadonlySet<NodeId>;
}>;

export const createDirtyState = (): DirtyState => ({
  dirty: new Set<NodeId>(),
});

const collectDownstream = (graph: Graph, start: NodeId): Set<NodeId> => {
  const visited = new Set<NodeId>();
  const stack: NodeId[] = [start];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);
    const targets = graph.outgoing.get(current);
    if (!targets) {
      continue;
    }

    for (const target of targets) {
      stack.push(target);
    }
  }

  return visited;
};

export const markDirty = (
  graph: Graph,
  state: DirtyState,
  nodeId: NodeId,
): DirtyState => {
  const dirty = new Set(state.dirty);
  for (const target of collectDownstream(graph, nodeId)) {
    dirty.add(target);
  }
  return { dirty };
};

export const clearDirty = (
  state: DirtyState,
  nodeIds: Iterable<NodeId>,
): DirtyState => {
  const dirty = new Set(state.dirty);
  for (const nodeId of nodeIds) {
    dirty.delete(nodeId);
  }
  return { dirty };
};

export const isDirty = (state: DirtyState, nodeId: NodeId): boolean =>
  state.dirty.has(nodeId);
