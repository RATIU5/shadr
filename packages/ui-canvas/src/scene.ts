import type {
  FrameId,
  Graph,
  GraphFrame,
  GraphNode,
  GraphSocket,
  GraphWire,
  NodeId,
  SocketId,
  WireId,
} from "@shadr/graph-core";
import { getSocketTypeMetadata } from "@shadr/shared";
import type * as PIXI from "pixi.js";

import {
  Camera2D,
  type ScreenPointOptions,
  type ViewportSizeOptions,
  type WorldBounds,
} from "./camera.js";
import { getFrameSocketLayout } from "./frame-layout.js";
import {
  type FrameIoLabel,
  type FrameIoState,
  FrameView,
} from "./frame-view.js";
import { createSceneLayers, type SceneLayers } from "./layers.js";
import {
  defaultNodeLayout,
  getNodeSize,
  getSocketPosition,
  type NodeLayout,
} from "./layout.js";
import { NodeView } from "./node-view.js";
import { type CanvasTheme, darkCanvasTheme } from "./theme.js";
import type { Point, Size } from "./types.js";
import { getBezierPoint, getWireControlPoints } from "./wire-geometry.js";
import { WireBatchView } from "./wire-view.js";

export type CanvasSceneOptions = Readonly<{
  layout?: NodeLayout;
  hitTest?: HitTestConfig;
  theme?: CanvasTheme;
}>;

export type FrameOptions = Readonly<{
  padding?: number;
}>;

export type CanvasSelection = Readonly<{
  selectedNodes?: ReadonlySet<NodeId>;
  selectedFrames?: ReadonlySet<FrameId>;
  selectedWires?: ReadonlySet<WireId>;
}>;

export type CanvasNodeState = Readonly<{
  hoveredNodeId?: NodeId | null;
  bypassedNodes?: ReadonlySet<NodeId>;
  errorNodes?: ReadonlySet<NodeId>;
  collapsedNodes?: ReadonlySet<NodeId>;
}>;

export type CanvasWireState = Readonly<{
  hoveredWireId?: WireId | null;
}>;

export type CanvasFrameState = Readonly<{
  hoveredFrameId?: FrameId | null;
}>;

export type CanvasExecutionNodeState = Readonly<{
  order: number;
  durationMs: number;
  maxDurationMs: number;
  cacheHit: boolean;
}>;

export type CanvasExecutionState = Readonly<{
  enabled?: boolean;
  nodes?: ReadonlyMap<NodeId, CanvasExecutionNodeState>;
}>;

export type WireFlowOptions = Readonly<{
  enabled?: boolean;
  minZoom?: number;
  maxWires?: number;
  speed?: number;
}>;

export type HitTestConfig = Readonly<{
  socketRadius?: number;
  wireDistance?: number;
}>;

export type HitTestResult =
  | Readonly<{
      kind: "socket";
      socketId: SocketId;
      nodeId: NodeId;
      position: Point;
    }>
  | Readonly<{
      kind: "wire";
      wireId: WireId;
      fromSocketId: SocketId;
      toSocketId: SocketId;
      distance: number;
    }>
  | Readonly<{
      kind: "node";
      nodeId: NodeId;
    }>
  | Readonly<{
      kind: "frame";
      frameId: FrameId;
    }>
  | Readonly<{
      kind: "none";
    }>;

const WIRE_CULL_PADDING = 24;
const DEFAULT_HIT_TEST_CONFIG: Required<HitTestConfig> = {
  socketRadius: 10,
  wireDistance: 6,
};
const EMPTY_NODE_SET: ReadonlySet<NodeId> = new Set();
const EMPTY_FRAME_SET: ReadonlySet<FrameId> = new Set();
const EMPTY_WIRE_SET: ReadonlySet<WireId> = new Set();
const EMPTY_EXECUTION_MAP: ReadonlyMap<NodeId, CanvasExecutionNodeState> =
  new Map();
const DEFAULT_WIRE_FLOW: Required<WireFlowOptions> = {
  enabled: true,
  minZoom: 1.15,
  maxWires: 320,
  speed: 0.35,
};

