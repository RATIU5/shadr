import type {
  GraphNode,
  GraphSocket,
  GraphWire,
  NodeId,
  SocketId,
  WireId,
} from "@shadr/graph-core";
import { downstreamClosure, upstreamClosure } from "@shadr/graph-core";
import type { NodeDefinition } from "@shadr/plugin-system";
import type { JsonObject, JsonValue } from "@shadr/shared";
import {
  isSocketTypeCompatible,
  makeNodeId,
  makeSocketId,
  makeWireId,
} from "@shadr/shared";
import {
  CanvasScene,
  type CanvasTheme,
  darkCanvasTheme,
  defaultNodeLayout,
  getNodeHeaderToggleBounds,
  getNodeSize,
  getSocketPosition,
  getWireControlPoints,
  lightCanvasTheme,
  type NodeLayout,
} from "@shadr/ui-canvas";
import { Either } from "effect";
import type { Application, Graphics } from "pixi.js";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";

import NodeParamMeasure, {
  type NodeParamSize,
} from "~/components/NodeParamMeasure";
import {
  createMoveNodesCommand,
  createRemoveNodeCommand,
  createRemoveWireCommand,
  type GraphCommand,
  isNoopCommand,
} from "~/editor/history";
import {
  getNodeCatalogEntry,
  isRerouteNodeType,
  NODE_CATALOG,
  NODE_DRAG_TYPE,
  resolveNodeDefinition,
} from "~/editor/node-catalog";
import { GRID_SIZE, snapPointToGrid } from "~/editor/settings";
import type { EditorStore } from "~/editor/store";
import { runAppEffectSyncEither } from "~/services/runtime";

type Point = Readonly<{ x: number; y: number }>;
type Bounds = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;
type WireHoverStatus = "neutral" | "valid" | "invalid";
type SocketTooltip = Readonly<{
  x: number;
  y: number;
  title: string;
  typeLabel: string;
  valueLabel: string;
}>;
type ContextMenuState = Readonly<{
  screen: Point;
  world: Point;
  hit: ReturnType<CanvasScene["hitTest"]>;
}>;
type ContextMenuEntry =
  | Readonly<{
      kind: "item";
      label: string;
      onSelect: () => void;
    }>
  | Readonly<{
      kind: "separator";
    }>;

type ThemeScheme = "dark" | "light";
type CanvasPalette = Readonly<{
  scheme: ThemeScheme;
  sceneTheme: CanvasTheme;
  background: number;
  gridMinor: number;
  gridMajor: number;
  gridAxis: number;
  marquee: number;
  wireHoverNeutral: number;
  wireHoverValid: number;
  wireHoverInvalid: number;
}>;

const getCanvasPalette = (scheme: ThemeScheme): CanvasPalette => {
  if (scheme === "light") {
    return {
      scheme,
      sceneTheme: lightCanvasTheme,
      background: 0xf4f6fb,
      gridMinor: 0xd4dde8,
      gridMajor: 0xc0cada,
      gridAxis: 0x9fb2c9,
      marquee: 0x2563eb,
      wireHoverNeutral: 0x2563eb,
      wireHoverValid: 0x16a34a,
      wireHoverInvalid: 0xdc2626,
    };
  }
  return {
    scheme,
    sceneTheme: darkCanvasTheme,
    background: 0x0d0f14,
    gridMinor: 0x1b2836,
    gridMajor: 0x1f3346,
    gridAxis: 0x2a3e56,
    marquee: 0x4fb3ff,
    wireHoverNeutral: 0x7bf1ff,
    wireHoverValid: 0x45d188,
    wireHoverInvalid: 0xff6b6b,
  };
};

type DragState =
  | { kind: "none" }
  | {
      kind: "drag-nodes";
      origin: Point;
      startPositions: Map<NodeId, Point>;
      bounds: Bounds;
    }
  | {
      kind: "marquee";
      origin: Point;
      current: Point;
      additive: boolean;
    }
  | {
      kind: "wire";
      fromSocketId: SocketId;
      fromPosition: Point;
      current: Point;
    }
  | {
      kind: "pan";
      lastScreen: Point;
    };

type EditorCanvasProps = Readonly<{
  store: EditorStore;
  onViewportEmpty?: () => void;
}>;

type ClipboardPayload = Readonly<{
  kind: "shadr-clipboard";
  version: 1;
  nodes: ReadonlyArray<GraphNode>;
  sockets: ReadonlyArray<GraphSocket>;
  wires: ReadonlyArray<GraphWire>;
}>;

type WireInsertCandidate = Readonly<{
  nodeType: string;
  label: string;
  inputKey: string;
  outputKey: string;
}>;

// eslint-disable-next-line no-unused-vars -- type-only param name required by TS function syntax
type IdFactory<T> = (value: string) => T;

const CLIPBOARD_KIND = "shadr-clipboard";
const CLIPBOARD_VERSION = 1 as const;
let clipboardFallback: ClipboardPayload | null = null;
const DUPLICATE_OFFSET: Point = { x: 32, y: 32 };
const LONG_PRESS_DURATION_MS = 450;
const LONG_PRESS_MOVE_THRESHOLD = 8;
const WIRE_INSERT_NODE_TYPES: Record<string, ReadonlyArray<string>> = {
  float: ["reroute-float", "clamp"],
  int: ["reroute-int"],
  bool: ["reroute-bool"],
  vec2: ["reroute-vec2", "swizzle-vec2"],
  vec3: ["reroute-vec3", "swizzle-vec3"],
  vec4: ["reroute-vec4", "swizzle-vec4"],
  mat3: ["reroute-mat3"],
  mat4: ["reroute-mat4"],
  sampler2D: ["reroute-sampler2d"],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isJsonObject = (value: JsonValue): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cloneJsonValue = (value: JsonValue): JsonValue => {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => cloneJsonValue(entry ?? null));
  }
  if (isJsonObject(value)) {
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value)) {
      const entry = value[key];
      if (entry !== undefined) {
        result[key] = cloneJsonValue(entry);
      }
    }
    return result;
  }
  return value;
};

const isGraphNodeValue = (value: unknown): value is GraphNode => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.id !== "string" || typeof value.type !== "string") {
    return false;
  }
  if (!isRecord(value.position)) {
    return false;
  }
  if (
    typeof value.position.x !== "number" ||
    typeof value.position.y !== "number"
  ) {
    return false;
  }
  if (!isRecord(value.params)) {
    return false;
  }
  if (!isStringArray(value.inputs) || !isStringArray(value.outputs)) {
    return false;
  }
  return true;
};

const isGraphSocketValue = (value: unknown): value is GraphSocket => {
  if (!isRecord(value)) {
    return false;
  }
  if (
    typeof value.id !== "string" ||
    typeof value.nodeId !== "string" ||
    typeof value.name !== "string" ||
    typeof value.dataType !== "string"
  ) {
    return false;
  }
  if (value.direction !== "input" && value.direction !== "output") {
    return false;
  }
  if (typeof value.required !== "boolean") {
    return false;
  }
  if (
    value.minConnections !== undefined &&
    typeof value.minConnections !== "number"
  ) {
    return false;
  }
  if (
    value.maxConnections !== undefined &&
    typeof value.maxConnections !== "number"
  ) {
    return false;
  }
  return true;
};

const isGraphWireValue = (value: unknown): value is GraphWire => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.fromSocketId === "string" &&
    typeof value.toSocketId === "string"
  );
};

const isClipboardPayload = (value: unknown): value is ClipboardPayload => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind !== CLIPBOARD_KIND || value.version !== CLIPBOARD_VERSION) {
    return false;
  }
  if (!Array.isArray(value.nodes) || !Array.isArray(value.sockets)) {
    return false;
  }
  if (!Array.isArray(value.wires)) {
    return false;
  }
  if (!value.nodes.every(isGraphNodeValue)) {
    return false;
  }
  if (!value.sockets.every(isGraphSocketValue)) {
    return false;
  }
  if (!value.wires.every(isGraphWireValue)) {
    return false;
  }
  return true;
};

