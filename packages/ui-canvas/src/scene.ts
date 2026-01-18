import type {
  Graph,
  GraphNode,
  NodeId,
  SocketId,
  WireId,
} from "@shadr/graph-core";
import type * as PIXI from "pixi.js";

import {
  Camera2D,
  type ScreenPointOptions,
  type ViewportSizeOptions,
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
import { WireView } from "./wire-view.js";

export type CanvasSceneOptions = Readonly<{
  layout?: NodeLayout;
  hitTest?: HitTestConfig;
}>;

export type CanvasSelection = Readonly<{
  selectedNodes?: ReadonlySet<NodeId>;
  selectedWires?: ReadonlySet<WireId>;
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

type WorldBounds = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

const WIRE_CULL_PADDING = 24;
const DEFAULT_HIT_TEST_CONFIG: Required<HitTestConfig> = {
  socketRadius: 10,
  wireDistance: 6,
};

export class CanvasScene {
  readonly root: PIXI.Container;
  readonly layers: SceneLayers;
  private readonly nodeViews = new Map<NodeId, NodeView>();
  private readonly wireViews = new Map<WireId, WireView>();
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

  syncGraph(graph: Graph, selection: CanvasSelection = {}): void {
    this.graph = graph;
    const worldBounds = this.camera.getWorldBounds();
    const selectedNodes = selection.selectedNodes ?? new Set<NodeId>();
    const selectedWires = selection.selectedWires ?? new Set<WireId>();
    const seenNodes = new Set<NodeId>();
    for (const node of graph.nodes.values()) {
      seenNodes.add(node.id);
      let view = this.nodeViews.get(node.id);
      if (!view) {
        view = new NodeView(node, this.layout);
        this.nodeViews.set(node.id, view);
        this.layers.nodes.addChild(view.container);
      }
      view.update(node, this.layout, selectedNodes.has(node.id));
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

    const seenWires = new Set<WireId>();
    for (const wire of graph.wires.values()) {
      seenWires.add(wire.id);
      let view = this.wireViews.get(wire.id);
      if (!view) {
        view = new WireView();
        this.wireViews.set(wire.id, view);
        this.layers.wires.addChild(view.graphics);
      }
      const from = getSocketPosition(graph, wire.fromSocketId, this.layout);
      const to = getSocketPosition(graph, wire.toSocketId, this.layout);
      if (!from || !to) {
        view.setVisible(false);
        continue;
      }
      const wireBounds = getWireBounds(from, to, WIRE_CULL_PADDING);
      if (!intersectsBounds(worldBounds, wireBounds)) {
        view.setVisible(false);
        continue;
      }
      view.setVisible(true);
      view.update(from, to, selectedWires.has(wire.id));
    }

    const wiresToRemove: WireId[] = [];
    for (const [wireId, view] of this.wireViews.entries()) {
      if (!seenWires.has(wireId)) {
        this.layers.wires.removeChild(view.graphics);
        view.destroy();
        wiresToRemove.push(wireId);
      }
    }
    for (const wireId of wiresToRemove) {
      this.wireViews.delete(wireId);
    }
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
      const wireView = this.wireViews.get(wire.id);
      if (wireView && !wireView.graphics.visible) {
        continue;
      }
      const from = getSocketPosition(graph, wire.fromSocketId, this.layout);
      const to = getSocketPosition(graph, wire.toSocketId, this.layout);
      if (!from || !to) {
        continue;
      }
      const distanceSq = distanceToSegmentSquared(worldPoint, from, to);
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

const getWireBounds = (
  from: Point,
  to: Point,
  padding: number,
): WorldBounds => ({
  minX: Math.min(from.x, to.x) - padding,
  minY: Math.min(from.y, to.y) - padding,
  maxX: Math.max(from.x, to.x) + padding,
  maxY: Math.max(from.y, to.y) + padding,
});

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