const setsMatch = <T>(left: ReadonlySet<T>, right: ReadonlySet<T>): boolean => {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
};

const collectNodeSockets = (
  graph: Graph,
  node: GraphNode,
): ReadonlyArray<GraphSocket> => {
  const sockets: GraphSocket[] = [];
  for (const socketId of node.inputs) {
    const socket = graph.sockets.get(socketId);
    if (socket) {
      sockets.push(socket);
    }
  }
  for (const socketId of node.outputs) {
    const socket = graph.sockets.get(socketId);
    if (socket) {
      sockets.push(socket);
    }
  }
  return sockets;
};

export class CanvasScene {
  readonly root: PIXI.Container;
  readonly layers: SceneLayers;
  private readonly frameViews = new Map<FrameId, FrameView>();
  private readonly nodeViews = new Map<NodeId, NodeView>();
  private readonly wireView: WireBatchView;
  private readonly visibleWires = new Set<WireId>();
  private readonly socketOverrides = new Map<SocketId, Point>();
  private layout: NodeLayout;
  private readonly camera: Camera2D;
  private graph: Graph | null = null;
  private readonly hitTestConfig: Required<HitTestConfig>;
  private theme: CanvasTheme;
  private lastSelectedNodes = new Set<NodeId>();
  private lastOrderedNodes = new Set<NodeId>();
  private frameOrder: FrameId[] = [];

  constructor(options: CanvasSceneOptions = {}) {
    this.layers = createSceneLayers();
    this.root = this.layers.root;
    this.layout = options.layout ?? defaultNodeLayout;
    this.hitTestConfig = { ...DEFAULT_HIT_TEST_CONFIG, ...options.hitTest };
    this.theme = options.theme ?? darkCanvasTheme;
    this.camera = new Camera2D();
    this.wireView = new WireBatchView(this.theme.wire.defaultColor);
    this.layers.wires.addChild(this.wireView.normalGraphics);
    this.layers.wires.addChild(this.wireView.selectedGraphics);
    this.layers.wires.addChild(this.wireView.hoveredGraphics);
    this.layers.wires.addChild(this.wireView.flowGraphics);
    this.applyCameraTransform();
  }

  attachTo(stage: PIXI.Container): void {
    stage.addChild(this.root);
  }

  setLayout(layout: NodeLayout): void {
    this.layout = layout;
  }

  setTheme(theme: CanvasTheme): void {
    this.theme = theme;
    this.wireView.setDefaultColor(theme.wire.defaultColor);
  }

  setViewportSize(size: Size, options?: ViewportSizeOptions): void {
    this.camera.setViewportSize(size, options);
    this.applyCameraTransform();
  }

  setCameraCenter(center: Point): void {
    this.camera.setCenter(center);
    this.applyCameraTransform();
  }

  panCameraBy(delta: Point): void {
    this.camera.panBy(delta);
    this.applyCameraTransform();
  }

  setZoom(zoom: number): void {
    this.camera.setZoom(zoom);
    this.applyCameraTransform();
  }

  zoomAt(screenPoint: Point, zoom: number, options?: ScreenPointOptions): void {
    this.camera.zoomAt(screenPoint, zoom, options);
    this.applyCameraTransform();
  }

  worldToScreen(world: Point, options?: ScreenPointOptions): Point {
    return this.camera.worldToScreen(world, options);
  }

  screenToWorld(screen: Point, options?: ScreenPointOptions): Point {
    return this.camera.screenToWorld(screen, options);
  }

  getCameraCenter(): Point {
    return this.camera.getCenter();
  }

  getZoom(): number {
    return this.camera.getZoom();
  }

  getWorldBounds(): WorldBounds {
    return this.camera.getWorldBounds();
  }

  getSocketPosition(socketId: SocketId): Point | null {
    const graph = this.graph;
    if (!graph) {
      return null;
    }
    const override = this.socketOverrides.get(socketId);
    if (override) {
      return override;
    }
    return getSocketPosition(graph, socketId, this.layout);
  }

