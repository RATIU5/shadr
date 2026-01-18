import type {
  Graph,
  GraphNode,
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
import { createSceneLayers, type SceneLayers } from "./layers.js";
import {
  defaultNodeLayout,
  getNodeSize,
  getSocketPosition,
  type NodeLayout,
} from "./layout.js";
import { NodeView } from "./node-view.js";
import type { Point, Size } from "./types.js";
import { getBezierPoint, getWireControlPoints } from "./wire-geometry.js";
import { WireBatchView } from "./wire-view.js";

export type CanvasSceneOptions = Readonly<{
  layout?: NodeLayout;
  hitTest?: HitTestConfig;
}>;

export type FrameOptions = Readonly<{
  padding?: number;
}>;

export type CanvasSelection = Readonly<{
  selectedNodes?: ReadonlySet<NodeId>;
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
      kind: "none";
    }>;

const WIRE_CULL_PADDING = 24;
const DEFAULT_WIRE_COLOR = 0x4d7cff;
const DEFAULT_HIT_TEST_CONFIG: Required<HitTestConfig> = {
  socketRadius: 10,
  wireDistance: 6,
};
const EMPTY_NODE_SET: ReadonlySet<NodeId> = new Set();
const EMPTY_WIRE_SET: ReadonlySet<WireId> = new Set();

export class CanvasScene {
  readonly root: PIXI.Container;
  readonly layers: SceneLayers;
  private readonly nodeViews = new Map<NodeId, NodeView>();
  private readonly wireView: WireBatchView;
  private readonly visibleWires = new Set<WireId>();
  private layout: NodeLayout;
  private readonly camera: Camera2D;
  private graph: Graph | null = null;
  private readonly hitTestConfig: Required<HitTestConfig>;

  constructor(options: CanvasSceneOptions = {}) {
    this.layers = createSceneLayers();
    this.root = this.layers.root;
    this.layout = options.layout ?? defaultNodeLayout;
    this.hitTestConfig = { ...DEFAULT_HIT_TEST_CONFIG, ...options.hitTest };
    this.camera = new Camera2D();
    this.wireView = new WireBatchView();
    this.layers.wires.addChild(this.wireView.normalGraphics);
    this.layers.wires.addChild(this.wireView.selectedGraphics);
    this.layers.wires.addChild(this.wireView.hoveredGraphics);
    this.applyCameraTransform();
  }

  attachTo(stage: PIXI.Container): void {
    stage.addChild(this.root);
  }

  setLayout(layout: NodeLayout): void {
    this.layout = layout;
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
  ): void {
    this.graph = graph;
    const worldBounds = this.camera.getWorldBounds();
    const selectedNodes = selection.selectedNodes ?? EMPTY_NODE_SET;
    const selectedWires = selection.selectedWires ?? EMPTY_WIRE_SET;
    const hoveredNodeId = nodeState.hoveredNodeId ?? null;
    const hoveredWireId = wireState.hoveredWireId ?? null;
    const bypassedNodes = nodeState.bypassedNodes ?? EMPTY_NODE_SET;
    const errorNodes = nodeState.errorNodes ?? EMPTY_NODE_SET;
    const collapsedNodes = nodeState.collapsedNodes ?? EMPTY_NODE_SET;
    const seenNodes = new Set<NodeId>();
    for (const node of graph.nodes.values()) {
      seenNodes.add(node.id);
      let view = this.nodeViews.get(node.id);
      if (!view) {
        view = new NodeView(node, this.layout);
        this.nodeViews.set(node.id, view);
        this.layers.nodes.addChild(view.container);
      }
      view.update(node, this.layout, {
        selected: selectedNodes.has(node.id),
        hovered: hoveredNodeId === node.id,
        bypassed: bypassedNodes.has(node.id),
        hasError: errorNodes.has(node.id),
        collapsed: collapsedNodes.has(node.id),
      });
      view.container.visible = intersectsBounds(
        worldBounds,
        getNodeBounds(node, this.layout),
      );
    }

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
      const from = getSocketPosition(graph, wire.fromSocketId, this.layout);
      const to = getSocketPosition(graph, wire.toSocketId, this.layout);
      if (!from || !to) {
        continue;
      }
      const wireBounds = getWireBounds(from, to, WIRE_CULL_PADDING);
      if (!intersectsBounds(worldBounds, wireBounds)) {
        continue;
      }
      this.visibleWires.add(wire.id);
      this.wireView.drawWire(from, to, {
        color: getWireColor(graph, wire),
        selected: selectedWires.has(wire.id),
        hovered: hoveredWireId === wire.id,
      });
    }
    this.wireView.end();
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
      const nodeView = this.nodeViews.get(socket.nodeId);
      if (nodeView && !nodeView.container.visible) {
        continue;
      }
      const position = getSocketPosition(graph, socket.id, this.layout);
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
      const from = getSocketPosition(graph, wire.fromSocketId, this.layout);
      const to = getSocketPosition(graph, wire.toSocketId, this.layout);
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

const getWireColor = (graph: Graph, wire: GraphWire): number => {
  const fromSocket = graph.sockets.get(wire.fromSocketId);
  const toSocket = graph.sockets.get(wire.toSocketId);
  const typeId = fromSocket?.dataType ?? toSocket?.dataType;
  const metadata = typeId ? getSocketTypeMetadata(typeId) : undefined;
  const parsed = metadata ? parseHexColor(metadata.color) : null;
  return parsed ?? DEFAULT_WIRE_COLOR;
};