export default function EditorCanvas(props: EditorCanvasProps) {
  let container: HTMLDivElement | undefined;
  let app: Application | null = null;
  let scene: CanvasScene | null = null;
  let gridGraphics: Graphics | null = null;
  let dragState: DragState = { kind: "none" };
  let isViewportEmpty = false;
  let canvasPalette: CanvasPalette = getCanvasPalette("dark");

  const { onViewportEmpty } = props;
  const {
    graph,
    dirtyState,
    selectedNodes,
    selectedWires,
    bypassedNodes,
    collapsedNodes,
    settings,
    canvasCenter,
    pointerPosition,
    commandPaletteOpen,
    applyGraphCommand,
    applyGraphCommandTransient,
    recordGraphCommand,
    beginHistoryBatch,
    commitHistoryBatch,
    refreshActiveOutput,
    clearSelection,
    setNodeSelection,
    setWireSelection,
    setCanvasCenter,
    setPointerPosition,
    setCommandPaletteOpen,
    toggleBypassNodes,
    toggleCollapsedNodes,
    addNodeAt,
    undo,
    redo,
  } = props.store;

  let graphSnapshot = graph();
  let dirtyStateSnapshot = dirtyState();
  let selectedNodesSnapshot = selectedNodes();
  let selectedWiresSnapshot = selectedWires();
  let bypassedNodesSnapshot = bypassedNodes();
  let collapsedNodesSnapshot = collapsedNodes();
  let settingsSnapshot = settings();
  let commandPaletteOpenSnapshot = commandPaletteOpen();
  let hoveredNodeIdSnapshot: NodeId | null = null;
  let hoveredWireIdSnapshot: WireId | null = null;
  let wireCounter = 1;
  let lastAppliedCenter: Point | null = null;

  const nextWireId = (): WireId => {
    let candidate = makeWireId(`wire-${wireCounter}`);
    while (graphSnapshot.wires.has(candidate)) {
      wireCounter += 1;
      candidate = makeWireId(`wire-${wireCounter}`);
    }
    wireCounter += 1;
    return candidate;
  };

  const parseClipboardPayload = (text: string): ClipboardPayload | null => {
    try {
      const parsed = JSON.parse(text) as unknown;
      return isClipboardPayload(parsed) ? parsed : null;
    } catch (error) {
      console.warn("Clipboard parse failed", error);
      return null;
    }
  };

  const writeClipboardPayload = async (
    payload: ClipboardPayload,
  ): Promise<void> => {
    clipboardFallback = payload;
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
    } catch (error) {
      console.warn("Clipboard write failed", error);
    }
  };

  const readClipboardPayload = async (): Promise<ClipboardPayload | null> => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        const parsed = parseClipboardPayload(text);
        if (parsed) {
          return parsed;
        }
      } catch (error) {
        console.warn("Clipboard read failed", error);
      }
    }
    return clipboardFallback;
  };

  const createIdFactory = <T,>(
    prefix: string,
    existing: Set<T>,
    makeId: IdFactory<T>,
  ): (() => T) => {
    let index = 1;
    return () => {
      let candidate = makeId(`${prefix}-${index}`);
      while (existing.has(candidate)) {
        index += 1;
        candidate = makeId(`${prefix}-${index}`);
      }
      existing.add(candidate);
      index += 1;
      return candidate;
    };
  };

  const buildPasteCommands = (
    payload: ClipboardPayload,
    offset: Point,
  ): { commands: GraphCommand[]; newNodeIds: NodeId[] } | null => {
    if (payload.nodes.length === 0) {
      return null;
    }

    const usedNodeIds = new Set<NodeId>(graphSnapshot.nodes.keys());
    const usedWireIds = new Set<WireId>(graphSnapshot.wires.keys());
    const nextNodeId = createIdFactory<NodeId>("node", usedNodeIds, makeNodeId);
    const nextWireId = createIdFactory<WireId>("wire", usedWireIds, makeWireId);

    const socketsByNode = new Map<NodeId, GraphSocket[]>();
    for (const socket of payload.sockets) {
      const bucket = socketsByNode.get(socket.nodeId);
      if (bucket) {
        bucket.push(socket);
      } else {
        socketsByNode.set(socket.nodeId, [socket]);
      }
    }

    const socketIdMap = new Map<SocketId, SocketId>();
    const commands: GraphCommand[] = [];
    const newNodeIds: NodeId[] = [];

    for (const node of payload.nodes) {
      const newNodeId = nextNodeId();
      newNodeIds.push(newNodeId);
      const nodeSockets = socketsByNode.get(node.id) ?? [];
      const newSockets = nodeSockets.map((socket) => {
        const newSocketId = makeSocketId(`${newNodeId}.${socket.name}`);
        socketIdMap.set(socket.id, newSocketId);
        return {
          ...socket,
          id: newSocketId,
          nodeId: newNodeId,
        };
      });
      const newInputs = node.inputs.flatMap((socketId) => {
        const mapped = socketIdMap.get(socketId);
        return mapped ? [mapped] : [];
      });
      const newOutputs = node.outputs.flatMap((socketId) => {
        const mapped = socketIdMap.get(socketId);
        return mapped ? [mapped] : [];
      });
      const newNode: GraphNode = {
        ...node,
        id: newNodeId,
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y,
        },
        params: cloneJsonValue(node.params) as JsonObject,
        inputs: newInputs,
        outputs: newOutputs,
      };
      commands.push({
        kind: "add-node",
        node: newNode,
        sockets: newSockets,
      });
    }

    for (const wire of payload.wires) {
      const fromSocketId = socketIdMap.get(wire.fromSocketId);
      const toSocketId = socketIdMap.get(wire.toSocketId);
      if (!fromSocketId || !toSocketId) {
        continue;
      }
      commands.push({
        kind: "add-wire",
        wire: {
          id: nextWireId(),
          fromSocketId,
          toSocketId,
        },
      });
    }

    if (commands.length === 0) {
      return null;
    }

    return { commands, newNodeIds };
  };

  const resolveCopyNodeIds = (): Set<NodeId> => {
    if (selectedNodesSnapshot.size > 0) {
      return new Set(selectedNodesSnapshot);
    }
    const nodeIds = new Set<NodeId>();
    for (const wireId of selectedWiresSnapshot) {
      const wire = graphSnapshot.wires.get(wireId);
      if (!wire) {
        continue;
      }
      const fromSocket = graphSnapshot.sockets.get(wire.fromSocketId);
      const toSocket = graphSnapshot.sockets.get(wire.toSocketId);
      if (fromSocket) {
        nodeIds.add(fromSocket.nodeId);
      }
      if (toSocket) {
        nodeIds.add(toSocket.nodeId);
      }
    }
    return nodeIds;
  };

  const buildClipboardPayload = (): ClipboardPayload | null => {
    const nodeIds = resolveCopyNodeIds();
    if (nodeIds.size === 0) {
      return null;
    }
    const nodes: GraphNode[] = [];
    const socketIds = new Set<SocketId>();
    for (const nodeId of nodeIds) {
      const node = graphSnapshot.nodes.get(nodeId);
      if (!node) {
        continue;
      }
      nodes.push({
        ...node,
        position: { ...node.position },
        params: cloneJsonValue(node.params) as JsonObject,
      });
      for (const socketId of node.inputs) {
        socketIds.add(socketId);
      }
      for (const socketId of node.outputs) {
        socketIds.add(socketId);
      }
    }
    const sockets: GraphSocket[] = [];
    for (const socketId of socketIds) {
      const socket = graphSnapshot.sockets.get(socketId);
      if (socket) {
        sockets.push({ ...socket });
      }
    }
    const wires: GraphWire[] = [];
    for (const wire of graphSnapshot.wires.values()) {
      if (socketIds.has(wire.fromSocketId) && socketIds.has(wire.toSocketId)) {
        wires.push({ ...wire });
      }
    }
    return {
      kind: CLIPBOARD_KIND,
      version: CLIPBOARD_VERSION,
      nodes,
      sockets,
      wires,
    };
  };

  const pasteClipboardPayload = async (): Promise<void> => {
    const payload = await readClipboardPayload();
    if (!payload || payload.nodes.length === 0) {
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    for (const node of payload.nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return;
    }
    const anchor = pointerPosition()?.world ?? canvasCenter();
    const offset = { x: anchor.x - minX, y: anchor.y - minY };
    const payloadResult = buildPasteCommands(payload, offset);
    if (!payloadResult) {
      return;
    }
    if (applyCommands("paste-selection", payloadResult.commands)) {
      setNodeSelection(new Set(payloadResult.newNodeIds));
    }
  };

  const duplicateSelection = (): void => {
    const payload = buildClipboardPayload();
    if (!payload) {
      return;
    }
    const payloadResult = buildPasteCommands(payload, DUPLICATE_OFFSET);
    if (!payloadResult) {
      return;
    }
    if (applyCommands("duplicate-selection", payloadResult.commands)) {
      setNodeSelection(new Set(payloadResult.newNodeIds));
    }
  };
  const [socketTooltip, setSocketTooltip] = createSignal<SocketTooltip | null>(
    null,
  );
  const [hoveredNodeId, setHoveredNodeId] = createSignal<NodeId | null>(null);
  const [hoveredWireId, setHoveredWireId] = createSignal<WireId | null>(null);
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState | null>(
    null,
  );
  const [paramPanelSizes, setParamPanelSizes] = createSignal(
    new Map<string, NodeParamSize>(),
  );
  const contentWidth =
    defaultNodeLayout.width - defaultNodeLayout.bodyPadding * 2;
  const rerouteNodeSize = 16;
  const layout: NodeLayout = {
    ...defaultNodeLayout,
    getNodeTitle: (node) => getNodeCatalogEntry(node.type)?.label ?? node.type,
    getContentSize: (node) =>
      collapsedNodesSnapshot.has(node.id)
        ? null
        : (paramPanelSizes().get(node.type) ?? null),
    getNodeSizeOverride: (node) =>
      isRerouteNodeType(node.type)
        ? { width: rerouteNodeSize, height: rerouteNodeSize }
        : null,
    getSocketPositionOverride: (node) =>
      isRerouteNodeType(node.type)
        ? {
            x: node.position.x + rerouteNodeSize / 2,
            y: node.position.y + rerouteNodeSize / 2,
          }
        : null,
    isRerouteNode: (node) => isRerouteNodeType(node.type),
  };

  const applySnap = (point: Point): Point =>
    settingsSnapshot.snapToGrid ? snapPointToGrid(point) : point;

  const isHeaderToggleHit = (node: GraphNode, worldPoint: Point): boolean => {
    if (layout.isRerouteNode?.(node)) {
      return false;
    }
    const localX = worldPoint.x - node.position.x;
    const localY = worldPoint.y - node.position.y;
    const bounds = getNodeHeaderToggleBounds(layout);
    return (
      localX >= bounds.x &&
      localX <= bounds.x + bounds.size &&
      localY >= bounds.y &&
      localY <= bounds.y + bounds.size
    );
  };

  const getDragBounds = (positions: Map<NodeId, Point>): Bounds | null => {
    let bounds: Bounds | null = null;
    for (const [nodeId, position] of positions.entries()) {
      const node = graphSnapshot.nodes.get(nodeId);
      if (!node) {
        continue;
      }
      const { width, height } = getNodeSize(node, layout);
      const nodeBounds = {
        minX: position.x,
        minY: position.y,
        maxX: position.x + width,
        maxY: position.y + height,
      };
      if (!bounds) {
        bounds = nodeBounds;
      } else {
        bounds = {
          minX: Math.min(bounds.minX, nodeBounds.minX),
          minY: Math.min(bounds.minY, nodeBounds.minY),
          maxX: Math.max(bounds.maxX, nodeBounds.maxX),
          maxY: Math.max(bounds.maxY, nodeBounds.maxY),
        };
      }
    }
    return bounds;
  };

  const getDragDelta = (
    origin: Point,
    current: Point,
    bounds: Bounds,
  ): Point => {
    const delta = {
      x: current.x - origin.x,
      y: current.y - origin.y,
    };
    if (!settingsSnapshot.snapToGrid) {
      return delta;
    }
    const anchor = { x: bounds.minX, y: bounds.minY };
    const snappedAnchor = applySnap({
      x: anchor.x + delta.x,
      y: anchor.y + delta.y,
    });
    return {
      x: snappedAnchor.x - anchor.x,
      y: snappedAnchor.y - anchor.y,
    };
  };

  const isAnyNodeInView = (): boolean => {
    if (!scene) {
      return false;
    }
    if (graphSnapshot.nodes.size === 0) {
      return false;
    }
    const worldBounds = scene.getWorldBounds();
    for (const node of graphSnapshot.nodes.values()) {
      const { width, height } = getNodeSize(node, layout);
      const nodeBounds = {
        minX: node.position.x,
        minY: node.position.y,
        maxX: node.position.x + width,
        maxY: node.position.y + height,
      };
      const intersects =
        nodeBounds.maxX >= worldBounds.minX &&
        nodeBounds.minX <= worldBounds.maxX &&
        nodeBounds.maxY >= worldBounds.minY &&
        nodeBounds.minY <= worldBounds.maxY;
      if (intersects) {
        return true;
      }
    }
    return false;
  };

  const updateViewportEmptyState = (): void => {
    if (!onViewportEmpty) {
      return;
    }
    if (graphSnapshot.nodes.size === 0) {
      isViewportEmpty = false;
      return;
    }
    const hasVisibleNodes = isAnyNodeInView();
    const nextEmpty = !hasVisibleNodes;
    if (nextEmpty && !isViewportEmpty) {
      onViewportEmpty();
    }
    isViewportEmpty = nextEmpty;
  };

  const applyCanvasPalette = (): void => {
    if (!scene || !app) {
      return;
    }
    scene.setTheme(canvasPalette.sceneTheme);
    const renderer = app.renderer as { background?: unknown };
    const background = renderer.background;
    if (
      background &&
      typeof background === "object" &&
      "color" in background &&
      typeof (background as { color?: unknown }).color === "number"
    ) {
      (background as { color: number }).color = canvasPalette.background;
    }
  };

  const updateGrid = (): void => {
    if (!scene || !gridGraphics || !container) {
      return;
    }
    if (!settingsSnapshot.gridVisible) {
      gridGraphics.visible = false;
      return;
    }
    gridGraphics.visible = true;
    gridGraphics.clear();
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) {
      return;
    }
    const topLeft = scene.screenToWorld({ x: 0, y: 0 });
    const bottomRight = scene.screenToWorld({ x: width, y: height });
    const minX = Math.min(topLeft.x, bottomRight.x);
    const maxX = Math.max(topLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, bottomRight.y);
    const maxY = Math.max(topLeft.y, bottomRight.y);
    const startX = Math.floor(minX / GRID_SIZE) * GRID_SIZE;
    const endX = Math.ceil(maxX / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(minY / GRID_SIZE) * GRID_SIZE;
    const endY = Math.ceil(maxY / GRID_SIZE) * GRID_SIZE;
    const zoom = Math.max(scene.getZoom(), 0.001);
    const clamp = (value: number, min: number, max: number): number =>
      Math.min(Math.max(value, min), max);
    const smoothstep = (
      spacingPx: number,
      minPx: number,
      maxPx: number,
    ): number => {
      const t = clamp((spacingPx - minPx) / (maxPx - minPx), 0, 1);
      return t * t * (3 - 2 * t);
    };
    const lineWidth = 1 / zoom;
    const minorSpacing = GRID_SIZE;
    const majorSpacing = GRID_SIZE * 4;
    const minorAlpha = clamp(
      smoothstep(minorSpacing * zoom, 6, 22) * 0.18,
      0,
      0.18,
    );
    const majorAlpha = clamp(
      smoothstep(majorSpacing * zoom, 10, 60) * 0.45,
      0,
      0.45,
    );

    if (minorAlpha > 0) {
      const minorStartX = Math.floor(minX / minorSpacing) * minorSpacing;
      const minorEndX = Math.ceil(maxX / minorSpacing) * minorSpacing;
      const minorStartY = Math.floor(minY / minorSpacing) * minorSpacing;
      const minorEndY = Math.ceil(maxY / minorSpacing) * minorSpacing;
      for (let x = minorStartX; x <= minorEndX; x += minorSpacing) {
        if (x % majorSpacing === 0) {
          continue;
        }
        gridGraphics.moveTo(x, startY);
        gridGraphics.lineTo(x, endY);
      }
      for (let y = minorStartY; y <= minorEndY; y += minorSpacing) {
        if (y % majorSpacing === 0) {
          continue;
        }
        gridGraphics.moveTo(startX, y);
        gridGraphics.lineTo(endX, y);
      }
      gridGraphics.stroke({
        width: lineWidth,
        color: canvasPalette.gridMinor,
        alpha: minorAlpha,
      });
    }

    if (majorAlpha > 0) {
      const majorStartX = Math.floor(minX / majorSpacing) * majorSpacing;
      const majorEndX = Math.ceil(maxX / majorSpacing) * majorSpacing;
      const majorStartY = Math.floor(minY / majorSpacing) * majorSpacing;
      const majorEndY = Math.ceil(maxY / majorSpacing) * majorSpacing;
      for (let x = majorStartX; x <= majorEndX; x += majorSpacing) {
        gridGraphics.moveTo(x, startY);
        gridGraphics.lineTo(x, endY);
      }
      for (let y = majorStartY; y <= majorEndY; y += majorSpacing) {
        gridGraphics.moveTo(startX, y);
        gridGraphics.lineTo(endX, y);
      }
      gridGraphics.stroke({
        width: lineWidth * 1.4,
        color: canvasPalette.gridMajor,
        alpha: majorAlpha,
      });
    }

    const axisWidth = 1.6 / zoom;
    const axisAlpha = 0.7;
    if (0 >= minX && 0 <= maxX) {
      gridGraphics.moveTo(0, startY);
      gridGraphics.lineTo(0, endY);
      gridGraphics.stroke({
        width: axisWidth,
        color: canvasPalette.gridAxis,
        alpha: axisAlpha,
      });
    }
    if (0 >= minY && 0 <= maxY) {
      gridGraphics.moveTo(startX, 0);
      gridGraphics.lineTo(endX, 0);
      gridGraphics.stroke({
        width: axisWidth,
        color: canvasPalette.gridAxis,
        alpha: axisAlpha,
      });
    }
  };

  const syncScene = (): void => {
    scene?.syncGraph(
      graphSnapshot,
      {
        selectedNodes: selectedNodesSnapshot,
        selectedWires: selectedWiresSnapshot,
      },
      {
        hoveredNodeId: hoveredNodeIdSnapshot,
        bypassedNodes: bypassedNodesSnapshot,
        collapsedNodes: collapsedNodesSnapshot,
        errorNodes: new Set(dirtyStateSnapshot.nodeErrors.keys()),
      },
      {
        hoveredWireId: hoveredWireIdSnapshot,
      },
    );
    updateGrid();
    updateViewportEmptyState();
  };

  const applyCommands = (label: string, commands: GraphCommand[]): boolean => {
    if (commands.length === 0) {
      return false;
    }
    beginHistoryBatch(label);
    let changed = false;
    for (const command of commands) {
      if (applyGraphCommandTransient(command)) {
        recordGraphCommand(command);
        changed = true;
      }
    }
    commitHistoryBatch();
    if (changed) {
      refreshActiveOutput();
    }
    return changed;
  };

  const removeWires = (wireIds: Iterable<WireId>, label: string): boolean => {
    const commands = Array.from(wireIds)
      .map((wireId) => createRemoveWireCommand(graphSnapshot, wireId))
      .filter((command): command is NonNullable<typeof command> => !!command);
    const changed = applyCommands(label, commands);
    if (changed) {
      setWireSelection(new Set<WireId>());
    }
    return changed;
  };

  const removeNodes = (nodeIds: Iterable<NodeId>, label: string): boolean => {
    const commands = Array.from(nodeIds)
      .map((nodeId) => createRemoveNodeCommand(graphSnapshot, nodeId))
      .filter((command): command is NonNullable<typeof command> => !!command);
    const changed = applyCommands(label, commands);
    if (changed) {
      clearSelection();
    }
    return changed;
  };

  const disconnectInputSocket = (socketId: SocketId): void => {
    const wiresToRemove: WireId[] = [];
    for (const wire of graphSnapshot.wires.values()) {
      if (wire.toSocketId === socketId) {
        wiresToRemove.push(wire.id);
      }
    }
    removeWires(wiresToRemove, "disconnect-input");
  };

  const disconnectOutputSocket = (socketId: SocketId): void => {
    const wiresToRemove: WireId[] = [];
    for (const wire of graphSnapshot.wires.values()) {
      if (wire.fromSocketId === socketId) {
        wiresToRemove.push(wire.id);
      }
    }
    removeWires(wiresToRemove, "disconnect-output");
  };

  const deleteSelection = (): void => {
    if (selectedNodesSnapshot.size === 0 && selectedWiresSnapshot.size === 0) {
      return;
    }
    const nodeCommands = Array.from(selectedNodesSnapshot)
      .map((nodeId) => createRemoveNodeCommand(graphSnapshot, nodeId))
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
    const wireCommands = Array.from(selectedWiresSnapshot)
      .filter((wireId) => !removedWireIds.has(wireId))
      .map((wireId) => createRemoveWireCommand(graphSnapshot, wireId))
      .filter((command): command is NonNullable<typeof command> => !!command);
    const commands = [...nodeCommands, ...wireCommands];
    if (applyCommands("delete-selection", commands)) {
      clearSelection();
    }
  };

  const getScreenPoint = (
    event: Pick<MouseEvent, "clientX" | "clientY">,
  ): Point => {
    const canvas = app?.canvas;
    if (!canvas) {
      return { x: event.clientX, y: event.clientY };
    }
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const updatePointerPosition = (
    worldPoint: Point,
    event: Pick<MouseEvent, "clientX" | "clientY">,
  ): void => {
    setPointerPosition({
      screen: { x: event.clientX, y: event.clientY },
      world: worldPoint,
    });
  };

  const updateMarquee = (
    graphics: Graphics,
    origin: Point,
    current: Point,
  ): void => {
    graphics.clear();
    const minX = Math.min(origin.x, current.x);
    const minY = Math.min(origin.y, current.y);
    const maxX = Math.max(origin.x, current.x);
    const maxY = Math.max(origin.y, current.y);
    const zoom = scene?.getZoom() ?? 1;
    const strokeWidth = 1 / Math.max(zoom, 0.1);
    graphics.rect(minX, minY, maxX - minX, maxY - minY);
    graphics.stroke({
      width: strokeWidth,
      color: canvasPalette.marquee,
      alpha: 1,
    });
    graphics.fill({ color: canvasPalette.marquee, alpha: 0.1 });
  };

  const getSocketConnectionCount = (socket: GraphSocket): number => {
    let count = 0;
    for (const wire of graphSnapshot.wires.values()) {
      if (socket.direction === "input") {
        if (wire.toSocketId === socket.id) {
          count += 1;
        }
      } else if (wire.fromSocketId === socket.id) {
        count += 1;
      }
    }
    return count;
  };

  const getSocketMaxConnections = (socket: GraphSocket): number | null => {
    if (socket.maxConnections !== undefined) {
      return socket.maxConnections;
    }
    return socket.direction === "input" ? 1 : null;
  };

  const formatValue = (value: JsonValue | null): string => {
    if (value === null) {
      return "null";
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (typeof value === "string") {
      return `"${value}"`;
    }
    return JSON.stringify(value);
  };

  const getCachedOutputValue = (
    socket: GraphSocket,
  ): JsonValue | null | undefined => {
    const outputs = dirtyStateSnapshot.outputCache.get(socket.nodeId);
    if (
      !outputs ||
      !Object.prototype.hasOwnProperty.call(outputs, socket.name)
    ) {
      return undefined;
    }
    return outputs[socket.name] ?? null;
  };

  const findInputWire = (socketId: SocketId): WireId | null => {
    for (const wire of graphSnapshot.wires.values()) {
      if (wire.toSocketId === socketId) {
        return wire.id;
      }
    }
    return null;
  };

  const buildSocketTooltip = (
    socketId: SocketId,
    screenPoint: Point,
  ): SocketTooltip | null => {
    const socket = graphSnapshot.sockets.get(socketId);
    if (!socket) {
      return null;
    }
    const title = `${socket.direction === "input" ? "Input" : "Output"}: ${
      socket.name
    }`;
    const typeLabel = `Type: ${socket.dataType}`;
    let valueLabel = "Value: No cached value";

    if (socket.direction === "output") {
      const cached = getCachedOutputValue(socket);
      if (cached !== undefined) {
        valueLabel = `Value: ${formatValue(cached)}`;
      }
    } else {
      const inputWireId = findInputWire(socket.id);
      if (!inputWireId) {
        valueLabel = "Value: Unconnected";
      } else {
        const wire = graphSnapshot.wires.get(inputWireId);
        const fromSocket = wire
          ? graphSnapshot.sockets.get(wire.fromSocketId)
          : null;
        if (fromSocket) {
          const cached = getCachedOutputValue(fromSocket);
          if (cached !== undefined) {
            valueLabel = `Value: ${formatValue(cached)}`;
          }
        }
      }
    }

    return {
      x: screenPoint.x + 12,
      y: screenPoint.y + 12,
      title,
      typeLabel,
      valueLabel,
    };
  };

  const wouldCreateCycle = (fromNodeId: NodeId, toNodeId: NodeId): boolean => {
    if (fromNodeId === toNodeId) {
      return true;
    }
    const stack: NodeId[] = [toNodeId];
    const visited = new Set<NodeId>();
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
      const neighbors = graphSnapshot.outgoing.get(current);
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

  const getWireHoverStatus = (
    fromSocketId: SocketId,
    hit: ReturnType<CanvasScene["hitTest"]>,
  ): {
    status: WireHoverStatus;
    targetPosition: Point | null;
    targetSocketId: SocketId | null;
  } => {
    if (hit.kind !== "socket") {
      return { status: "neutral", targetPosition: null, targetSocketId: null };
    }
    const fromSocket = graphSnapshot.sockets.get(fromSocketId);
    const toSocket = graphSnapshot.sockets.get(hit.socketId);
    if (!fromSocket || !toSocket) {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: null,
      };
    }
    if (fromSocket.direction !== "output" || toSocket.direction !== "input") {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: toSocket.id,
      };
    }
    if (fromSocket.nodeId === toSocket.nodeId) {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: toSocket.id,
      };
    }
    if (!isSocketTypeCompatible(fromSocket.dataType, toSocket.dataType)) {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: toSocket.id,
      };
    }
    const fromMax = getSocketMaxConnections(fromSocket);
    if (fromMax !== null && getSocketConnectionCount(fromSocket) >= fromMax) {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: toSocket.id,
      };
    }
    const toMax = getSocketMaxConnections(toSocket);
    if (toMax !== null && getSocketConnectionCount(toSocket) >= toMax) {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: toSocket.id,
      };
    }
    if (wouldCreateCycle(fromSocket.nodeId, toSocket.nodeId)) {
      return {
        status: "invalid",
        targetPosition: hit.position,
        targetSocketId: toSocket.id,
      };
    }
    return {
      status: "valid",
      targetPosition: hit.position,
      targetSocketId: toSocket.id,
    };
  };

  const getWireColor = (status: WireHoverStatus): number => {
    switch (status) {
      case "valid":
        return canvasPalette.wireHoverValid;
      case "invalid":
        return canvasPalette.wireHoverInvalid;
      default:
        return canvasPalette.wireHoverNeutral;
    }
  };

  const getNodeSizeForDefinition = (
    definition: NodeDefinition,
    nodeType: string,
  ): { width: number; height: number } => {
    const tempNodeId = makeNodeId("__measure__");
    const params: JsonObject = {};
    const inputs = definition.inputs.map((input) =>
      makeSocketId(`${tempNodeId}.${input.key}`),
    );
    const outputs = definition.outputs.map((output) =>
      makeSocketId(`${tempNodeId}.${output.key}`),
    );
    return getNodeSize(
      {
        id: tempNodeId,
        type: nodeType,
        position: { x: 0, y: 0 },
        params,
        inputs,
        outputs,
      },
      layout,
    );
  };

  const getWireMidpoint = (wireId: WireId): Point | null => {
    const wire = graphSnapshot.wires.get(wireId);
    if (!wire) {
      return null;
    }
    const from = getSocketPosition(graphSnapshot, wire.fromSocketId, layout);
    const to = getSocketPosition(graphSnapshot, wire.toSocketId, layout);
    if (!from || !to) {
      return null;
    }
    return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  };

  const getWireInsertCandidates = (wireId: WireId): WireInsertCandidate[] => {
    const wire = graphSnapshot.wires.get(wireId);
    if (!wire) {
      return [];
    }
    const fromSocket = graphSnapshot.sockets.get(wire.fromSocketId);
    const toSocket = graphSnapshot.sockets.get(wire.toSocketId);
    if (!fromSocket || !toSocket) {
      return [];
    }
    if (fromSocket.direction !== "output" || toSocket.direction !== "input") {
      return [];
    }
    const candidateTypes = WIRE_INSERT_NODE_TYPES[fromSocket.dataType] ?? [];
    return candidateTypes.flatMap((nodeType) => {
      const definition = resolveNodeDefinition(nodeType);
      if (!definition) {
        return [];
      }
      const input = definition.inputs.find((candidate) =>
        isSocketTypeCompatible(fromSocket.dataType, candidate.dataType),
      );
      const output = definition.outputs.find((candidate) =>
        isSocketTypeCompatible(candidate.dataType, toSocket.dataType),
      );
      if (!input || !output) {
        return [];
      }
      return [
        {
          nodeType,
          label: definition.label,
          inputKey: input.key,
          outputKey: output.key,
        },
      ];
    });
  };

  const insertNodeOnWire = (
    wireId: WireId,
    candidate: WireInsertCandidate,
  ): void => {
    const wire = graphSnapshot.wires.get(wireId);
    if (!wire) {
      return;
    }
    const fromSocket = graphSnapshot.sockets.get(wire.fromSocketId);
    const toSocket = graphSnapshot.sockets.get(wire.toSocketId);
    if (!fromSocket || !toSocket) {
      return;
    }
    const definition = resolveNodeDefinition(candidate.nodeType);
    if (!definition) {
      return;
    }
    const midpoint = getWireMidpoint(wireId) ?? canvasCenter();
    const size = getNodeSizeForDefinition(definition, candidate.nodeType);
    const position = {
      x: midpoint.x - size.width / 2,
      y: midpoint.y - size.height / 2,
    };
    const removeCommand = createRemoveWireCommand(graphSnapshot, wireId);
    if (!removeCommand) {
      return;
    }
    beginHistoryBatch("insert-node-on-wire");
    const nodeId = addNodeAt(candidate.nodeType, position);
    if (!nodeId) {
      commitHistoryBatch();
      return;
    }
    const removed = applyGraphCommand(removeCommand);
    if (!removed) {
      const rollback = createRemoveNodeCommand(graph(), nodeId);
      if (rollback) {
        applyGraphCommand(rollback);
      }
      commitHistoryBatch();
      return;
    }
    const inputSocketId = makeSocketId(`${nodeId}.${candidate.inputKey}`);
    const outputSocketId = makeSocketId(`${nodeId}.${candidate.outputKey}`);
    const commands: GraphCommand[] = [
      {
        kind: "add-wire",
        wire: {
          id: nextWireId(),
          fromSocketId: wire.fromSocketId,
          toSocketId: inputSocketId,
        },
      },
      {
        kind: "add-wire",
        wire: {
          id: nextWireId(),
          fromSocketId: outputSocketId,
          toSocketId: wire.toSocketId,
        },
      },
    ];
    let inserted = true;
    for (const command of commands) {
      if (!applyGraphCommand(command)) {
        inserted = false;
      }
    }
    commitHistoryBatch();
    if (inserted) {
      setWireSelection(new Set<WireId>());
    }
  };

  const insertDefaultNodeOnWire = (wireId: WireId): void => {
    const candidates = getWireInsertCandidates(wireId);
    const defaultCandidate = candidates[0];
    if (defaultCandidate) {
      insertNodeOnWire(wireId, defaultCandidate);
    }
  };

  const updateGhostWire = (
    graphics: Graphics,
    from: Point,
    to: Point,
    status: WireHoverStatus,
  ): void => {
    graphics.clear();
    const { cp1, cp2 } = getWireControlPoints(from, to);
    graphics.moveTo(from.x, from.y);
    graphics.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, to.x, to.y);
    graphics.stroke({ width: 2, color: getWireColor(status), alpha: 0.7 });
  };

  const updateSocketHover = (
    graphics: Graphics,
    position: Point | null,
    status: WireHoverStatus,
  ): void => {
    graphics.clear();
    if (!position) {
      graphics.visible = false;
      return;
    }
    graphics.visible = true;
    const color = getWireColor(status);
    graphics.circle(position.x, position.y, 12);
    graphics.stroke({ width: 2, color, alpha: 0.9 });
    graphics.fill({ color, alpha: 0.2 });
  };

  const frameNodes = (nodeIds?: Iterable<NodeId>): void => {
    if (!scene) {
      return;
    }
    const framed = scene.frameNodes(nodeIds, { padding: 120 });
    if (framed) {
      setCanvasCenter(scene.getCameraCenter());
      syncScene();
    }
  };

  const panCanvasBy = (delta: Point): void => {
    if (!scene) {
      return;
    }
    scene.panCameraBy(delta);
    setCanvasCenter(scene.getCameraCenter());
    syncScene();
  };

  const zoomCanvasBy = (factor: number): void => {
    if (!scene || !container) {
      return;
    }
    const center = {
      x: container.clientWidth / 2,
      y: container.clientHeight / 2,
    };
    scene.zoomAt(center, scene.getZoom() * factor);
    setCanvasCenter(scene.getCameraCenter());
    syncScene();
  };

  const getConnectedStartNodes = (menu: ContextMenuState): NodeId[] => {
    if (selectedNodesSnapshot.size > 0) {
      return Array.from(selectedNodesSnapshot);
    }
    if (menu.hit.kind === "node") {
      return [menu.hit.nodeId];
    }
    if (menu.hit.kind === "wire") {
      const wire = graphSnapshot.wires.get(menu.hit.wireId);
      if (!wire) {
        return [];
      }
      const fromSocket = graphSnapshot.sockets.get(wire.fromSocketId);
      const toSocket = graphSnapshot.sockets.get(wire.toSocketId);
      const nodes: NodeId[] = [];
      if (fromSocket) {
        nodes.push(fromSocket.nodeId);
      }
      if (toSocket && toSocket.nodeId !== fromSocket?.nodeId) {
        nodes.push(toSocket.nodeId);
      }
      return nodes;
    }
    return [];
  };

  const getClosureNodes = (effect: ReturnType<typeof upstreamClosure>) => {
    const result = runAppEffectSyncEither(effect);
    if (Either.isLeft(result)) {
      console.warn("Selection closure failed", result.left);
      return null;
    }
    return result.right;
  };

  const selectConnectedNodes = (
    menu: ContextMenuState,
    mode: "upstream" | "downstream" | "all",
  ): void => {
    const startNodes = getConnectedStartNodes(menu);
    if (startNodes.length === 0) {
      return;
    }
    if (mode === "upstream") {
      const upstream = getClosureNodes(
        upstreamClosure(graphSnapshot, startNodes),
      );
      if (upstream) {
        setNodeSelection(new Set(upstream));
      }
      return;
    }
    if (mode === "downstream") {
      const downstream = getClosureNodes(
        downstreamClosure(graphSnapshot, startNodes),
      );
      if (downstream) {
        setNodeSelection(new Set(downstream));
      }
      return;
    }
    const upstream = getClosureNodes(
      upstreamClosure(graphSnapshot, startNodes),
    );
    const downstream = getClosureNodes(
      downstreamClosure(graphSnapshot, startNodes),
    );
    if (!upstream || !downstream) {
      return;
    }
    const combined = new Set<NodeId>([...upstream, ...downstream]);
    setNodeSelection(combined);
  };

  const pushSeparator = (entries: ContextMenuEntry[]): void => {
    const last = entries[entries.length - 1];
    if (last?.kind === "separator") {
      return;
    }
    entries.push({ kind: "separator" });
  };

  const buildContextMenuEntries = (
    menu: ContextMenuState,
  ): ContextMenuEntry[] => {
    const entries: ContextMenuEntry[] = [
      {
        kind: "item",
        label: "Add Basic Node",
        onSelect: () => {
          addNodeAt("basic", menu.world);
        },
      },
    ];
    const hasSelection =
      selectedNodesSnapshot.size > 0 || selectedWiresSnapshot.size > 0;
    if (hasSelection) {
      entries.push({
        kind: "item",
        label: "Delete Selection",
        onSelect: () => {
          deleteSelection();
        },
      });
    }
    const connectedStartNodes = getConnectedStartNodes(menu);
    if (connectedStartNodes.length > 0) {
      pushSeparator(entries);
      entries.push({
        kind: "item",
        label: "Select Upstream",
        onSelect: () => {
          selectConnectedNodes(menu, "upstream");
        },
      });
      entries.push({
        kind: "item",
        label: "Select Downstream",
        onSelect: () => {
          selectConnectedNodes(menu, "downstream");
        },
      });
      entries.push({
        kind: "item",
        label: "Select All Connected",
        onSelect: () => {
          selectConnectedNodes(menu, "all");
        },
      });
    }
    switch (menu.hit.kind) {
      case "node":
        pushSeparator(entries);
        entries.push({
          kind: "item",
          label: "Delete Node",
          onSelect: () => {
            removeNodes([menu.hit.nodeId], "delete-node");
          },
        });
        entries.push({
          kind: "item",
          label: "Toggle Bypass",
          onSelect: () => {
            toggleBypassNodes(new Set([menu.hit.nodeId]));
          },
        });
        break;
      case "wire": {
        pushSeparator(entries);
        const insertCandidates = getWireInsertCandidates(menu.hit.wireId);
        for (const candidate of insertCandidates) {
          entries.push({
            kind: "item",
            label: `Insert ${candidate.label}`,
            onSelect: () => {
              insertNodeOnWire(menu.hit.wireId, candidate);
            },
          });
        }
        if (insertCandidates.length > 0) {
          pushSeparator(entries);
        }
        entries.push({
          kind: "item",
          label: "Disconnect Wire",
          onSelect: () => {
            removeWires([menu.hit.wireId], "disconnect-wire");
          },
        });
        break;
      }
      case "socket": {
        pushSeparator(entries);
        const socket = graphSnapshot.sockets.get(menu.hit.socketId);
        if (socket?.direction === "input") {
          entries.push({
            kind: "item",
            label: "Disconnect Input",
            onSelect: () => {
              disconnectInputSocket(socket.id);
            },
          });
        } else if (socket?.direction === "output") {
          entries.push({
            kind: "item",
            label: "Disconnect Outputs",
            onSelect: () => {
              disconnectOutputSocket(socket.id);
            },
          });
        }
        break;
      }
      default:
        break;
    }
    return entries;
  };

  onMount(() => {
    if (!container) {
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | null = null;
    let mediaQuery: MediaQueryList | null = null;

    const updatePaletteForScheme = (scheme: ThemeScheme): void => {
      canvasPalette = getCanvasPalette(scheme);
      applyCanvasPalette();
      updateGrid();
      syncScene();
    };

    const setupPixi = async (): Promise<void> => {
      const module = await import("pixi.js");
      if (disposed || !container) {
        return;
      }
      const initialScheme: ThemeScheme =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
      canvasPalette = getCanvasPalette(initialScheme);
      app = new module.Application();
      await app.init({
        background: canvasPalette.background,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio,
        resizeTo: container,
      });

      if (disposed || !container) {
        app.destroy(true);
        app = null;
        return;
      }

      container.appendChild(app.canvas);
      app.canvas.style.display = "block";

      scene = new CanvasScene({ layout, theme: canvasPalette.sceneTheme });
      scene.attachTo(app.stage);
      scene.setViewportSize(
        { width: container.clientWidth, height: container.clientHeight },
        { pixelRatio: window.devicePixelRatio },
      );
      setCanvasCenter(
        scene.screenToWorld({
          x: container.clientWidth / 2,
          y: container.clientHeight / 2,
        }),
      );

      const ghostWire = new module.Graphics();
      const socketHover = new module.Graphics();
      const marquee = new module.Graphics();
      gridGraphics = new module.Graphics();
      ghostWire.visible = false;
      socketHover.visible = false;
      marquee.visible = false;
      scene.layers.grid.addChild(gridGraphics);
      scene.layers.overlays.addChild(ghostWire);
      scene.layers.overlays.addChild(socketHover);
      scene.layers.overlays.addChild(marquee);

      syncScene();

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !scene) {
          return;
        }
        const { width, height } = entry.contentRect;
        scene.setViewportSize(
          { width, height },
          { pixelRatio: window.devicePixelRatio },
        );
        setCanvasCenter(scene.screenToWorld({ x: width / 2, y: height / 2 }));
        syncScene();
      });
      resizeObserver.observe(container);

      let longPressTimer: ReturnType<typeof setTimeout> | null = null;
      let longPressStart: {
        pointerId: number;
        screen: Point;
        client: Point;
      } | null = null;

      const clearLongPress = (): void => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        longPressStart = null;
      };

      const openContextMenu = (
        screenPoint: Point,
        clientPoint: Point,
      ): void => {
        if (!scene) {
          return;
        }
        const hit = scene.hitTest(screenPoint);
        const worldPoint = scene.screenToWorld(screenPoint);
        updatePointerPosition(worldPoint, {
          clientX: clientPoint.x,
          clientY: clientPoint.y,
        });
        setSocketTooltip(null);
        setHoveredNodeId(null);
        setHoveredWireId(null);
        if (hit.kind === "node") {
          if (!selectedNodesSnapshot.has(hit.nodeId)) {
            setNodeSelection(new Set([hit.nodeId]));
            setWireSelection(new Set<WireId>());
          }
        } else if (hit.kind === "wire") {
          if (!selectedWiresSnapshot.has(hit.wireId)) {
            setWireSelection(new Set([hit.wireId]));
            setNodeSelection(new Set<NodeId>());
          }
        }
        setContextMenu({
          screen: screenPoint,
          world: worldPoint,
          hit,
        });
      };

      const startLongPress = (event: PointerEvent): void => {
        if (!scene || !app) {
          return;
        }
        if (event.pointerType !== "touch" || event.button !== 0) {
          return;
        }
        if (event.cancelable) {
          event.preventDefault();
        }
        clearLongPress();
        const screenPoint = getScreenPoint(event);
        longPressStart = {
          pointerId: event.pointerId,
          screen: screenPoint,
          client: { x: event.clientX, y: event.clientY },
        };
        longPressTimer = setTimeout(() => {
          if (!scene || !longPressStart) {
            return;
          }
          const { screen, client, pointerId } = longPressStart;
          clearLongPress();
          if (contextMenu()) {
            return;
          }
          ghostWire.clear();
          ghostWire.visible = false;
          socketHover.clear();
          socketHover.visible = false;
          marquee.clear();
          marquee.visible = false;
          dragState = { kind: "none" };
          try {
            app?.canvas.releasePointerCapture(pointerId);
          } catch {
            // ignore capture errors when pointer isn't held
          }
          openContextMenu(screen, client);
        }, LONG_PRESS_DURATION_MS);
      };

      const onPointerDown = (event: PointerEvent): void => {
        if (!scene || !app) {
          return;
        }
        startLongPress(event);
        if (event.button === 1) {
          event.preventDefault();
          setContextMenu(null);
          setSocketTooltip(null);
          dragState = {
            kind: "pan",
            lastScreen: getScreenPoint(event),
          };
          app.canvas.setPointerCapture(event.pointerId);
          return;
        }
        if (event.button !== 0) {
          return;
        }
        setContextMenu(null);
        const screenPoint = getScreenPoint(event);
        const hit = scene.hitTest(screenPoint);
        const worldPoint = scene.screenToWorld(screenPoint);
        updatePointerPosition(worldPoint, event);
        setSocketTooltip(null);

        if (hit.kind === "socket") {
          const socket = graphSnapshot.sockets.get(hit.socketId);
          if (socket?.direction === "output") {
            ghostWire.visible = true;
            updateGhostWire(ghostWire, hit.position, worldPoint, "neutral");
            dragState = {
              kind: "wire",
              fromSocketId: socket.id,
              fromPosition: hit.position,
              current: worldPoint,
            };
            app.canvas.setPointerCapture(event.pointerId);
            return;
          }
          if (socket?.direction === "input") {
            disconnectInputSocket(socket.id);
            return;
          }
        }

        if (hit.kind === "node") {
          const hitNode = graphSnapshot.nodes.get(hit.nodeId);
          if (hitNode && isHeaderToggleHit(hitNode, worldPoint)) {
            toggleCollapsedNodes(new Set([hit.nodeId]));
            setSocketTooltip(null);
            return;
          }
          const next = new Set(selectedNodesSnapshot);
          if (event.shiftKey) {
            if (next.has(hit.nodeId)) {
              next.delete(hit.nodeId);
            } else {
              next.add(hit.nodeId);
            }
          } else if (!next.has(hit.nodeId)) {
            next.clear();
            next.add(hit.nodeId);
          }
          setNodeSelection(next);
          if (!next.has(hit.nodeId)) {
            dragState = { kind: "none" };
            return;
          }
          const startPositions = new Map<NodeId, Point>();
          for (const nodeId of next) {
            const node = graphSnapshot.nodes.get(nodeId);
            if (node) {
              startPositions.set(nodeId, { ...node.position });
            }
          }
          const dragBounds = getDragBounds(startPositions);
          if (!dragBounds) {
            dragState = { kind: "none" };
            return;
          }
          dragState = {
            kind: "drag-nodes",
            origin: worldPoint,
            startPositions,
            bounds: dragBounds,
          };
          app.canvas.setPointerCapture(event.pointerId);
          return;
        }

        if (hit.kind === "wire") {
          const next = new Set<WireId>();
          next.add(hit.wireId);
          setWireSelection(next);
          return;
        }

        if (event.pointerType === "touch") {
          dragState = { kind: "pan", lastScreen: screenPoint };
          app.canvas.setPointerCapture(event.pointerId);
          return;
        }

        clearSelection();
        marquee.visible = true;
        updateMarquee(marquee, worldPoint, worldPoint);
        dragState = {
          kind: "marquee",
          origin: worldPoint,
          current: worldPoint,
          additive: event.shiftKey,
        };
        app.canvas.setPointerCapture(event.pointerId);
      };

      const onPointerMove = (event: PointerEvent): void => {
        if (!scene) {
          return;
        }
        if (contextMenu()) {
          return;
        }
        if (longPressStart && event.pointerId === longPressStart.pointerId) {
          const screenPoint = getScreenPoint(event);
          const dx = screenPoint.x - longPressStart.screen.x;
          const dy = screenPoint.y - longPressStart.screen.y;
          if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD) {
            clearLongPress();
          }
        }
        const screenPoint = getScreenPoint(event);
        const worldPoint = scene.screenToWorld(screenPoint);
        updatePointerPosition(worldPoint, event);

        if (dragState.kind === "drag-nodes") {
          setSocketTooltip(null);
          setHoveredNodeId(null);
          setHoveredWireId(null);
          const delta = getDragDelta(
            dragState.origin,
            worldPoint,
            dragState.bounds,
          );
          const beforeUpdates = Array.from(
            dragState.startPositions.entries(),
          ).map(([nodeId, start]) => {
            const current = graphSnapshot.nodes.get(nodeId)?.position ?? start;
            return {
              nodeId,
              position: { x: current.x, y: current.y },
            };
          });
          const afterUpdates = Array.from(
            dragState.startPositions.entries(),
          ).map(([nodeId, start]) => ({
            nodeId,
            position: { x: start.x + delta.x, y: start.y + delta.y },
          }));
          applyGraphCommandTransient(
            createMoveNodesCommand(beforeUpdates, afterUpdates),
          );
          return;
        }

        if (dragState.kind === "marquee") {
          setSocketTooltip(null);
          setHoveredNodeId(null);
          setHoveredWireId(null);
          dragState = { ...dragState, current: worldPoint };
          updateMarquee(marquee, dragState.origin, worldPoint);
          return;
        }

        if (dragState.kind === "wire") {
          const hit = scene.hitTest(screenPoint);
          const hover = getWireHoverStatus(dragState.fromSocketId, hit);
          const targetPosition = hover.targetPosition ?? worldPoint;
          dragState = { ...dragState, current: targetPosition };
          updateGhostWire(
            ghostWire,
            dragState.fromPosition,
            targetPosition,
            hover.status,
          );
          updateSocketHover(socketHover, hover.targetPosition, hover.status);
          setSocketTooltip(null);
          setHoveredNodeId(null);
          setHoveredWireId(null);
          return;
        }

        if (dragState.kind === "pan") {
          setSocketTooltip(null);
          setHoveredNodeId(null);
          setHoveredWireId(null);
          const nextScreen = getScreenPoint(event);
          const prevWorld = scene.screenToWorld(dragState.lastScreen);
          const nextWorld = scene.screenToWorld(nextScreen);
          const delta = {
            x: (prevWorld.x - nextWorld.x) * settingsSnapshot.panSensitivity,
            y: (prevWorld.y - nextWorld.y) * settingsSnapshot.panSensitivity,
          };
          scene.panCameraBy(delta);
          setCanvasCenter(scene.getCameraCenter());
          syncScene();
          dragState = { kind: "pan", lastScreen: nextScreen };
          return;
        }

        if (dragState.kind === "none") {
          const hit = scene.hitTest(screenPoint);
          if (hit.kind === "socket") {
            setSocketTooltip(buildSocketTooltip(hit.socketId, screenPoint));
            setHoveredNodeId(hit.nodeId);
            setHoveredWireId(null);
          } else if (hit.kind === "node") {
            setSocketTooltip(null);
            setHoveredNodeId(hit.nodeId);
            setHoveredWireId(null);
          } else if (hit.kind === "wire") {
            setSocketTooltip(null);
            setHoveredNodeId(null);
            setHoveredWireId(hit.wireId);
          } else {
            setSocketTooltip(null);
            setHoveredNodeId(null);
            setHoveredWireId(null);
          }
        }
      };

      const selectNodesInMarquee = (
        origin: Point,
        current: Point,
        additive: boolean,
      ): void => {
        const minX = Math.min(origin.x, current.x);
        const minY = Math.min(origin.y, current.y);
        const maxX = Math.max(origin.x, current.x);
        const maxY = Math.max(origin.y, current.y);
        const next = additive
          ? new Set(selectedNodesSnapshot)
          : new Set<NodeId>();
        for (const node of graphSnapshot.nodes.values()) {
          const { width, height } = getNodeSize(node, layout);
          const nodeMinX = node.position.x;
          const nodeMinY = node.position.y;
          const nodeMaxX = node.position.x + width;
          const nodeMaxY = node.position.y + height;
          const intersects =
            nodeMaxX >= minX &&
            nodeMinX <= maxX &&
            nodeMaxY >= minY &&
            nodeMinY <= maxY;
          if (intersects) {
            next.add(node.id);
          }
        }
        setNodeSelection(next);
      };

      const onPointerUp = (event: PointerEvent): void => {
        if (!scene || !app) {
          return;
        }
        clearLongPress();
        const screenPoint = getScreenPoint(event);
        const worldPoint = scene.screenToWorld(screenPoint);
        if (dragState.kind === "marquee") {
          marquee.clear();
          marquee.visible = false;
          selectNodesInMarquee(
            dragState.origin,
            dragState.current,
            dragState.additive,
          );
          dragState = { kind: "none" };
          return;
        }

        if (dragState.kind === "wire") {
          ghostWire.clear();
          ghostWire.visible = false;
          socketHover.clear();
          socketHover.visible = false;
          const hit = scene.hitTest(screenPoint);
          const hover = getWireHoverStatus(dragState.fromSocketId, hit);
          if (hover.status === "valid" && hover.targetSocketId) {
            const wireId = nextWireId();
            const connected = applyGraphCommand({
              kind: "add-wire",
              wire: {
                id: wireId,
                fromSocketId: dragState.fromSocketId,
                toSocketId: hover.targetSocketId,
              },
            });
            if (connected) {
              setWireSelection(new Set([wireId]));
            }
          }
          dragState = { kind: "none" };
          return;
        }

        if (dragState.kind === "drag-nodes") {
          const delta = getDragDelta(
            dragState.origin,
            worldPoint,
            dragState.bounds,
          );
          const beforeUpdates = Array.from(
            dragState.startPositions.entries(),
          ).map(([nodeId, start]) => ({
            nodeId,
            position: { x: start.x, y: start.y },
          }));
          const afterUpdates = Array.from(
            dragState.startPositions.entries(),
          ).map(([nodeId, start]) => ({
            nodeId,
            position: { x: start.x + delta.x, y: start.y + delta.y },
          }));
          const command = createMoveNodesCommand(beforeUpdates, afterUpdates);
          if (!isNoopCommand(command)) {
            recordGraphCommand(command);
          }
          dragState = { kind: "none" };
          setSocketTooltip(null);
          return;
        }

        if (dragState.kind === "pan") {
          dragState = { kind: "none" };
          return;
        }

        if (dragState.kind === "none") {
          return;
        }
      };

      const onDoubleClick = (event: MouseEvent): void => {
        if (!scene) {
          return;
        }
        const rect = app?.canvas.getBoundingClientRect();
        if (!rect) {
          return;
        }
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const hit = scene.hitTest(screenPoint);
        if (hit.kind === "wire") {
          insertDefaultNodeOnWire(hit.wireId);
          return;
        }
        const worldPoint = scene.screenToWorld(screenPoint);
        addNodeAt("basic", worldPoint);
      };

      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.defaultPrevented) {
          return;
        }
        if (commandPaletteOpenSnapshot) {
          if (event.key === "Escape") {
            event.preventDefault();
            setCommandPaletteOpen(false);
          }
          return;
        }
        const target = event.target;
        const isEditableTarget =
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT");
        if (event.key === "Escape") {
          clearSelection();
          ghostWire.clear();
          ghostWire.visible = false;
          socketHover.clear();
          socketHover.visible = false;
          marquee.clear();
          marquee.visible = false;
          setSocketTooltip(null);
          setContextMenu(null);
          dragState = { kind: "none" };
          return;
        }

        if (isEditableTarget) {
          return;
        }

        const isCommandPalette =
          event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
        if (isCommandPalette) {
          event.preventDefault();
          setCommandPaletteOpen(true);
          return;
        }

        const isUndo =
          event.key.toLowerCase() === "z" &&
          (event.metaKey || event.ctrlKey) &&
          !event.shiftKey;
        const isRedo =
          (event.key.toLowerCase() === "z" &&
            (event.metaKey || event.ctrlKey) &&
            event.shiftKey) ||
          (event.key.toLowerCase() === "y" && (event.metaKey || event.ctrlKey));

        if (isUndo) {
          event.preventDefault();
          undo();
          return;
        }

        if (isRedo) {
          event.preventDefault();
          redo();
          return;
        }

        if (event.key.toLowerCase() === "b") {
          if (selectedNodesSnapshot.size > 0) {
            event.preventDefault();
            toggleBypassNodes(selectedNodesSnapshot);
          }
          return;
        }

        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          deleteSelection();
          return;
        }

        if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          if (event.shiftKey || selectedNodesSnapshot.size === 0) {
            frameNodes();
          } else {
            frameNodes(selectedNodesSnapshot);
          }
          return;
        }

        const isArrowKey =
          event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight";
        if (isArrowKey) {
          event.preventDefault();
          const baseStep = event.shiftKey ? 240 : 120;
          const zoom = scene?.getZoom() ?? 1;
          const step = baseStep / Math.max(zoom, 0.1);
          const delta =
            event.key === "ArrowUp"
              ? { x: 0, y: -step }
              : event.key === "ArrowDown"
                ? { x: 0, y: step }
                : event.key === "ArrowLeft"
                  ? { x: -step, y: 0 }
                  : { x: step, y: 0 };
          panCanvasBy(delta);
          return;
        }

        if (event.key === "[" || event.key === "]") {
          event.preventDefault();
          const factor = event.key === "]" ? 1.12 : 1 / 1.12;
          zoomCanvasBy(factor);
          return;
        }

        const isCopy =
          event.key.toLowerCase() === "c" && (event.metaKey || event.ctrlKey);
        const isDuplicate =
          event.key.toLowerCase() === "d" &&
          (event.metaKey || event.ctrlKey) &&
          !event.shiftKey;
        const isPaste =
          event.key.toLowerCase() === "v" && (event.metaKey || event.ctrlKey);

        if (isCopy) {
          event.preventDefault();
          const payload = buildClipboardPayload();
          if (payload) {
            void writeClipboardPayload(payload);
          }
          return;
        }

        if (isDuplicate) {
          event.preventDefault();
          duplicateSelection();
          return;
        }

        if (isPaste) {
          event.preventDefault();
          void pasteClipboardPayload();
        }
      };

      const onContextMenu = (event: MouseEvent): void => {
        if (!scene) {
          return;
        }
        event.preventDefault();
        clearLongPress();
        const screenPoint = getScreenPoint(event);
        openContextMenu(screenPoint, { x: event.clientX, y: event.clientY });
      };

      const onPointerLeave = (): void => {
        ghostWire.clear();
        ghostWire.visible = false;
        socketHover.clear();
        socketHover.visible = false;
        marquee.clear();
        marquee.visible = false;
        setSocketTooltip(null);
        setHoveredNodeId(null);
        setHoveredWireId(null);
        setPointerPosition(null);
        setContextMenu(null);
        clearLongPress();
        dragState = { kind: "none" };
      };

      const onWheel = (event: WheelEvent): void => {
        if (!scene) {
          return;
        }
        event.preventDefault();
        const screenPoint = getScreenPoint(event);
        const zoom = scene.getZoom();
        const strength = settingsSnapshot.zoomSensitivity;
        const delta = -event.deltaY * 0.001 * strength;
        const nextZoom = zoom * Math.exp(delta);
        scene.zoomAt(screenPoint, nextZoom);
        setCanvasCenter(scene.getCameraCenter());
        syncScene();
      };

      app.canvas.addEventListener("pointerdown", onPointerDown);
      app.canvas.addEventListener("pointermove", onPointerMove);
      app.canvas.addEventListener("pointerup", onPointerUp);
      app.canvas.addEventListener("pointerleave", onPointerLeave);
      app.canvas.addEventListener("dblclick", onDoubleClick);
      app.canvas.addEventListener("contextmenu", onContextMenu);
      app.canvas.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("keydown", onKeyDown);
      const onSchemeChange = (event: MediaQueryListEvent): void => {
        updatePaletteForScheme(event.matches ? "light" : "dark");
      };
      if (typeof window !== "undefined") {
        mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
        mediaQuery.addEventListener("change", onSchemeChange);
      }

      cleanup = () => {
        app?.canvas.removeEventListener("pointerdown", onPointerDown);
        app?.canvas.removeEventListener("pointermove", onPointerMove);
        app?.canvas.removeEventListener("pointerup", onPointerUp);
        app?.canvas.removeEventListener("pointerleave", onPointerLeave);
        app?.canvas.removeEventListener("dblclick", onDoubleClick);
        app?.canvas.removeEventListener("contextmenu", onContextMenu);
        app?.canvas.removeEventListener("wheel", onWheel);
        window.removeEventListener("keydown", onKeyDown);
        mediaQuery?.removeEventListener("change", onSchemeChange);
        resizeObserver.disconnect();
        app?.destroy(true);
        app = null;
        scene = null;
      };
    };

    void setupPixi();

    onCleanup(() => {
      disposed = true;
      cleanup?.();
    });
  });

  createEffect(() => {
    graphSnapshot = graph();
    dirtyStateSnapshot = dirtyState();
    selectedNodesSnapshot = selectedNodes();
    selectedWiresSnapshot = selectedWires();
    bypassedNodesSnapshot = bypassedNodes();
    collapsedNodesSnapshot = collapsedNodes();
    settingsSnapshot = settings();
    commandPaletteOpenSnapshot = commandPaletteOpen();
    hoveredNodeIdSnapshot = hoveredNodeId();
    hoveredWireIdSnapshot = hoveredWireId();
    syncScene();
  });

  createEffect(() => {
    const center = canvasCenter();
    if (!scene) {
      return;
    }
    if (
      !lastAppliedCenter ||
      center.x !== lastAppliedCenter.x ||
      center.y !== lastAppliedCenter.y
    ) {
      lastAppliedCenter = center;
      scene.setCameraCenter(center);
      syncScene();
    }
  });

  createEffect(() => {
    paramPanelSizes();
    if (!scene) {
      return;
    }
    scene.setLayout(layout);
    syncScene();
  });

  return (
    <div
      class="relative h-full w-full"
      ref={container}
      onDragOver={(event) => {
        if (
          event.dataTransfer &&
          event.dataTransfer.types.includes(NODE_DRAG_TYPE)
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        const nodeType = event.dataTransfer?.getData(NODE_DRAG_TYPE);
        if (!nodeType || !scene || !container) {
          return;
        }
        event.preventDefault();
        const rect = container.getBoundingClientRect();
        const screenPoint = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const worldPoint = scene.screenToWorld(screenPoint);
        addNodeAt(nodeType, worldPoint);
      }}
    >
      <NodeParamMeasure
        entries={NODE_CATALOG}
        contentWidth={contentWidth}
        onSizeChange={(nodeType, size) => {
          setParamPanelSizes((current) => {
            const existing = current.get(nodeType);
            if (
              existing &&
              existing.width === size.width &&
              existing.height === size.height
            ) {
              return current;
            }
            const next = new Map(current);
            next.set(nodeType, size);
            return next;
          });
        }}
      />
      {socketTooltip() ? (
        <div
          class="pointer-events-none absolute z-10 max-w-[240px] rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-panel-soft)] px-[0.6rem] py-[0.45rem] text-[0.72rem] leading-[1.35] text-[color:var(--text-soft)] shadow-[var(--shadow-toast)]"
          style={{
            left: `${socketTooltip()!.x}px`,
            top: `${socketTooltip()!.y}px`,
          }}
        >
          <div class="text-[0.75rem] font-semibold">
            {socketTooltip()!.title}
          </div>
          <div class="mt-[0.15rem] text-[color:var(--text-muted)]">
            {socketTooltip()!.typeLabel}
          </div>
          <div class="mt-[0.2rem] text-[color:var(--text-strong)]">
            {socketTooltip()!.valueLabel}
          </div>
        </div>
      ) : null}
      {contextMenu() ? (
        <div
          class="absolute z-20 min-w-[200px] rounded-xl border border-[color:var(--border-muted)] bg-[color:var(--surface-panel-strong)] p-2 text-[0.8rem] text-[color:var(--text-soft)] shadow-[var(--shadow-panel)]"
          style={{
            left: `clamp(12px, ${contextMenu()!.screen.x}px, calc(100% - 220px))`,
            top: `clamp(12px, ${contextMenu()!.screen.y}px, calc(100% - 220px))`,
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          {buildContextMenuEntries(contextMenu()!).map((entry) =>
            entry.kind === "separator" ? (
              <div class="my-1 h-px bg-[color:var(--border-subtle)]" />
            ) : (
              <button
                class="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-[color:var(--surface-highlight)]"
                onClick={() => {
                  entry.onSelect();
                  setContextMenu(null);
                }}
              >
                <span>{entry.label}</span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