  frameNodes(nodeIds?: Iterable<NodeId>, options: FrameOptions = {}): boolean {
    const graph = this.graph;
    if (!graph) {
      return false;
    }
    const bounds = getBoundsForNodes(graph, this.layout, nodeIds);
    if (!bounds) {
      return false;
    }
    this.frameWorldBounds(bounds, options);
    return true;
  }

  syncGraph(
    graph: Graph,
    selection: CanvasSelection = {},
    nodeState: CanvasNodeState = {},
    wireState: CanvasWireState = {},
    frameState: CanvasFrameState = {},
    executionState: CanvasExecutionState = {},
  ): void {
    this.graph = graph;
    const worldBounds = this.camera.getWorldBounds();
    const selectedNodes = selection.selectedNodes ?? EMPTY_NODE_SET;
    const selectedFrames = selection.selectedFrames ?? EMPTY_FRAME_SET;
    const selectedWires = selection.selectedWires ?? EMPTY_WIRE_SET;
    const hoveredNodeId = nodeState.hoveredNodeId ?? null;
    const hoveredWireId = wireState.hoveredWireId ?? null;
    const hoveredFrameId = frameState.hoveredFrameId ?? null;
    const bypassedNodes = nodeState.bypassedNodes ?? EMPTY_NODE_SET;
    const errorNodes = nodeState.errorNodes ?? EMPTY_NODE_SET;
    const collapsedNodes = nodeState.collapsedNodes ?? EMPTY_NODE_SET;
    const executionNodes = executionState.nodes ?? EMPTY_EXECUTION_MAP;
    const executionEnabled = executionState.enabled ?? false;
    const seenFrames = new Set<FrameId>();
    const seenNodes = new Set<NodeId>();
    const hiddenNodes = new Set<NodeId>();
    const nodeCollapsedFrame = new Map<NodeId, FrameId>();
    const exposedSockets = new Set<SocketId>();
    const frameIo = new Map<FrameId, FrameIoState>();
    this.socketOverrides.clear();
    const frameHierarchy = buildFrameHierarchy(graph.frames.values());
    const collapsedFrames = frameHierarchy.framesByAreaAsc.filter(
      (entry) => entry.frame.collapsed,
    );
    const collapsedNodesByFrame = new Map<FrameId, Set<NodeId>>();
    for (const entry of collapsedFrames) {
      collapsedNodesByFrame.set(entry.id, new Set());
    }

    if (collapsedFrames.length > 0) {
      for (const node of graph.nodes.values()) {
        const nodeBounds = getNodeBounds(node, this.layout);
        for (const entry of collapsedFrames) {
          if (!containsBounds(entry.bounds, nodeBounds)) {
            continue;
          }
          nodeCollapsedFrame.set(node.id, entry.id);
          hiddenNodes.add(node.id);
          const bucket = collapsedNodesByFrame.get(entry.id);
          if (bucket) {
            bucket.add(node.id);
          }
          break;
        }
      }
    }

    for (const frame of frameHierarchy.orderedFrames) {
      if (!frame.collapsed) {
        continue;
      }
      const contained = collapsedNodesByFrame.get(frame.id) ?? new Set();
      const ioState = buildFrameIoState(graph, frame, contained);
      frameIo.set(frame.id, ioState);
      const layout = getFrameSocketLayout(
        frame,
        ioState.inputs.map((socket) => socket.socketId),
        ioState.outputs.map((socket) => socket.socketId),
      );
      for (const entry of layout.inputs) {
        exposedSockets.add(entry.socketId);
        this.socketOverrides.set(entry.socketId, {
          x: frame.position.x + entry.x,
          y: frame.position.y + entry.y,
        });
      }
      for (const entry of layout.outputs) {
        exposedSockets.add(entry.socketId);
        this.socketOverrides.set(entry.socketId, {
          x: frame.position.x + entry.x,
          y: frame.position.y + entry.y,
        });
      }
    }

    for (const frame of frameHierarchy.orderedFrames) {
      seenFrames.add(frame.id);
      let view = this.frameViews.get(frame.id);
      if (!view) {
        view = new FrameView(frame, this.theme);
        this.frameViews.set(frame.id, view);
        this.layers.frames.addChild(view.container);
      }
      view.update(
        frame,
        {
          selected: selectedFrames.has(frame.id),
          hovered: hoveredFrameId === frame.id,
          collapsed: frame.collapsed ?? false,
          io: frameIo.get(frame.id) ?? null,
        },
        this.theme,
      );
      view.container.visible = intersectsBounds(
        worldBounds,
        getFrameBounds(frame),
      );
    }
    for (const node of graph.nodes.values()) {
      seenNodes.add(node.id);
      const nodeSockets = collectNodeSockets(graph, node);
      let view = this.nodeViews.get(node.id);
      if (!view) {
        view = new NodeView(node, nodeSockets, this.layout, this.theme);
        this.nodeViews.set(node.id, view);
        this.layers.nodes.addChild(view.container);
      }
      if (hiddenNodes.has(node.id)) {
        view.container.visible = false;
        continue;
      }
      const isSelected = selectedNodes.has(node.id);
      view.update(
        node,
        nodeSockets,
        this.layout,
        {
          selected: isSelected,
          hovered: hoveredNodeId === node.id,
          bypassed: bypassedNodes.has(node.id),
          hasError: errorNodes.has(node.id),
          collapsed: collapsedNodes.has(node.id),
        },
        this.theme,
        executionEnabled ? executionNodes.get(node.id) : undefined,
      );
      view.container.visible = intersectsBounds(
        worldBounds,
        getNodeBounds(node, this.layout),
      );
    }
    this.updateNodeOrder(graph, selectedNodes);

    const framesToRemove: FrameId[] = [];
    for (const [frameId, view] of this.frameViews.entries()) {
      if (!seenFrames.has(frameId)) {
        this.layers.frames.removeChild(view.container);
        view.destroy();
        framesToRemove.push(frameId);
      }
    }
    for (const frameId of framesToRemove) {
      this.frameViews.delete(frameId);
    }
    this.updateFrameOrder(frameHierarchy.orderedFrames);

    const nodesToRemove: NodeId[] = [];
    for (const [nodeId, view] of this.nodeViews.entries()) {
      if (!seenNodes.has(nodeId)) {
        this.layers.nodes.removeChild(view.container);
        view.destroy();
        nodesToRemove.push(nodeId);
      }
    }
    for (const nodeId of nodesToRemove) {
      this.nodeViews.delete(nodeId);
    }

    this.wireView.begin();
    this.visibleWires.clear();
    for (const wire of graph.wires.values()) {
      if (
        !isWireVisible(
          graph,
          wire,
          hiddenNodes,
          exposedSockets,
          nodeCollapsedFrame,
        )
      ) {
        continue;
      }
      const from = this.getSocketPosition(wire.fromSocketId);
      const to = this.getSocketPosition(wire.toSocketId);
      if (!from || !to) {
        continue;
      }
      const wireBounds = getWireBounds(from, to, WIRE_CULL_PADDING);
      if (!intersectsBounds(worldBounds, wireBounds)) {
        continue;
      }
      this.visibleWires.add(wire.id);
      this.wireView.drawWire(from, to, {
        color: getWireColor(graph, wire, this.theme.wire.defaultColor),
        selected: selectedWires.has(wire.id),
        hovered: hoveredWireId === wire.id,
      });
    }
    this.wireView.end();
  }

