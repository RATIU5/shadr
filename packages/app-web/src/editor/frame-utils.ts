import type { FrameId, GraphFrame, GraphNode, NodeId } from "@shadr/graph-core";
import type { NodeLayout } from "@shadr/ui-canvas";
import { getNodeSize } from "@shadr/ui-canvas";

type Bounds = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

type FrameMeta = Readonly<{
  id: FrameId;
  frame: GraphFrame;
  bounds: Bounds;
  area: number;
}>;

export type FrameHierarchy = Readonly<{
  frames: ReadonlyArray<FrameMeta>;
  framesById: ReadonlyMap<FrameId, FrameMeta>;
  framesByAreaAsc: ReadonlyArray<FrameMeta>;
  orderedFrames: ReadonlyArray<GraphFrame>;
  parentByFrame: ReadonlyMap<FrameId, FrameId | null>;
  childrenByFrame: ReadonlyMap<FrameId, ReadonlyArray<FrameId>>;
  depthByFrame: ReadonlyMap<FrameId, number>;
}>;

const getFrameBounds = (frame: GraphFrame): Bounds => ({
  minX: frame.position.x,
  minY: frame.position.y,
  maxX: frame.position.x + frame.size.width,
  maxY: frame.position.y + frame.size.height,
});

const getNodeBounds = (node: GraphNode, layout: NodeLayout): Bounds => {
  const { width, height } = getNodeSize(node, layout);
  return {
    minX: node.position.x,
    minY: node.position.y,
    maxX: node.position.x + width,
    maxY: node.position.y + height,
  };
};

const containsBounds = (outer: Bounds, inner: Bounds): boolean =>
  outer.minX <= inner.minX &&
  outer.minY <= inner.minY &&
  outer.maxX >= inner.maxX &&
  outer.maxY >= inner.maxY;

export const buildFrameHierarchy = (
  frames: Iterable<GraphFrame>,
): FrameHierarchy => {
  const entries: FrameMeta[] = [];
  for (const frame of frames) {
    const bounds = getFrameBounds(frame);
    const area = Math.max(0, frame.size.width) * Math.max(0, frame.size.height);
    entries.push({ id: frame.id, frame, bounds, area });
  }

  const framesById = new Map<FrameId, FrameMeta>();
  for (const entry of entries) {
    framesById.set(entry.id, entry);
  }

  const parentByFrame = new Map<FrameId, FrameId | null>();
  for (const entry of entries) {
    let parent: FrameMeta | null = null;
    for (const candidate of entries) {
      if (candidate.id === entry.id) {
        continue;
      }
      if (!containsBounds(candidate.bounds, entry.bounds)) {
        continue;
      }
      if (candidate.area <= entry.area) {
        continue;
      }
      if (!parent || candidate.area < parent.area) {
        parent = candidate;
      }
    }
    parentByFrame.set(entry.id, parent ? parent.id : null);
  }

  const childrenByFrame = new Map<FrameId, FrameId[]>();
  for (const entry of entries) {
    childrenByFrame.set(entry.id, []);
  }
  for (const entry of entries) {
    const parentId = parentByFrame.get(entry.id);
    if (parentId) {
      const children = childrenByFrame.get(parentId);
      if (children) {
        children.push(entry.id);
      }
    }
  }

  const depthByFrame = new Map<FrameId, number>();
  const resolveDepth = (frameId: FrameId): number => {
    const existing = depthByFrame.get(frameId);
    if (existing !== undefined) {
      return existing;
    }
    const parentId = parentByFrame.get(frameId) ?? null;
    const depth = parentId ? resolveDepth(parentId) + 1 : 0;
    depthByFrame.set(frameId, depth);
    return depth;
  };
  for (const entry of entries) {
    resolveDepth(entry.id);
  }

  const orderedFrames = [...entries]
    .sort((left, right) => {
      const leftDepth = depthByFrame.get(left.id) ?? 0;
      const rightDepth = depthByFrame.get(right.id) ?? 0;
      if (leftDepth !== rightDepth) {
        return leftDepth - rightDepth;
      }
      if (left.area !== right.area) {
        return right.area - left.area;
      }
      return left.id.localeCompare(right.id);
    })
    .map((entry) => entry.frame);

  const framesByAreaAsc = [...entries].sort((left, right) => {
    if (left.area !== right.area) {
      return left.area - right.area;
    }
    return left.id.localeCompare(right.id);
  });

  return {
    frames: entries,
    framesById,
    framesByAreaAsc,
    orderedFrames,
    parentByFrame,
    childrenByFrame,
    depthByFrame,
  };
};

export const collectFrameDescendants = (
  frameIds: Iterable<FrameId>,
  hierarchy: FrameHierarchy,
): Set<FrameId> => {
  const result = new Set<FrameId>();
  const stack = Array.from(frameIds);
  while (stack.length > 0) {
    const frameId = stack.pop();
    if (!frameId || result.has(frameId)) {
      continue;
    }
    result.add(frameId);
    const children = hierarchy.childrenByFrame.get(frameId) ?? [];
    for (const childId of children) {
      stack.push(childId);
    }
  }
  return result;
};

export const getNodeFrameOwners = (
  nodes: Iterable<GraphNode>,
  layout: NodeLayout,
  hierarchy: FrameHierarchy,
): Map<NodeId, FrameId> => {
  const owners = new Map<NodeId, FrameId>();
  if (hierarchy.framesByAreaAsc.length === 0) {
    return owners;
  }
  for (const node of nodes) {
    const bounds = getNodeBounds(node, layout);
    for (const entry of hierarchy.framesByAreaAsc) {
      if (containsBounds(entry.bounds, bounds)) {
        owners.set(node.id, entry.id);
        break;
      }
    }
  }
  return owners;
};