  updateWireFlow(timeMs: number, options: WireFlowOptions = {}): void {
    const graph = this.graph;
    if (!graph) {
      this.wireView.setFlowVisible(false);
      return;
    }
    const config = { ...DEFAULT_WIRE_FLOW, ...options };
    const zoom = this.camera.getZoom();
    if (
      !config.enabled ||
      zoom < config.minZoom ||
      this.visibleWires.size === 0 ||
      this.visibleWires.size > config.maxWires
    ) {
      this.wireView.setFlowVisible(false);
      return;
    }
    this.wireView.setFlowVisible(true);
    this.wireView.beginFlow();
    const timeSeconds = timeMs / 1000;
    for (const wire of graph.wires.values()) {
      if (!this.visibleWires.has(wire.id)) {
        continue;
      }
      const from = this.getSocketPosition(wire.fromSocketId);
      const to = this.getSocketPosition(wire.toSocketId);
      if (!from || !to) {
        continue;
      }
      const color = getWireColor(graph, wire, this.theme.wire.defaultColor);
      const progress = (timeSeconds * config.speed + hashWireId(wire.id)) % 1;
      this.wireView.drawFlow(from, to, { color }, progress, zoom);
    }
    this.wireView.endFlow();
  }

  private updateNodeOrder(
    graph: Graph,
    selectedNodes: ReadonlySet<NodeId>,
  ): void {
    const nodeIds = new Set<NodeId>(graph.nodes.keys());
    if (
      setsMatch(selectedNodes, this.lastSelectedNodes) &&
      setsMatch(nodeIds, this.lastOrderedNodes)
    ) {
      return;
    }
    const ordered: PIXI.Container[] = [];
    const selected: PIXI.Container[] = [];
    for (const node of graph.nodes.values()) {
      const view = this.nodeViews.get(node.id);
      if (!view) {
        continue;
      }
      if (selectedNodes.has(node.id)) {
        selected.push(view.container);
      } else {
        ordered.push(view.container);
      }
    }
    const nodesLayer = this.layers.nodes;
    const nextOrder = ordered.concat(selected);
    nodesLayer.removeChildren();
    if (nextOrder.length > 0) {
      nodesLayer.addChild(...nextOrder);
    }
    this.lastSelectedNodes = new Set(selectedNodes);
    this.lastOrderedNodes = nodeIds;
  }

  private updateFrameOrder(orderedFrames: ReadonlyArray<GraphFrame>): void {
    const orderedContainers: PIXI.Container[] = [];
    for (const frame of orderedFrames) {
      const view = this.frameViews.get(frame.id);
      if (view) {
        orderedContainers.push(view.container);
      }
    }
    const framesLayer = this.layers.frames;
    framesLayer.removeChildren();
    if (orderedContainers.length > 0) {
      framesLayer.addChild(...orderedContainers);
    }
    this.frameOrder = orderedFrames.map((frame) => frame.id);
  }

  hitTest(screenPoint: Point, options?: ScreenPointOptions): HitTestResult {
    const graph = this.graph;
    if (!graph) {
      return { kind: "none" };
    }
    const worldPoint = this.screenToWorld(screenPoint, options);
    const socketHit = this.hitTestSockets(graph, worldPoint);
    if (socketHit) {
      return socketHit;
    }
    const wireHit = this.hitTestWires(graph, worldPoint);
    if (wireHit) {
      return wireHit;
    }
    const nodeHit = this.hitTestNodes(graph, worldPoint);
    if (nodeHit) {
      return nodeHit;
    }
    const frameHit = this.hitTestFrames(graph, worldPoint);
    if (frameHit) {
      return frameHit;
    }
    return { kind: "none" };
  }

  private applyCameraTransform(): void {
    const transform = this.camera.getWorldTransform();
    this.layers.world.scale.set(transform.scale);
    this.layers.world.position.set(transform.position.x, transform.position.y);
  }

  private frameWorldBounds(
    bounds: WorldBounds,
    options: FrameOptions = {},
  ): void {
    const padding = Math.max(0, options.padding ?? 80);
    const screenSize = this.camera.getScreenSize();
    const worldWidth = Math.max(1, bounds.maxX - bounds.minX);
    const worldHeight = Math.max(1, bounds.maxY - bounds.minY);
    const availableWidth = Math.max(1, screenSize.width - padding * 2);
    const availableHeight = Math.max(1, screenSize.height - padding * 2);
    const zoom = Math.min(
      availableWidth / worldWidth,
      availableHeight / worldHeight,
    );
    const center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
    this.camera.setCenterAndZoom(center, zoom);
    this.applyCameraTransform();
  }

  private hitTestSockets(
    graph: Graph,
    worldPoint: Point,
  ): HitTestResult | null {
    const radius = this.hitTestConfig.socketRadius;
    const radiusSq = radius * radius;
    let best: {
      socketId: SocketId;
      nodeId: NodeId;
      position: Point;
      distanceSq: number;
    } | null = null;
    for (const socket of graph.sockets.values()) {
      const override = this.socketOverrides.get(socket.id);
      const nodeView = this.nodeViews.get(socket.nodeId);
      if (!override && nodeView && !nodeView.container.visible) {
        continue;
      }
      const position =
        override ?? getSocketPosition(graph, socket.id, this.layout);
      if (!position) {
        continue;
      }
      const distanceSq = distanceSquared(worldPoint, position);
      if (distanceSq > radiusSq) {
        continue;
      }
      if (!best || distanceSq < best.distanceSq) {
        best = {
          socketId: socket.id,
          nodeId: socket.nodeId,
          position,
          distanceSq,
        };
      }
    }
    if (!best) {
      return null;
    }
    return {
      kind: "socket",
      socketId: best.socketId,
      nodeId: best.nodeId,
      position: best.position,
    };
  }

  private hitTestWires(graph: Graph, worldPoint: Point): HitTestResult | null {
    const hitDistance = this.hitTestConfig.wireDistance;
    const hitDistanceSq = hitDistance * hitDistance;
    let best: {
      wireId: WireId;
      fromSocketId: SocketId;
      toSocketId: SocketId;
      distanceSq: number;
    } | null = null;
    for (const wire of graph.wires.values()) {
      if (!this.visibleWires.has(wire.id)) {
        continue;
      }
      const from = this.getSocketPosition(wire.fromSocketId);
      const to = this.getSocketPosition(wire.toSocketId);
      if (!from || !to) {
        continue;
      }
      const { cp1, cp2 } = getWireControlPoints(from, to);
      const distanceSq = distanceToBezierSquared(
        worldPoint,
        from,
        cp1,
        cp2,
        to,
      );
      if (distanceSq > hitDistanceSq) {
        continue;
      }
      if (!best || distanceSq < best.distanceSq) {
        best = {
          wireId: wire.id,
          fromSocketId: wire.fromSocketId,
          toSocketId: wire.toSocketId,
          distanceSq,
        };
      }
    }
    if (!best) {
      return null;
    }
    return {
      kind: "wire",
      wireId: best.wireId,
      fromSocketId: best.fromSocketId,
      toSocketId: best.toSocketId,
      distance: Math.sqrt(best.distanceSq),
    };
  }

  private hitTestNodes(graph: Graph, worldPoint: Point): HitTestResult | null {
    let hitNodeId: NodeId | null = null;
    for (const node of graph.nodes.values()) {
      const nodeView = this.nodeViews.get(node.id);
      if (nodeView && !nodeView.container.visible) {
        continue;
      }
      if (pointInBounds(worldPoint, getNodeBounds(node, this.layout))) {
        hitNodeId = node.id;
      }
    }
    if (!hitNodeId) {
      return null;
    }
    return { kind: "node", nodeId: hitNodeId };
  }

  private hitTestFrames(graph: Graph, worldPoint: Point): HitTestResult | null {
    const orderedFrameIds =
      this.frameOrder.length > 0
        ? this.frameOrder
        : Array.from(graph.frames.keys());
    let hitFrameId: FrameId | null = null;
    for (const frameId of orderedFrameIds) {
      const frame = graph.frames.get(frameId);
      if (!frame) {
        continue;
      }
      const frameView = this.frameViews.get(frame.id);
      if (frameView && !frameView.container.visible) {
        continue;
      }
      if (pointInBounds(worldPoint, getFrameBounds(frame))) {
        hitFrameId = frame.id;
      }
    }
    if (!hitFrameId) {
      return null;
    }
    return { kind: "frame", frameId: hitFrameId };
  }
}

const intersectsBounds = (a: WorldBounds, b: WorldBounds): boolean =>
  !(b.maxX < a.minX || b.minX > a.maxX || b.maxY < a.minY || b.minY > a.maxY);

const getNodeBounds = (node: GraphNode, layout: NodeLayout): WorldBounds => {
  const { width, height } = getNodeSize(node, layout);
  return {
    minX: node.position.x,
    minY: node.position.y,
    maxX: node.position.x + width,
    maxY: node.position.y + height,
  };
};

const getFrameBounds = (frame: GraphFrame): WorldBounds => ({
  minX: frame.position.x,
  minY: frame.position.y,
  maxX: frame.position.x + frame.size.width,
  maxY: frame.position.y + frame.size.height,
});

const containsBounds = (outer: WorldBounds, inner: WorldBounds): boolean =>
  outer.minX <= inner.minX &&
  outer.minY <= inner.minY &&
  outer.maxX >= inner.maxX &&
  outer.maxY >= inner.maxY;

type FrameMeta = Readonly<{
  id: FrameId;
  frame: GraphFrame;
  bounds: WorldBounds;
  area: number;
}>;

const buildFrameHierarchy = (
  frames: Iterable<GraphFrame>,
): Readonly<{
  orderedFrames: ReadonlyArray<GraphFrame>;
  framesByAreaAsc: ReadonlyArray<FrameMeta>;
}> => {
  const entries: FrameMeta[] = [];
  for (const frame of frames) {
    entries.push({
      id: frame.id,
      frame,
      bounds: getFrameBounds(frame),
      area: Math.max(0, frame.size.width) * Math.max(0, frame.size.height),
    });
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

  const depthByFrame = new Map<FrameId, number>();
  const resolveDepth = (frameId: FrameId): number => {
    const cached = depthByFrame.get(frameId);
    if (cached !== undefined) {
      return cached;
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

  return { orderedFrames, framesByAreaAsc };
};

const buildFrameIoState = (
  graph: Graph,
  frame: GraphFrame,
  containedNodes: ReadonlySet<NodeId>,
): FrameIoState => {
  const inputs: FrameIoLabel[] = [];
  const outputs: FrameIoLabel[] = [];
  const exposedInputs = frame.exposedInputs ?? [];
  const exposedOutputs = frame.exposedOutputs ?? [];
  for (const socketId of exposedInputs) {
    const socket = graph.sockets.get(socketId);
    if (
      socket &&
      socket.direction === "input" &&
      containedNodes.has(socket.nodeId)
    ) {
      const label = socket.label?.trim().length ? socket.label : socket.name;
      const visible = socket.labelSettings?.visible !== false;
      inputs.push({ socketId, label: visible ? label : "" });
    }
  }
  for (const socketId of exposedOutputs) {
    const socket = graph.sockets.get(socketId);
    if (
      socket &&
      socket.direction === "output" &&
      containedNodes.has(socket.nodeId)
    ) {
      const label = socket.label?.trim().length ? socket.label : socket.name;
      const visible = socket.labelSettings?.visible !== false;
      outputs.push({ socketId, label: visible ? label : "" });
    }
  }
  return { inputs, outputs };
};

const isWireVisible = (
  graph: Graph,
  wire: GraphWire,
  hiddenNodes: ReadonlySet<NodeId>,
  exposedSockets: ReadonlySet<SocketId>,
  nodeCollapsedFrame: ReadonlyMap<NodeId, FrameId>,
): boolean => {
  const fromSocket = graph.sockets.get(wire.fromSocketId);
  const toSocket = graph.sockets.get(wire.toSocketId);
  const fromHidden = fromSocket ? hiddenNodes.has(fromSocket.nodeId) : false;
  const toHidden = toSocket ? hiddenNodes.has(toSocket.nodeId) : false;
  if (!fromHidden && !toHidden) {
    return true;
  }
  const fromExposed = exposedSockets.has(wire.fromSocketId);
  const toExposed = exposedSockets.has(wire.toSocketId);
  if ((fromHidden && !fromExposed) || (toHidden && !toExposed)) {
    return false;
  }
  if (fromHidden && toHidden) {
    const fromFrame = fromSocket
      ? (nodeCollapsedFrame.get(fromSocket.nodeId) ?? null)
      : null;
    const toFrame = toSocket
      ? (nodeCollapsedFrame.get(toSocket.nodeId) ?? null)
      : null;
    if (fromFrame && toFrame && fromFrame === toFrame) {
      return false;
    }
  }
  return true;
};

const getBoundsForNodes = (
  graph: Graph,
  layout: NodeLayout,
  nodeIds?: Iterable<NodeId>,
): WorldBounds | null => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasNode = false;
  const addNode = (node: GraphNode): void => {
    const bounds = getNodeBounds(node, layout);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
    hasNode = true;
  };
  if (nodeIds) {
    for (const nodeId of nodeIds) {
      const node = graph.nodes.get(nodeId);
      if (node) {
        addNode(node);
      }
    }
  } else {
    for (const node of graph.nodes.values()) {
      addNode(node);
    }
  }
  if (!hasNode) {
    return null;
  }
  return { minX, minY, maxX, maxY };
};

const getWireBounds = (
  from: Point,
  to: Point,
  padding: number,
): WorldBounds => {
  const { cp1, cp2 } = getWireControlPoints(from, to);
  return {
    minX: Math.min(from.x, to.x, cp1.x, cp2.x) - padding,
    minY: Math.min(from.y, to.y, cp1.y, cp2.y) - padding,
    maxX: Math.max(from.x, to.x, cp1.x, cp2.x) + padding,
    maxY: Math.max(from.y, to.y, cp1.y, cp2.y) + padding,
  };
};

const pointInBounds = (point: Point, bounds: WorldBounds): boolean =>
  point.x >= bounds.minX &&
  point.x <= bounds.maxX &&
  point.y >= bounds.minY &&
  point.y <= bounds.maxY;

const distanceSquared = (from: Point, to: Point): number => {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  return dx * dx + dy * dy;
};

const distanceToBezierSquared = (
  point: Point,
  from: Point,
  cp1: Point,
  cp2: Point,
  to: Point,
): number => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const segments = Math.max(12, Math.ceil(length / 40));
  let best = Number.POSITIVE_INFINITY;
  let prev = from;
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    const current = getBezierPoint(from, cp1, cp2, to, t);
    const distanceSq = distanceToSegmentSquared(point, prev, current);
    if (distanceSq < best) {
      best = distanceSq;
    }
    prev = current;
  }
  return best;
};

const distanceToSegmentSquared = (
  point: Point,
  from: Point,
  to: Point,
): number => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) {
    return distanceSquared(point, from);
  }
  const t =
    ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy);
  const clamped = Math.min(1, Math.max(0, t));
  const projection = {
    x: from.x + clamped * dx,
    y: from.y + clamped * dy,
  };
  return distanceSquared(point, projection);
};

const parseHexColor = (color: string): number | null => {
  if (!color.startsWith("#")) {
    return null;
  }
  const value = Number.parseInt(color.slice(1), 16);
  return Number.isNaN(value) ? null : value;
};

const getWireColor = (
  graph: Graph,
  wire: GraphWire,
  fallback: number,
): number => {
  const fromSocket = graph.sockets.get(wire.fromSocketId);
  const toSocket = graph.sockets.get(wire.toSocketId);
  const typeId = fromSocket?.dataType ?? toSocket?.dataType;
  const metadata = typeId ? getSocketTypeMetadata(typeId) : undefined;
  const parsed = metadata ? parseHexColor(metadata.color) : null;
  return parsed ?? fallback;
};

const hashWireId = (wireId: WireId): number => {
  const value = String(wireId);
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 1000;
  }
  return hash / 1000;
};
