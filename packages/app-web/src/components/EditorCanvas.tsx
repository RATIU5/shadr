import type {
  FrameId,
  GraphFrame,
  GraphNode,
  GraphSocket,
  GraphWire,
  NodeId,
  SocketId,
  WireId,
} from "@shadr/graph-core";
import { downstreamClosure, upstreamClosure } from "@shadr/graph-core";
import type { NodeDefinition } from "@shadr/plugin-system";
import type {
  GraphSocketLabelPosition,
  GraphSocketNumberFormat,
  JsonObject,
  JsonValue,
} from "@shadr/shared";
import {
  getSocketTypeMetadata,
  isSocketTypeCompatible,
  makeFrameId,
  makeNodeId,
  makeSocketId,
  makeWireId,
  SUBGRAPH_NODE_TYPE,
} from "@shadr/shared";
import {
  type CanvasExecutionNodeState,
  type CanvasExecutionState,
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
import { RotateCcw, X } from "lucide-solid";
import type { Application, Graphics } from "pixi.js";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";

import NodeParamMeasure, {
  type NodeParamSize,
} from "~/components/NodeParamMeasure";
import { CONVERSION_REGISTRY } from "~/editor/conversion-registry";
import {
  buildDeleteSelectionCommands,
  type DeleteSelectionMode,
} from "~/editor/delete-selection";
import {
  buildFrameHierarchy,
  collectFrameDescendants,
  getNodeFrameOwners,
} from "~/editor/frame-utils";
import {
  createMoveFramesCommand,
  createMoveNodesCommand,
  createRemoveFrameCommand,
  createRemoveNodeCommand,
  createRemoveWireCommand,
  createUpdateFrameCommand,
  createUpdateNodeIoCommand,
  type GraphCommand,
  isNoopCommand,
} from "~/editor/history";
import { publishKeybindingEvent } from "~/editor/keybinding-events";
import {
  eventToKeybindingChord,
  getActiveKeybindingProfile,
  isKeybindingSequencePrefix,
  type KeybindingActionId,
  type KeybindingChord,
  resolveKeybindingSequence,
  serializeKeybindingSequence,
} from "~/editor/keybindings";
import {
  getNodeCatalogEntry,
  isRerouteNodeType,
  NODE_CATALOG,
  NODE_DRAG_TYPE,
  resolveNodeDefinition,
} from "~/editor/node-catalog";
import { GRID_SIZE, snapPointToGrid } from "~/editor/settings";
import type { EditorStore } from "~/editor/store";
import type { ConnectionAttemptReason } from "~/editor/validation-warnings";
import { runAppEffectSyncEither } from "~/services/runtime";

type Point = Readonly<{ x: number; y: number }>;
/* eslint-disable no-unused-vars -- function parameter names document the test API */
type CanvasTestApi = Readonly<{
  getNodeIds: () => ReadonlyArray<NodeId>;
  getWireIds: () => ReadonlyArray<WireId>;
  getNodePosition: (nodeId: NodeId) => Point | null;
  getNodeScreenCenter: (nodeId: NodeId) => Point | null;
  getSocketsForNode: (nodeId: NodeId) => Readonly<{
    inputs: ReadonlyArray<SocketId>;
    outputs: ReadonlyArray<SocketId>;
  }> | null;
  getSocketScreenPosition: (socketId: SocketId) => Point | null;
}>;
/* eslint-enable no-unused-vars */

const QUICK_ADD_NODE_TYPE =
  NODE_CATALOG.find((entry) => entry.type === "math-add")?.type ??
  NODE_CATALOG.at(0)?.type ??
  "const-float";
const QUICK_ADD_NODE_LABEL = "Add Node";

const toMenuTestId = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
type Bounds = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;
type WireHoverStatus = "neutral" | "valid" | "invalid";
type WireHoverResult = Readonly<{
  status: WireHoverStatus;
  targetPosition: Point | null;
  targetSocketId: SocketId | null;
  reason: ConnectionAttemptReason | null;
}>;
type SocketTooltip = Readonly<{
  x: number;
  y: number;
  title: string;
  typeLabel: string;
  valueLabel: string;
  connectionLabel?: string;
}>;
type WireTooltip = Readonly<{
  x: number;
  y: number;
  title: string;
  typeLabel: string;
  valueLabel: string;
}>;
type KeyboardFocus = "node" | "socket" | "wire";
type ContextMenuState = Readonly<{
  screen: Point;
  world: Point;
  hit: ReturnType<CanvasScene["hitTest"]>;
  mode: "full" | "wire-insert";
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
type TextEditState =
  | Readonly<{
      kind: "frame-title";
      frameId: FrameId;
      screen: Point;
      defaultValue: string;
    }>
  | Readonly<{
      kind: "socket-label";
      socketId: SocketId;
      screen: Point;
      defaultValue: string;
    }>;

const applyResponseCurve = (value: number, curve: number): number => {
  if (curve === 1) {
    return value;
  }
  const magnitude = Math.abs(value);
  const adjusted = Math.pow(1 + magnitude, curve) - 1;
  return Math.sign(value) * adjusted;
};

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

type FrameResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type WireDragMode = "from-output" | "from-input";

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
      kind: "drag-frames";
      origin: Point;
      startFramePositions: Map<FrameId, Point>;
      startNodePositions: Map<NodeId, Point>;
      bounds: Bounds;
    }
  | {
      kind: "resize-frame";
      frameId: FrameId;
      handle: FrameResizeHandle;
      origin: Point;
      startFrame: GraphFrame;
    }
  | {
      kind: "marquee";
      origin: Point;
      current: Point;
      additive: boolean;
    }
  | {
      kind: "wire";
      dragMode: WireDragMode;
      anchorSocketId: SocketId;
      anchorPosition: Point;
      current: Point;
      grabbedWire: GraphWire | null;
    }
  | {
      kind: "pan";
      lastScreen: Point;
    };

type EditorCanvasProps = Readonly<{
  store: EditorStore;
  onViewportEmpty?: () => void;
  // eslint-disable-next-line no-unused-vars -- type-only param name for TS call signature
  onDiveIntoSubgraph?: (nodeId: NodeId) => void;
  onCollapseSelectionToSubgraph?: () => void;
}>;

type ClipboardPayloadV1 = Readonly<{
  kind: "shadr-clipboard";
  version: 1;
  nodes: ReadonlyArray<GraphNode>;
  sockets: ReadonlyArray<GraphSocket>;
  wires: ReadonlyArray<GraphWire>;
}>;

type ClipboardPayloadV2 = Readonly<{
  kind: "shadr-clipboard";
  version: 2;
  nodes: ReadonlyArray<GraphNode>;
  sockets: ReadonlyArray<GraphSocket>;
  wires: ReadonlyArray<GraphWire>;
  frames: ReadonlyArray<GraphFrame>;
}>;

type ClipboardPayload = ClipboardPayloadV2;

type WireInsertCandidate = Readonly<{
  nodeType: string;
  label: string;
  inputKey: string;
  outputKey: string;
}>;

// eslint-disable-next-line no-unused-vars -- type-only param name required by TS function syntax
type IdFactory<T> = (value: string) => T;

const CLIPBOARD_KIND = "shadr-clipboard";
const CLIPBOARD_VERSION = 2 as const;
let clipboardFallback: ClipboardPayload | null = null;
const DUPLICATE_OFFSET: Point = { x: 32, y: 32 };
const LONG_PRESS_DURATION_MS = 450;
const WIRE_TOOLTIP_DELAY_MS = 180;
const LONG_PRESS_MOVE_THRESHOLD = 8;
const WIRE_SNAP_DISTANCE_PX = 28;
const WIRE_AUTO_SCROLL_MARGIN_PX = 36;
const WIRE_AUTO_SCROLL_SPEED_PX = 18;
const DEFAULT_FRAME_SIZE = { width: 320, height: 220 };
const FRAME_MIN_SIZE = { width: 180, height: 120 };
const FRAME_RESIZE_HIT_SIZE = 10;
const FRAME_RESIZE_CORNER_HIT_SIZE = 18;
const FRAME_TITLE_BAR_HEIGHT = 22;
const GROUP_FRAME_PADDING = { x: 40, y: 48 };

const buildWireInsertNodeTypes = (
  base: Record<string, ReadonlyArray<string>>,
): Record<string, ReadonlyArray<string>> => {
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(base)) {
    result[key] = [...value];
  }
  for (const entry of CONVERSION_REGISTRY.entries) {
    const list = result[entry.fromType] ?? [];
    if (!list.includes(entry.nodeType)) {
      result[entry.fromType] = [...list, entry.nodeType];
    }
  }
  return result;
};

const BASE_WIRE_INSERT_NODE_TYPES: Record<string, ReadonlyArray<string>> = {
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
const WIRE_INSERT_NODE_TYPES = buildWireInsertNodeTypes(
  BASE_WIRE_INSERT_NODE_TYPES,
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isGraphSocketLabelPosition = (
  value: unknown,
): value is GraphSocketLabelPosition =>
  value === "auto" ||
  value === "left" ||
  value === "right" ||
  value === "top" ||
  value === "bottom";

const isGraphSocketNumberFormat = (
  value: unknown,
): value is GraphSocketNumberFormat =>
  value === "auto" ||
  value === "integer" ||
  value === "fixed-2" ||
  value === "fixed-3" ||
  value === "percent";

const isGraphSocketLabelSettings = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.visible !== undefined && typeof value.visible !== "boolean") {
    return false;
  }
  if (
    value.position !== undefined &&
    !isGraphSocketLabelPosition(value.position)
  ) {
    return false;
  }
  if (value.offset !== undefined) {
    if (!isRecord(value.offset)) {
      return false;
    }
    if (
      typeof value.offset.x !== "number" ||
      typeof value.offset.y !== "number"
    ) {
      return false;
    }
  }
  return true;
};

const isGraphSocketMetadata = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.units !== undefined && typeof value.units !== "string") {
    return false;
  }
  if (value.min !== undefined && typeof value.min !== "number") {
    return false;
  }
  if (value.max !== undefined && typeof value.max !== "number") {
    return false;
  }
  if (value.step !== undefined && typeof value.step !== "number") {
    return false;
  }
  if (value.format !== undefined && !isGraphSocketNumberFormat(value.format)) {
    return false;
  }
  return true;
};

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
  if (value.label !== undefined && typeof value.label !== "string") {
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
  if (
    value.labelSettings !== undefined &&
    !isGraphSocketLabelSettings(value.labelSettings)
  ) {
    return false;
  }
  if (value.metadata !== undefined && !isGraphSocketMetadata(value.metadata)) {
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

const isGraphFrameValue = (value: unknown): value is GraphFrame => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.id !== "string" || typeof value.title !== "string") {
    return false;
  }
  if (!isRecord(value.position) || !isRecord(value.size)) {
    return false;
  }
  if (
    typeof value.position.x !== "number" ||
    typeof value.position.y !== "number"
  ) {
    return false;
  }
  if (
    typeof value.size.width !== "number" ||
    typeof value.size.height !== "number"
  ) {
    return false;
  }
  return true;
};

const isClipboardPayload = (
  value: unknown,
): value is ClipboardPayloadV1 | ClipboardPayloadV2 => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind !== CLIPBOARD_KIND) {
    return false;
  }
  if (value.version !== 1 && value.version !== 2) {
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
  if (
    value.version === 2 &&
    (!Array.isArray(value.frames) || !value.frames.every(isGraphFrameValue))
  ) {
    return false;
  }
  return true;
};

const normalizeClipboardPayload = (
  payload: ClipboardPayloadV1 | ClipboardPayloadV2,
): ClipboardPayload =>
  payload.version === 2 ? payload : { ...payload, version: 2, frames: [] };

export default function EditorCanvas(props: EditorCanvasProps) {
  let container: HTMLDivElement | undefined;
  let app: Application | null = null;
  let scene: CanvasScene | null = null;
  let gridGraphics: Graphics | null = null;
  let dragState: DragState = { kind: "none" };
  let isViewportEmpty = false;
  let canvasPalette: CanvasPalette = getCanvasPalette("dark");
  let wireTapCandidate: {
    pointerId: number;
    wireId: WireId;
    screen: Point;
    client: Point;
  } | null = null;
  let textEditInput: HTMLInputElement | undefined;

  const { onViewportEmpty, onDiveIntoSubgraph, onCollapseSelectionToSubgraph } =
    props;
  const {
    graph,
    dirtyState,
    selectedNodes,
    selectedFrames,
    selectedWires,
    bypassedNodes,
    collapsedNodes,
    settings,
    execVisualization,
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
    recordConnectionAttempt,
    setNodeSelection,
    setFrameSelection,
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
  let selectedFramesSnapshot = selectedFrames();
  let selectedWiresSnapshot = selectedWires();
  let bypassedNodesSnapshot = bypassedNodes();
  let collapsedNodesSnapshot = collapsedNodes();
  let settingsSnapshot = settings();
  let execVisualizationSnapshot = execVisualization();
  let commandPaletteOpenSnapshot = commandPaletteOpen();
  let hoveredNodeIdSnapshot: NodeId | null = null;
  let hoveredFrameIdSnapshot: FrameId | null = null;
  let hoveredWireIdSnapshot: WireId | null = null;
  let frameCounter = 1;
  let wireCounter = 1;
  let lastAppliedCenter: Point | null = null;
  let keyboardFocus: KeyboardFocus | null = null;
  let focusedSocketId: SocketId | null = null;
  let wireFocusAnchorSocketId: SocketId | null = null;

  const nextFrameId = (): FrameId => {
    let candidate = makeFrameId(`frame-${frameCounter}`);
    while (graphSnapshot.frames.has(candidate)) {
      frameCounter += 1;
      candidate = makeFrameId(`frame-${frameCounter}`);
    }
    frameCounter += 1;
    return candidate;
  };

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
      return isClipboardPayload(parsed)
        ? normalizeClipboardPayload(parsed)
        : null;
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
  ): {
    commands: GraphCommand[];
    newNodeIds: NodeId[];
    newFrameIds: FrameId[];
  } | null => {
    if (payload.nodes.length === 0 && payload.frames.length === 0) {
      return null;
    }

    const usedNodeIds = new Set<NodeId>(graphSnapshot.nodes.keys());
    const usedWireIds = new Set<WireId>(graphSnapshot.wires.keys());
    const usedFrameIds = new Set<FrameId>(graphSnapshot.frames.keys());
    const nextNodeId = createIdFactory<NodeId>("node", usedNodeIds, makeNodeId);
    const nextWireId = createIdFactory<WireId>("wire", usedWireIds, makeWireId);
    const nextFrameId = createIdFactory<FrameId>(
      "frame",
      usedFrameIds,
      makeFrameId,
    );

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
    const newFrameIds: FrameId[] = [];

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

    const mapFrameSocketIds = (
      ids?: ReadonlyArray<SocketId>,
    ): SocketId[] | undefined => {
      if (!ids) {
        return undefined;
      }
      return ids.flatMap((socketId) => {
        const mapped = socketIdMap.get(socketId);
        return mapped ? [mapped] : [];
      });
    };

    for (const frame of payload.frames) {
      const newFrameId = nextFrameId();
      newFrameIds.push(newFrameId);
      const exposedInputs = mapFrameSocketIds(frame.exposedInputs);
      const exposedOutputs = mapFrameSocketIds(frame.exposedOutputs);
      const newFrame: GraphFrame = {
        ...frame,
        id: newFrameId,
        position: {
          x: frame.position.x + offset.x,
          y: frame.position.y + offset.y,
        },
        ...(exposedInputs !== undefined ? { exposedInputs } : {}),
        ...(exposedOutputs !== undefined ? { exposedOutputs } : {}),
      };
      commands.push({ kind: "add-frame", frame: newFrame });
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

    return { commands, newNodeIds, newFrameIds };
  };

  const resolveCopySelection = (): {
    nodeIds: Set<NodeId>;
    frameIds: Set<FrameId>;
  } => {
    const nodeIds = new Set<NodeId>(selectedNodesSnapshot);
    const frameIds = new Set<FrameId>();
    if (selectedFramesSnapshot.size > 0) {
      const hierarchy = buildFrameHierarchy(graphSnapshot.frames.values());
      const descendants = collectFrameDescendants(
        selectedFramesSnapshot,
        hierarchy,
      );
      for (const frameId of descendants) {
        frameIds.add(frameId);
      }
      const nodeOwners = getNodeFrameOwners(
        graphSnapshot.nodes.values(),
        layout,
        hierarchy,
      );
      for (const [nodeId, ownerFrameId] of nodeOwners.entries()) {
        if (frameIds.has(ownerFrameId)) {
          nodeIds.add(nodeId);
        }
      }
    }
    if (
      nodeIds.size === 0 &&
      frameIds.size === 0 &&
      selectedWiresSnapshot.size > 0
    ) {
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
    }
    return { nodeIds, frameIds };
  };

  const buildClipboardPayload = (): ClipboardPayload | null => {
    const { nodeIds, frameIds } = resolveCopySelection();
    if (nodeIds.size === 0 && frameIds.size === 0) {
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
    const frames: GraphFrame[] = [];
    for (const frameId of frameIds) {
      const frame = graphSnapshot.frames.get(frameId);
      if (frame) {
        frames.push({
          ...frame,
          position: { ...frame.position },
          size: { ...frame.size },
        });
      }
    }
    return {
      kind: CLIPBOARD_KIND,
      version: CLIPBOARD_VERSION,
      nodes,
      sockets,
      wires,
      frames,
    };
  };

  const pasteClipboardPayload = async (): Promise<void> => {
    const payload = await readClipboardPayload();
    if (
      !payload ||
      (payload.nodes.length === 0 && payload.frames.length === 0)
    ) {
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    for (const node of payload.nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
    }
    for (const frame of payload.frames) {
      minX = Math.min(minX, frame.position.x);
      minY = Math.min(minY, frame.position.y);
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
      if (payloadResult.newFrameIds.length > 0) {
        setFrameSelection(new Set(payloadResult.newFrameIds));
      }
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
      if (payloadResult.newFrameIds.length > 0) {
        setFrameSelection(new Set(payloadResult.newFrameIds));
      }
    }
  };
  const [socketTooltip, setSocketTooltip] = createSignal<SocketTooltip | null>(
    null,
  );
  const [wireTooltip, setWireTooltip] = createSignal<WireTooltip | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = createSignal<NodeId | null>(null);
  const [hoveredFrameId, setHoveredFrameId] = createSignal<FrameId | null>(
    null,
  );
  const [hoveredWireId, setHoveredWireId] = createSignal<WireId | null>(null);
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState | null>(
    null,
  );
  const [textEdit, setTextEdit] = createSignal<TextEditState | null>(null);
  const [textEditValue, setTextEditValue] = createSignal("");
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

  const getSceneSocketPosition = (socketId: SocketId): Point | null =>
    scene?.getSocketPosition(socketId) ??
    getSocketPosition(graphSnapshot, socketId, layout);

  const openFrameTitleEditor = (frame: GraphFrame, screen: Point): void => {
    setTextEdit({
      kind: "frame-title",
      frameId: frame.id,
      screen,
      defaultValue: frame.title,
    });
    setTextEditValue(frame.title);
    setContextMenu(null);
  };

  const openSocketLabelEditor = (socket: GraphSocket, screen: Point): void => {
    const defaultValue = socket.label?.trim().length
      ? socket.label
      : socket.name;
    setTextEdit({
      kind: "socket-label",
      socketId: socket.id,
      screen,
      defaultValue,
    });
    setTextEditValue(defaultValue);
    setContextMenu(null);
  };

  const commitTextEdit = (state: TextEditState, rawValue?: string): void => {
    const value = rawValue ?? textEditValue();
    if (state.kind === "frame-title") {
      const frame = graphSnapshot.frames.get(state.frameId);
      if (!frame) {
        setTextEdit(null);
        return;
      }
      const nextTitle = sanitizeFrameTitle(value);
      if (nextTitle !== frame.title) {
        applyGraphCommand(
          createUpdateFrameCommand(frame, { ...frame, title: nextTitle }),
        );
      }
      setTextEdit(null);
      return;
    }
    const socket = graphSnapshot.sockets.get(state.socketId);
    if (!socket) {
      setTextEdit(null);
      return;
    }
    const node = graphSnapshot.nodes.get(socket.nodeId);
    if (!node) {
      setTextEdit(null);
      return;
    }
    const sockets = collectNodeSockets(node);
    if (!sockets) {
      setTextEdit(null);
      return;
    }
    const trimmed = value.trim();
    const nextLabel =
      trimmed.length === 0 || trimmed === socket.name ? undefined : trimmed;
    if (nextLabel === socket.label) {
      setTextEdit(null);
      return;
    }
    const nextSockets = sockets.map((entry) =>
      entry.id === socket.id ? { ...entry, label: nextLabel } : entry,
    );
    applyGraphCommand(
      createUpdateNodeIoCommand(
        { node, sockets },
        { node, sockets: nextSockets },
      ),
    );
    setTextEdit(null);
  };

  const cancelTextEdit = (): void => {
    setTextEdit(null);
  };

  const registerTestApi = (): (() => void) | null => {
    if (typeof window === "undefined") {
      return null;
    }
    const target = window as Window & { __SHADR_TEST__?: CanvasTestApi };
    const toPagePoint = (point: Point): Point | null => {
      const canvas = app?.canvas;
      if (!canvas) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + point.x, y: rect.top + point.y };
    };
    target.__SHADR_TEST__ = {
      getNodeIds: () => Array.from(graphSnapshot.nodes.keys()).sort(),
      getWireIds: () => Array.from(graphSnapshot.wires.keys()).sort(),
      getNodePosition: (nodeId) => {
        const node = graphSnapshot.nodes.get(nodeId);
        return node ? { ...node.position } : null;
      },
      getNodeScreenCenter: (nodeId) => {
        const node = graphSnapshot.nodes.get(nodeId);
        if (!node || !scene) {
          return null;
        }
        const { width, height } = getNodeSize(node, layout);
        const screenPoint = scene.worldToScreen({
          x: node.position.x + width / 2,
          y: node.position.y + height / 2,
        });
        return toPagePoint(screenPoint);
      },
      getSocketsForNode: (nodeId) => {
        const node = graphSnapshot.nodes.get(nodeId);
        if (!node) {
          return null;
        }
        return { inputs: [...node.inputs], outputs: [...node.outputs] };
      },
      getSocketScreenPosition: (socketId) => {
        if (!scene) {
          return null;
        }
        const position = getSceneSocketPosition(socketId);
        if (!position) {
          return null;
        }
        return toPagePoint(scene.worldToScreen(position));
      },
    };
    return () => {
      delete target.__SHADR_TEST__;
    };
  };

  const getFrameResizeHandle = (
    frame: GraphFrame,
    worldPoint: Point,
  ): FrameResizeHandle | null => {
    const localX = worldPoint.x - frame.position.x;
    const localY = worldPoint.y - frame.position.y;
    const { width, height } = frame.size;
    const within =
      localX >= -FRAME_RESIZE_CORNER_HIT_SIZE &&
      localX <= width + FRAME_RESIZE_CORNER_HIT_SIZE &&
      localY >= -FRAME_RESIZE_CORNER_HIT_SIZE &&
      localY <= height + FRAME_RESIZE_CORNER_HIT_SIZE;
    if (!within) {
      return null;
    }
    const nearLeftEdge = localX <= FRAME_RESIZE_HIT_SIZE;
    const nearRightEdge = localX >= width - FRAME_RESIZE_HIT_SIZE;
    const nearTopEdge = localY <= FRAME_RESIZE_HIT_SIZE;
    const nearBottomEdge = localY >= height - FRAME_RESIZE_HIT_SIZE;
    const nearLeftCorner = localX <= FRAME_RESIZE_CORNER_HIT_SIZE;
    const nearRightCorner = localX >= width - FRAME_RESIZE_CORNER_HIT_SIZE;
    const nearTopCorner = localY <= FRAME_RESIZE_CORNER_HIT_SIZE;
    const nearBottomCorner = localY >= height - FRAME_RESIZE_CORNER_HIT_SIZE;
    if (nearTopCorner && nearLeftCorner) {
      return "nw";
    }
    if (nearTopCorner && nearRightCorner) {
      return "ne";
    }
    if (nearBottomCorner && nearLeftCorner) {
      return "sw";
    }
    if (nearBottomCorner && nearRightCorner) {
      return "se";
    }
    if (nearTopEdge) {
      return "n";
    }
    if (nearBottomEdge) {
      return "s";
    }
    if (nearLeftEdge) {
      return "w";
    }
    if (nearRightEdge) {
      return "e";
    }
    return null;
  };

  const resizeFrame = (
    frame: GraphFrame,
    handle: FrameResizeHandle,
    delta: Point,
  ): GraphFrame => {
    const startWidth = frame.size.width;
    const startHeight = frame.size.height;
    let nextX = frame.position.x;
    let nextY = frame.position.y;
    let nextWidth = startWidth;
    let nextHeight = startHeight;

    if (handle.includes("e")) {
      nextWidth = startWidth + delta.x;
    }
    if (handle.includes("s")) {
      nextHeight = startHeight + delta.y;
    }
    if (handle.includes("w")) {
      nextWidth = startWidth - delta.x;
      nextX = frame.position.x + (startWidth - nextWidth);
    }
    if (handle.includes("n")) {
      nextHeight = startHeight - delta.y;
      nextY = frame.position.y + (startHeight - nextHeight);
    }

    const clampedWidth = Math.max(FRAME_MIN_SIZE.width, nextWidth);
    const clampedHeight = Math.max(FRAME_MIN_SIZE.height, nextHeight);
    if (clampedWidth !== nextWidth) {
      nextX = frame.position.x + (startWidth - clampedWidth);
      nextWidth = clampedWidth;
    }
    if (clampedHeight !== nextHeight) {
      nextY = frame.position.y + (startHeight - clampedHeight);
      nextHeight = clampedHeight;
    }

    return {
      ...frame,
      position: { x: nextX, y: nextY },
      size: { width: nextWidth, height: nextHeight },
    };
  };

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

  const getFrameDragBounds = (
    positions: Map<FrameId, Point>,
  ): Bounds | null => {
    let bounds: Bounds | null = null;
    for (const [frameId, position] of positions.entries()) {
      const frame = graphSnapshot.frames.get(frameId);
      if (!frame) {
        continue;
      }
      const frameBounds = {
        minX: position.x,
        minY: position.y,
        maxX: position.x + frame.size.width,
        maxY: position.y + frame.size.height,
      };
      if (!bounds) {
        bounds = frameBounds;
      } else {
        bounds = {
          minX: Math.min(bounds.minX, frameBounds.minX),
          minY: Math.min(bounds.minY, frameBounds.minY),
          maxX: Math.max(bounds.maxX, frameBounds.maxX),
          maxY: Math.max(bounds.maxY, frameBounds.maxY),
        };
      }
    }
    return bounds;
  };

  const mergeBounds = (
    left: Bounds | null,
    right: Bounds | null,
  ): Bounds | null => {
    if (!left) {
      return right;
    }
    if (!right) {
      return left;
    }
    return {
      minX: Math.min(left.minX, right.minX),
      minY: Math.min(left.minY, right.minY),
      maxX: Math.max(left.maxX, right.maxX),
      maxY: Math.max(left.maxY, right.maxY),
    };
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

  const isAnyItemInView = (): boolean => {
    if (!scene) {
      return false;
    }
    if (graphSnapshot.nodes.size === 0 && graphSnapshot.frames.size === 0) {
      return false;
    }
    const worldBounds = scene.getWorldBounds();
    for (const frame of graphSnapshot.frames.values()) {
      const frameBounds = {
        minX: frame.position.x,
        minY: frame.position.y,
        maxX: frame.position.x + frame.size.width,
        maxY: frame.position.y + frame.size.height,
      };
      const intersects =
        frameBounds.maxX >= worldBounds.minX &&
        frameBounds.minX <= worldBounds.maxX &&
        frameBounds.maxY >= worldBounds.minY &&
        frameBounds.minY <= worldBounds.maxY;
      if (intersects) {
        return true;
      }
    }
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
    if (!scene || !container) {
      return;
    }
    if (graphSnapshot.nodes.size === 0 && graphSnapshot.frames.size === 0) {
      isViewportEmpty = false;
      return;
    }
    if (container.clientWidth <= 1 || container.clientHeight <= 1) {
      isViewportEmpty = false;
      return;
    }
    const hasVisibleItems = isAnyItemInView();
    const nextEmpty = !hasVisibleItems;
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
    const targetMinorPx = 22;
    const level = Math.log2((GRID_SIZE * zoom) / targetMinorPx);
    const levelStep = Math.floor(level);
    const levelBlend = clamp(level - levelStep, 0, 1);
    const spacingScale = Math.pow(2, -levelStep);
    const minorSpacing = GRID_SIZE * spacingScale;
    const majorSpacing = minorSpacing * 4;
    const zoomFade = smoothstep(zoom, 0.06, 0.18);
    const minorLevelFade = smoothstep(levelBlend, 0.15, 0.85);
    const minorAlpha =
      clamp(smoothstep(minorSpacing * zoom, 6, 26) * 0.18, 0, 0.18) *
      minorLevelFade *
      zoomFade;
    const majorAlpha =
      clamp(smoothstep(majorSpacing * zoom, 14, 80) * 0.45, 0, 0.45) * zoomFade;

    if (minorAlpha > 0) {
      const minorStartX = Math.floor(minX / minorSpacing) * minorSpacing;
      const minorEndX = Math.ceil(maxX / minorSpacing) * minorSpacing;
      const minorStartY = Math.floor(minY / minorSpacing) * minorSpacing;
      const minorEndY = Math.ceil(maxY / minorSpacing) * minorSpacing;
      for (let x = minorStartX; x <= minorEndX; x += minorSpacing) {
        if (x % majorSpacing === 0) {
          continue;
        }
        gridGraphics.moveTo(x, minY);
        gridGraphics.lineTo(x, maxY);
      }
      for (let y = minorStartY; y <= minorEndY; y += minorSpacing) {
        if (y % majorSpacing === 0) {
          continue;
        }
        gridGraphics.moveTo(minX, y);
        gridGraphics.lineTo(maxX, y);
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
        gridGraphics.moveTo(x, minY);
        gridGraphics.lineTo(x, maxY);
      }
      for (let y = majorStartY; y <= majorEndY; y += majorSpacing) {
        gridGraphics.moveTo(minX, y);
        gridGraphics.lineTo(maxX, y);
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
      gridGraphics.moveTo(0, minY);
      gridGraphics.lineTo(0, maxY);
      gridGraphics.stroke({
        width: axisWidth,
        color: canvasPalette.gridAxis,
        alpha: axisAlpha,
      });
    }
    if (0 >= minY && 0 <= maxY) {
      gridGraphics.moveTo(minX, 0);
      gridGraphics.lineTo(maxX, 0);
      gridGraphics.stroke({
        width: axisWidth,
        color: canvasPalette.gridAxis,
        alpha: axisAlpha,
      });
    }
  };

  const buildExecutionState = (): CanvasExecutionState => {
    if (
      !settingsSnapshot.executionVizEnabled ||
      !execVisualizationSnapshot ||
      execVisualizationSnapshot.nodes.size === 0
    ) {
      return { enabled: false };
    }
    const nodes = new Map<NodeId, CanvasExecutionNodeState>();
    for (const entry of execVisualizationSnapshot.nodes.values()) {
      nodes.set(entry.nodeId, {
        order: entry.order,
        durationMs: entry.durationMs,
        maxDurationMs: Math.max(1, execVisualizationSnapshot.maxDurationMs),
        cacheHit: entry.cacheHit,
      });
    }
    return { enabled: true, nodes };
  };

  const syncScene = (): void => {
    scene?.syncGraph(
      graphSnapshot,
      {
        selectedNodes: selectedNodesSnapshot,
        selectedFrames: selectedFramesSnapshot,
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
      {
        hoveredFrameId: hoveredFrameIdSnapshot,
      },
      buildExecutionState(),
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

  const removeNodesWithReconnect = (
    nodeIds: Iterable<NodeId>,
    label: string,
    reconnectMode: DeleteSelectionMode,
  ): boolean => {
    const commands = buildDeleteSelectionCommands({
      graph: graphSnapshot,
      nodeIds: Array.from(nodeIds),
      frameIds: [],
      wireIds: [],
      reconnectMode,
      createWireId: nextWireId,
    });
    const changed = applyCommands(label, commands);
    if (changed) {
      clearSelection();
    }
    return changed;
  };

  const removeFrames = (
    frameIds: Iterable<FrameId>,
    label: string,
  ): boolean => {
    const commands = Array.from(frameIds)
      .map((frameId) => createRemoveFrameCommand(graphSnapshot, frameId))
      .filter((command): command is NonNullable<typeof command> => !!command);
    const changed = applyCommands(label, commands);
    if (changed) {
      clearSelection();
    }
    return changed;
  };

  const addFrameAt = (position: Point): FrameId | null => {
    const frameId = nextFrameId();
    const frame: GraphFrame = {
      id: frameId,
      title: "Frame",
      description: "",
      collapsed: false,
      exposedInputs: [],
      exposedOutputs: [],
      position: applySnap(position),
      size: { ...DEFAULT_FRAME_SIZE },
    };
    const added = applyGraphCommand({ kind: "add-frame", frame });
    if (added) {
      setFrameSelection(new Set([frameId]));
      return frameId;
    }
    return null;
  };

  const getBoundsForNodeIds = (nodeIds: Iterable<NodeId>): Bounds | null => {
    const positions = new Map<NodeId, Point>();
    for (const nodeId of nodeIds) {
      const node = graphSnapshot.nodes.get(nodeId);
      if (node) {
        positions.set(nodeId, { ...node.position });
      }
    }
    return getDragBounds(positions);
  };

  const getBoundsForFrameIds = (frameIds: Iterable<FrameId>): Bounds | null => {
    const positions = new Map<FrameId, Point>();
    for (const frameId of frameIds) {
      const frame = graphSnapshot.frames.get(frameId);
      if (frame) {
        positions.set(frameId, { ...frame.position });
      }
    }
    return getFrameDragBounds(positions);
  };

  const sanitizeFrameTitle = (value: string): string => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "Frame";
  };

  const collectNodeSockets = (node: GraphNode): GraphSocket[] | null => {
    const sockets: GraphSocket[] = [];
    for (const socketId of node.inputs) {
      const socket = graphSnapshot.sockets.get(socketId);
      if (!socket) {
        return null;
      }
      sockets.push(socket);
    }
    for (const socketId of node.outputs) {
      const socket = graphSnapshot.sockets.get(socketId);
      if (!socket) {
        return null;
      }
      sockets.push(socket);
    }
    return sockets;
  };

  const createFrameFromBounds = (title: string, bounds: Bounds): GraphFrame => {
    const width = Math.max(
      bounds.maxX - bounds.minX + GROUP_FRAME_PADDING.x * 2,
      FRAME_MIN_SIZE.width,
    );
    const height = Math.max(
      bounds.maxY - bounds.minY + GROUP_FRAME_PADDING.y * 2,
      FRAME_MIN_SIZE.height,
    );
    const position = applySnap({
      x: bounds.minX - GROUP_FRAME_PADDING.x,
      y: bounds.minY - GROUP_FRAME_PADDING.y,
    });
    return {
      id: nextFrameId(),
      title,
      description: "",
      collapsed: false,
      exposedInputs: [],
      exposedOutputs: [],
      position,
      size: { width, height },
    };
  };

  const groupSelectionIntoFrame = (): void => {
    const bounds = mergeBounds(
      getBoundsForNodeIds(selectedNodesSnapshot),
      getBoundsForFrameIds(selectedFramesSnapshot),
    );
    if (!bounds) {
      return;
    }
    const frame = createFrameFromBounds("Group", bounds);
    if (applyCommands("group-selection", [{ kind: "add-frame", frame }])) {
      setFrameSelection(new Set([frame.id]));
    }
  };

  const ungroupSelectedFrames = (): void => {
    if (selectedFramesSnapshot.size === 0) {
      return;
    }
    removeFrames(selectedFramesSnapshot, "ungroup-frames");
  };

  const frameNodesByCategory = (): void => {
    const nodeIds =
      selectedNodesSnapshot.size > 0
        ? Array.from(selectedNodesSnapshot)
        : Array.from(graphSnapshot.nodes.keys());
    if (nodeIds.length === 0) {
      return;
    }
    const nodesByCategory = new Map<string, NodeId[]>();
    for (const nodeId of nodeIds) {
      const node = graphSnapshot.nodes.get(nodeId);
      if (!node) {
        continue;
      }
      const category =
        getNodeCatalogEntry(node.type)?.category ?? "Uncategorized";
      const bucket = nodesByCategory.get(category);
      if (bucket) {
        bucket.push(nodeId);
      } else {
        nodesByCategory.set(category, [nodeId]);
      }
    }
    const commands: GraphCommand[] = [];
    const newFrameIds: FrameId[] = [];
    for (const [category, ids] of nodesByCategory.entries()) {
      const bounds = getBoundsForNodeIds(ids);
      if (!bounds) {
        continue;
      }
      const frame = createFrameFromBounds(category, bounds);
      commands.push({ kind: "add-frame", frame });
      newFrameIds.push(frame.id);
    }
    if (applyCommands("frame-by-category", commands)) {
      setFrameSelection(new Set(newFrameIds));
    }
  };

  const toggleFrameCollapsed = (frameId: FrameId): void => {
    const frame = graphSnapshot.frames.get(frameId);
    if (!frame) {
      return;
    }
    const updated = { ...frame, collapsed: !frame.collapsed };
    applyGraphCommand(createUpdateFrameCommand(frame, updated));
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

  const deleteSelection = (
    reconnectMode: DeleteSelectionMode = "remove",
  ): void => {
    if (
      selectedNodesSnapshot.size === 0 &&
      selectedFramesSnapshot.size === 0 &&
      selectedWiresSnapshot.size === 0
    ) {
      return;
    }
    const commands = buildDeleteSelectionCommands({
      graph: graphSnapshot,
      nodeIds: Array.from(selectedNodesSnapshot),
      frameIds: Array.from(selectedFramesSnapshot),
      wireIds: Array.from(selectedWiresSnapshot),
      reconnectMode,
      createWireId: nextWireId,
    });
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

  const distanceSquared = (a: Point, b: Point): number => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
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

  const formatNumberValue = (
    value: number,
    format: GraphSocketNumberFormat | undefined,
  ): string => {
    switch (format) {
      case "integer":
        return `${Math.round(value)}`;
      case "fixed-2":
        return value.toFixed(2);
      case "fixed-3":
        return value.toFixed(3);
      case "percent":
        return `${(value * 100).toFixed(1)}%`;
      default:
        return String(value);
    }
  };

  const formatSocketValue = (
    socket: GraphSocket,
    value: JsonValue | null,
  ): string => {
    if (value === null) {
      return "null";
    }
    const metadata = socket.metadata;
    const units = metadata?.units?.trim();
    const format = metadata?.format;
    const appendUnits = (label: string): string =>
      units && units.length > 0 ? `${label} ${units}` : label;
    if (typeof value === "number") {
      return appendUnits(formatNumberValue(value, format));
    }
    if (typeof value === "boolean") {
      return String(value);
    }
    if (typeof value === "string") {
      return `"${value}"`;
    }
    if (
      Array.isArray(value) &&
      value.every((entry) => typeof entry === "number")
    ) {
      const formatted = value.map((entry) => formatNumberValue(entry, format));
      return appendUnits(`(${formatted.join(", ")})`);
    }
    return JSON.stringify(value);
  };

  const getSocketDisplayLabel = (socket: GraphSocket): string =>
    socket.label?.trim().length ? socket.label : socket.name;

  const formatSocketRangeLabel = (socket: GraphSocket): string | null => {
    const metadata = socket.metadata;
    if (!metadata) {
      return null;
    }
    const { min, max } = metadata;
    const units = metadata.units?.trim();
    const appendUnits = (label: string): string =>
      units && units.length > 0 ? `${label} ${units}` : label;
    if (min === undefined && max === undefined) {
      return null;
    }
    if (min !== undefined && max !== undefined) {
      return appendUnits(`Range: ${min}–${max}`);
    }
    if (min !== undefined) {
      return appendUnits(`Range: ≥${min}`);
    }
    return appendUnits(`Range: ≤${max}`);
  };

  const formatSocketTypeLabel = (socket: GraphSocket): string => {
    const base = `Type: ${getSocketTypeLabel(socket.dataType)}`;
    const rangeLabel = formatSocketRangeLabel(socket);
    return rangeLabel ? `${base} • ${rangeLabel}` : base;
  };

  const formatSocketConnectionLabel = (socket: GraphSocket): string => {
    const current = getSocketConnectionCount(socket);
    const max = getSocketMaxConnections(socket);
    if (max === null) {
      return `Connections: ${current} / many (one-to-many)`;
    }
    const mode = max === 1 ? "one-to-one" : `max ${max}`;
    const limitNote = current >= max ? " • limit reached" : "";
    return `Connections: ${current} / ${max} (${mode})${limitNote}`;
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
    const title = `${socket.direction === "input" ? "Input" : "Output"}: ${getSocketDisplayLabel(
      socket,
    )}`;
    const typeLabel = formatSocketTypeLabel(socket);
    let valueLabel = "Value: No cached value";

    if (socket.direction === "output") {
      const cached = getCachedOutputValue(socket);
      if (cached !== undefined) {
        valueLabel = `Value: ${formatSocketValue(socket, cached)}`;
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
            valueLabel = `Value: ${formatSocketValue(fromSocket, cached)}`;
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
      connectionLabel: formatSocketConnectionLabel(socket),
    };
  };

  const getSocketTypeLabel = (typeId: string): string =>
    getSocketTypeMetadata(typeId)?.label ?? typeId;

  const buildWireTooltip = (wireId: WireId): WireTooltip | null => {
    if (!scene) {
      return null;
    }
    const wire = graphSnapshot.wires.get(wireId);
    if (!wire) {
      return null;
    }
    const fromSocket = graphSnapshot.sockets.get(wire.fromSocketId);
    const toSocket = graphSnapshot.sockets.get(wire.toSocketId);
    if (!fromSocket || !toSocket) {
      return null;
    }
    const midpoint = getWireMidpoint(wireId);
    if (!midpoint) {
      return null;
    }
    const screenPoint = scene.worldToScreen(midpoint);
    const typeLabel = formatSocketTypeLabel(fromSocket);
    let valueLabel = "Value: No cached value";
    const cached = getCachedOutputValue(fromSocket);
    if (cached !== undefined) {
      valueLabel = `Value: ${formatSocketValue(fromSocket, cached)}`;
    }
    return {
      x: screenPoint.x + 12,
      y: screenPoint.y + 12,
      title: `${getSocketDisplayLabel(fromSocket)} -> ${getSocketDisplayLabel(
        toSocket,
      )}`,
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
  ): WireHoverResult => {
    if (hit.kind !== "socket") {
      return {
        status: "neutral",
        targetPosition: null,
        targetSocketId: null,
        reason: null,
      };
    }
    return getWireHoverStatusFromOutput(
      fromSocketId,
      hit.socketId,
      hit.position,
    );
  };

  const getWireConnectionCheck = (
    fromSocket: GraphSocket,
    toSocket: GraphSocket,
  ): Readonly<{
    status: WireHoverStatus;
    reason: ConnectionAttemptReason | null;
  }> => {
    if (fromSocket.direction !== "output" || toSocket.direction !== "input") {
      return { status: "invalid", reason: "direction" };
    }
    if (fromSocket.nodeId === toSocket.nodeId) {
      return { status: "invalid", reason: "self-loop" };
    }
    if (!isSocketTypeCompatible(fromSocket.dataType, toSocket.dataType)) {
      return { status: "invalid", reason: "type-mismatch" };
    }
    const fromMax = getSocketMaxConnections(fromSocket);
    if (fromMax !== null && getSocketConnectionCount(fromSocket) >= fromMax) {
      return { status: "invalid", reason: "connection-limit" };
    }
    const toMax = getSocketMaxConnections(toSocket);
    if (toMax !== null && getSocketConnectionCount(toSocket) >= toMax) {
      return { status: "invalid", reason: "connection-limit" };
    }
    if (wouldCreateCycle(fromSocket.nodeId, toSocket.nodeId)) {
      return { status: "invalid", reason: "cycle" };
    }
    return { status: "valid", reason: null };
  };

  const getWireHoverStatusFromOutput = (
    fromSocketId: SocketId,
    targetSocketId: SocketId,
    targetPosition: Point,
  ): WireHoverResult => {
    const fromSocket = graphSnapshot.sockets.get(fromSocketId);
    const toSocket = graphSnapshot.sockets.get(targetSocketId);
    if (!fromSocket || !toSocket) {
      return {
        status: "invalid",
        targetPosition,
        targetSocketId: null,
        reason: "missing-socket",
      };
    }
    const connectionCheck = getWireConnectionCheck(fromSocket, toSocket);
    return {
      status: connectionCheck.status,
      targetPosition,
      targetSocketId: toSocket.id,
      reason: connectionCheck.reason,
    };
  };

  const getWireHoverStatusFromInput = (
    toSocketId: SocketId,
    targetSocketId: SocketId,
    targetPosition: Point,
  ): WireHoverResult => {
    const toSocket = graphSnapshot.sockets.get(toSocketId);
    const fromSocket = graphSnapshot.sockets.get(targetSocketId);
    if (!fromSocket || !toSocket) {
      return {
        status: "invalid",
        targetPosition,
        targetSocketId: null,
        reason: "missing-socket",
      };
    }
    const connectionCheck = getWireConnectionCheck(fromSocket, toSocket);
    return {
      status: connectionCheck.status,
      targetPosition,
      targetSocketId: fromSocket.id,
      reason: connectionCheck.reason,
    };
  };

  const getSnapSocketHit = (
    worldPoint: Point,
    direction: GraphSocket["direction"],
    excludeSocketId: SocketId | null,
  ): ReturnType<CanvasScene["hitTest"]> | null => {
    if (!scene) {
      return null;
    }
    const zoom = Math.max(scene.getZoom(), 0.001);
    const maxDistanceWorld = WIRE_SNAP_DISTANCE_PX / zoom;
    const maxDistanceSq = maxDistanceWorld * maxDistanceWorld;
    let best: {
      socketId: SocketId;
      nodeId: NodeId;
      position: Point;
      distanceSq: number;
    } | null = null;
    for (const socket of graphSnapshot.sockets.values()) {
      if (socket.direction !== direction) {
        continue;
      }
      if (excludeSocketId && socket.id === excludeSocketId) {
        continue;
      }
      const position = getSceneSocketPosition(socket.id);
      if (!position) {
        continue;
      }
      const distanceSq = distanceSquared(worldPoint, position);
      if (distanceSq > maxDistanceSq) {
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
  };

  const getWireDragHover = (
    screenPoint: Point,
    worldPoint: Point,
    drag: Extract<DragState, { kind: "wire" }>,
  ): WireHoverResult => {
    if (!scene) {
      return {
        status: "neutral",
        targetPosition: null,
        targetSocketId: null,
        reason: null,
      };
    }
    let hit = scene.hitTest(screenPoint);
    if (hit.kind !== "socket") {
      const snapDirection =
        drag.dragMode === "from-output" ? "input" : "output";
      const snapHit = getSnapSocketHit(
        worldPoint,
        snapDirection,
        drag.anchorSocketId,
      );
      if (snapHit) {
        hit = snapHit;
      }
    }
    if (hit.kind !== "socket") {
      return {
        status: "neutral",
        targetPosition: null,
        targetSocketId: null,
        reason: null,
      };
    }
    if (drag.dragMode === "from-output") {
      return getWireHoverStatus(drag.anchorSocketId, hit);
    }
    return getWireHoverStatusFromInput(
      drag.anchorSocketId,
      hit.socketId,
      hit.position,
    );
  };

  const applyWireAutoScroll = (screenPoint: Point): boolean => {
    if (!scene || !container) {
      return false;
    }
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) {
      return false;
    }
    const margin = WIRE_AUTO_SCROLL_MARGIN_PX;
    const maxX = width - margin;
    const maxY = height - margin;
    let deltaX = 0;
    let deltaY = 0;
    if (screenPoint.x < margin) {
      deltaX = -((margin - screenPoint.x) / margin) * WIRE_AUTO_SCROLL_SPEED_PX;
    } else if (screenPoint.x > maxX) {
      deltaX = ((screenPoint.x - maxX) / margin) * WIRE_AUTO_SCROLL_SPEED_PX;
    }
    if (screenPoint.y < margin) {
      deltaY = -((margin - screenPoint.y) / margin) * WIRE_AUTO_SCROLL_SPEED_PX;
    } else if (screenPoint.y > maxY) {
      deltaY = ((screenPoint.y - maxY) / margin) * WIRE_AUTO_SCROLL_SPEED_PX;
    }
    if (deltaX === 0 && deltaY === 0) {
      return false;
    }
    const zoom = Math.max(scene.getZoom(), 0.05);
    scene.panCameraBy({ x: deltaX / zoom, y: deltaY / zoom });
    setCanvasCenter(scene.getCameraCenter());
    syncScene();
    return true;
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
    const from = getSceneSocketPosition(wire.fromSocketId);
    const to = getSceneSocketPosition(wire.toSocketId);
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
    const hit = menu.hit;
    if (hit.kind === "node") {
      return [hit.nodeId];
    }
    if (hit.kind === "wire") {
      const wire = graphSnapshot.wires.get(hit.wireId);
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
    const hit = menu.hit;
    if (menu.mode === "wire-insert" && hit.kind === "wire") {
      const insertCandidates = getWireInsertCandidates(hit.wireId);
      return insertCandidates.map((candidate) => ({
        kind: "item",
        label: `Insert ${candidate.label}`,
        onSelect: () => {
          insertNodeOnWire(hit.wireId, candidate);
        },
      }));
    }
    const entries: ContextMenuEntry[] = [
      {
        kind: "item",
        label: QUICK_ADD_NODE_LABEL,
        onSelect: () => {
          addNodeAt(QUICK_ADD_NODE_TYPE, menu.world);
        },
      },
      {
        kind: "item",
        label: "Add Frame",
        onSelect: () => {
          addFrameAt(menu.world);
        },
      },
    ];
    const hasGroupingTargets =
      selectedNodesSnapshot.size > 0 || selectedFramesSnapshot.size > 0;
    const hasGroupingEntries =
      hasGroupingTargets || graphSnapshot.nodes.size > 0;
    if (hasGroupingEntries) {
      pushSeparator(entries);
      if (hasGroupingTargets) {
        entries.push({
          kind: "item",
          label: "Group Selection",
          onSelect: () => {
            groupSelectionIntoFrame();
          },
        });
      }
      if (selectedFramesSnapshot.size > 0) {
        entries.push({
          kind: "item",
          label: "Ungroup Frames",
          onSelect: () => {
            ungroupSelectedFrames();
          },
        });
      }
      if (graphSnapshot.nodes.size > 0) {
        entries.push({
          kind: "item",
          label:
            selectedNodesSnapshot.size > 0
              ? "Frame Selection by Category"
              : "Frame by Category",
          onSelect: () => {
            frameNodesByCategory();
          },
        });
      }
    }
    const hasSelection =
      selectedNodesSnapshot.size > 0 ||
      selectedFramesSnapshot.size > 0 ||
      selectedWiresSnapshot.size > 0;
    if (hasSelection) {
      entries.push({
        kind: "item",
        label: "Delete Selection",
        onSelect: () => {
          deleteSelection();
        },
      });
      if (selectedNodesSnapshot.size > 0) {
        entries.push({
          kind: "item",
          label: "Delete Selection + Bridge Wires",
          onSelect: () => {
            deleteSelection("bridge");
          },
        });
      }
    }
    if (selectedNodesSnapshot.size > 0 && onCollapseSelectionToSubgraph) {
      entries.push({
        kind: "item",
        label: "Collapse to Subgraph",
        onSelect: () => {
          onCollapseSelectionToSubgraph();
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
    switch (hit.kind) {
      case "node": {
        pushSeparator(entries);
        const node = graphSnapshot.nodes.get(hit.nodeId);
        if (node?.type === SUBGRAPH_NODE_TYPE && onDiveIntoSubgraph) {
          entries.push({
            kind: "item",
            label: "Dive into Subgraph",
            onSelect: () => {
              onDiveIntoSubgraph(node.id);
            },
          });
        }
        entries.push({
          kind: "item",
          label: "Delete Node",
          onSelect: () => {
            removeNodesWithReconnect([hit.nodeId], "delete-node", "remove");
          },
        });
        entries.push({
          kind: "item",
          label: "Delete Node + Bridge Wires",
          onSelect: () => {
            removeNodesWithReconnect(
              [hit.nodeId],
              "delete-node-bridge",
              "bridge",
            );
          },
        });
        entries.push({
          kind: "item",
          label: "Toggle Bypass",
          onSelect: () => {
            toggleBypassNodes(new Set([hit.nodeId]));
          },
        });
        break;
      }
      case "frame":
        pushSeparator(entries);
        {
          const frame = graphSnapshot.frames.get(hit.frameId);
          if (frame) {
            entries.push({
              kind: "item",
              label: frame.collapsed ? "Expand Frame" : "Collapse Frame",
              onSelect: () => {
                toggleFrameCollapsed(hit.frameId);
              },
            });
          }
        }
        entries.push({
          kind: "item",
          label: "Delete Frame",
          onSelect: () => {
            removeFrames([hit.frameId], "delete-frame");
          },
        });
        break;
      case "wire": {
        pushSeparator(entries);
        const insertCandidates = getWireInsertCandidates(hit.wireId);
        for (const candidate of insertCandidates) {
          entries.push({
            kind: "item",
            label: `Insert ${candidate.label}`,
            onSelect: () => {
              insertNodeOnWire(hit.wireId, candidate);
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
            removeWires([hit.wireId], "disconnect-wire");
          },
        });
        break;
      }
      case "socket": {
        pushSeparator(entries);
        const socket = graphSnapshot.sockets.get(hit.socketId);
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

    const unregisterTestApi = registerTestApi();
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
      app.canvas.setAttribute("data-testid", "editor-canvas");
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

      const onTick = (): void => {
        if (!scene) {
          return;
        }
        scene.updateWireFlow(performance.now(), {
          enabled:
            settingsSnapshot.executionVizEnabled &&
            (execVisualizationSnapshot?.active ?? false),
        });
      };
      app.ticker.add(onTick);

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
        mode: ContextMenuState["mode"] = "full",
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
        setHoveredFrameId(null);
        setHoveredWireId(null);
        if (hit.kind === "node") {
          if (!selectedNodesSnapshot.has(hit.nodeId)) {
            setNodeSelection(new Set([hit.nodeId]));
            setWireSelection(new Set<WireId>());
          }
        } else if (hit.kind === "frame") {
          if (!selectedFramesSnapshot.has(hit.frameId)) {
            setFrameSelection(new Set([hit.frameId]));
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
          mode,
        });
      };

      const openWireInsertMenu = (
        screenPoint: Point,
        clientPoint: Point,
        wireId: WireId,
      ): void => {
        if (!scene) {
          return;
        }
        const insertCandidates = getWireInsertCandidates(wireId);
        if (insertCandidates.length === 0) {
          return;
        }
        const hit = scene.hitTest(screenPoint);
        if (hit.kind !== "wire" || hit.wireId !== wireId) {
          return;
        }
        const worldPoint = scene.screenToWorld(screenPoint);
        updatePointerPosition(worldPoint, {
          clientX: clientPoint.x,
          clientY: clientPoint.y,
        });
        setSocketTooltip(null);
        setHoveredNodeId(null);
        setHoveredFrameId(null);
        setHoveredWireId(null);
        if (!selectedWiresSnapshot.has(wireId)) {
          setWireSelection(new Set([wireId]));
          setNodeSelection(new Set<NodeId>());
        }
        setContextMenu({
          screen: screenPoint,
          world: worldPoint,
          hit,
          mode: "wire-insert",
        });
      };

      const clearKeyboardFocus = (): void => {
        keyboardFocus = null;
        focusedSocketId = null;
        wireFocusAnchorSocketId = null;
        socketHover.clear();
        socketHover.visible = false;
        setSocketTooltip(null);
        setWireTooltip(null);
      };

      const getSingleSelectionId = <T,>(
        selection: ReadonlySet<T>,
      ): T | null => {
        if (selection.size !== 1) {
          return null;
        }
        const [entry] = selection;
        return entry ?? null;
      };

      const getSortedNodes = (): GraphNode[] => {
        const nodes = Array.from(graphSnapshot.nodes.values());
        nodes.sort((left, right) => {
          if (left.position.y !== right.position.y) {
            return left.position.y - right.position.y;
          }
          return left.position.x - right.position.x;
        });
        return nodes;
      };

      const getNodeCenter = (node: GraphNode): Point => {
        const { width, height } = getNodeSize(node, layout);
        return {
          x: node.position.x + width / 2,
          y: node.position.y + height / 2,
        };
      };

      const focusNode = (nodeId: NodeId): void => {
        if (!graphSnapshot.nodes.has(nodeId)) {
          return;
        }
        setNodeSelection(new Set([nodeId]));
        keyboardFocus = "node";
        focusedSocketId = null;
        wireFocusAnchorSocketId = null;
        socketHover.clear();
        socketHover.visible = false;
        setSocketTooltip(null);
        setWireTooltip(null);
      };

      const getSortedSocketsForNode = (
        nodeId: NodeId,
        direction: GraphSocket["direction"],
      ): GraphSocket[] => {
        const node = graphSnapshot.nodes.get(nodeId);
        if (!node) {
          return [];
        }
        const socketIds = direction === "input" ? node.inputs : node.outputs;
        const sockets = socketIds.flatMap((socketId) => {
          const socket = graphSnapshot.sockets.get(socketId);
          return socket ? [socket] : [];
        });
        sockets.sort((left, right) => {
          const leftPos = getSceneSocketPosition(left.id);
          const rightPos = getSceneSocketPosition(right.id);
          if (leftPos && rightPos && leftPos.y !== rightPos.y) {
            return leftPos.y - rightPos.y;
          }
          if (leftPos && rightPos && leftPos.x !== rightPos.x) {
            return leftPos.x - rightPos.x;
          }
          return left.name.localeCompare(right.name);
        });
        return sockets;
      };

      const focusSocket = (socketId: SocketId): void => {
        const socket = graphSnapshot.sockets.get(socketId);
        if (!socket) {
          return;
        }
        if (!selectedNodesSnapshot.has(socket.nodeId)) {
          setNodeSelection(new Set([socket.nodeId]));
        }
        keyboardFocus = "socket";
        focusedSocketId = socketId;
        wireFocusAnchorSocketId = null;
        setWireTooltip(null);
        const position = getSceneSocketPosition(socketId);
        updateSocketHover(socketHover, position, "neutral");
        if (position && scene) {
          const screenPoint = scene.worldToScreen(position);
          setSocketTooltip(buildSocketTooltip(socketId, screenPoint));
        } else {
          setSocketTooltip(null);
        }
      };

      const focusFirstSocket = (
        nodeId: NodeId,
        preferred: GraphSocket["direction"] | null,
      ): boolean => {
        const directions: GraphSocket["direction"][] = preferred
          ? [preferred, preferred === "input" ? "output" : "input"]
          : ["input", "output"];
        for (const direction of directions) {
          const sockets = getSortedSocketsForNode(nodeId, direction);
          if (sockets.length > 0) {
            focusSocket(sockets[0].id);
            return true;
          }
        }
        return false;
      };

      const moveSocketInColumn = (
        nodeId: NodeId,
        direction: GraphSocket["direction"],
        delta: number,
      ): void => {
        const sockets = getSortedSocketsForNode(nodeId, direction);
        if (sockets.length === 0) {
          return;
        }
        const currentIndex = focusedSocketId
          ? sockets.findIndex((socket) => socket.id === focusedSocketId)
          : -1;
        const startIndex =
          currentIndex >= 0
            ? (currentIndex + delta + sockets.length) % sockets.length
            : delta < 0
              ? sockets.length - 1
              : 0;
        const next = sockets[startIndex];
        if (next) {
          focusSocket(next.id);
        }
      };

      const getWiresForSocket = (socketId: SocketId): GraphWire[] => {
        const socket = graphSnapshot.sockets.get(socketId);
        if (!socket) {
          return [];
        }
        const wires = Array.from(graphSnapshot.wires.values()).filter((wire) =>
          socket.direction === "input"
            ? wire.toSocketId === socketId
            : wire.fromSocketId === socketId,
        );
        wires.sort((left, right) => {
          const leftOther =
            socket.direction === "input" ? left.fromSocketId : left.toSocketId;
          const rightOther =
            socket.direction === "input"
              ? right.fromSocketId
              : right.toSocketId;
          const leftPos = getSceneSocketPosition(leftOther);
          const rightPos = getSceneSocketPosition(rightOther);
          if (leftPos && rightPos && leftPos.y !== rightPos.y) {
            return leftPos.y - rightPos.y;
          }
          if (leftPos && rightPos && leftPos.x !== rightPos.x) {
            return leftPos.x - rightPos.x;
          }
          return left.id.localeCompare(right.id);
        });
        return wires;
      };

      const focusWire = (
        wireId: WireId,
        anchorSocketId: SocketId | null,
      ): void => {
        const wire = graphSnapshot.wires.get(wireId);
        if (!wire) {
          return;
        }
        keyboardFocus = "wire";
        focusedSocketId = null;
        wireFocusAnchorSocketId = anchorSocketId ?? wire.fromSocketId;
        setWireSelection(new Set([wireId]));
        setSocketTooltip(null);
        socketHover.clear();
        socketHover.visible = false;
        setWireTooltip(
          settingsSnapshot.wireHoverLabels ? buildWireTooltip(wireId) : null,
        );
      };

      const focusNextNode = (delta: number): void => {
        const nodes = getSortedNodes();
        if (nodes.length === 0) {
          return;
        }
        const currentId = getSingleSelectionId(selectedNodesSnapshot);
        const currentIndex = currentId
          ? nodes.findIndex((node) => node.id === currentId)
          : -1;
        const nextIndex =
          currentIndex >= 0
            ? (currentIndex + delta + nodes.length) % nodes.length
            : delta < 0
              ? nodes.length - 1
              : 0;
        const next = nodes[nextIndex];
        if (next) {
          focusNode(next.id);
        }
      };

      const focusDirectionalNode = (
        direction: "left" | "right" | "up" | "down",
      ): void => {
        const currentId = getSingleSelectionId(selectedNodesSnapshot);
        if (!currentId) {
          focusNextNode(1);
          return;
        }
        const current = graphSnapshot.nodes.get(currentId);
        if (!current) {
          return;
        }
        const origin = getNodeCenter(current);
        let best: { nodeId: NodeId; score: number } | null = null;
        for (const node of graphSnapshot.nodes.values()) {
          if (node.id === currentId) {
            continue;
          }
          const center = getNodeCenter(node);
          const dx = center.x - origin.x;
          const dy = center.y - origin.y;
          if (direction === "left" && dx >= -1) {
            continue;
          }
          if (direction === "right" && dx <= 1) {
            continue;
          }
          if (direction === "up" && dy >= -1) {
            continue;
          }
          if (direction === "down" && dy <= 1) {
            continue;
          }
          const primary =
            direction === "left" || direction === "right"
              ? Math.abs(dx)
              : Math.abs(dy);
          const secondary =
            direction === "left" || direction === "right"
              ? Math.abs(dy)
              : Math.abs(dx);
          const score = primary + secondary * 0.35;
          if (!best || score < best.score) {
            best = { nodeId: node.id, score };
          }
        }
        if (best) {
          focusNode(best.nodeId);
        }
      };

      const moveWireFocus = (delta: number): void => {
        const currentWireId = getSingleSelectionId(selectedWiresSnapshot);
        const inferredAnchor = currentWireId
          ? (graphSnapshot.wires.get(currentWireId)?.fromSocketId ?? null)
          : null;
        const anchor =
          wireFocusAnchorSocketId ?? focusedSocketId ?? inferredAnchor;
        if (!anchor) {
          return;
        }
        const wires = getWiresForSocket(anchor);
        if (wires.length === 0) {
          return;
        }
        const currentIndex = currentWireId
          ? wires.findIndex((wire) => wire.id === currentWireId)
          : -1;
        const nextIndex =
          currentIndex >= 0
            ? (currentIndex + delta + wires.length) % wires.length
            : delta < 0
              ? wires.length - 1
              : 0;
        const nextWire = wires[nextIndex];
        if (nextWire) {
          focusWire(nextWire.id, anchor);
        }
      };

      const openKeyboardContextMenu = (): void => {
        if (!scene || !app) {
          return;
        }
        let worldPoint = canvasCenter();
        const selectedNodeId = getSingleSelectionId(selectedNodesSnapshot);
        const selectedFrameId = getSingleSelectionId(selectedFramesSnapshot);
        const selectedWireId = getSingleSelectionId(selectedWiresSnapshot);
        if (focusedSocketId) {
          const socketPos = getSceneSocketPosition(focusedSocketId);
          if (socketPos) {
            worldPoint = socketPos;
          }
        } else if (selectedNodeId) {
          const node = graphSnapshot.nodes.get(selectedNodeId);
          if (node) {
            worldPoint = getNodeCenter(node);
          }
        } else if (selectedFrameId) {
          const frame = graphSnapshot.frames.get(selectedFrameId);
          if (frame) {
            worldPoint = {
              x: frame.position.x + frame.size.width / 2,
              y: frame.position.y + frame.size.height / 2,
            };
          }
        } else if (selectedWireId) {
          const midpoint = getWireMidpoint(selectedWireId);
          if (midpoint) {
            worldPoint = midpoint;
          }
        }
        const screenPoint = scene.worldToScreen(worldPoint);
        const rect = app.canvas.getBoundingClientRect();
        openContextMenu(screenPoint, {
          x: rect.left + screenPoint.x,
          y: rect.top + screenPoint.y,
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
          openContextMenu(screen, client, "full");
        }, LONG_PRESS_DURATION_MS);
      };

      const startWireDragFromWire = (
        wireId: WireId,
        worldPoint: Point,
        pointerId: number,
      ): boolean => {
        if (!app) {
          return false;
        }
        const wire = graphSnapshot.wires.get(wireId);
        if (!wire) {
          return false;
        }
        const fromPosition = getSceneSocketPosition(wire.fromSocketId);
        const toPosition = getSceneSocketPosition(wire.toSocketId);
        if (!fromPosition || !toPosition) {
          return false;
        }
        const dragOutputEnd =
          distanceSquared(worldPoint, fromPosition) <=
          distanceSquared(worldPoint, toPosition);
        const removed = applyGraphCommandTransient({
          kind: "remove-wire",
          wire,
        });
        if (!removed) {
          return false;
        }
        const dragMode: WireDragMode = dragOutputEnd
          ? "from-input"
          : "from-output";
        const anchorSocketId = dragOutputEnd
          ? wire.toSocketId
          : wire.fromSocketId;
        const anchorPosition = dragOutputEnd ? toPosition : fromPosition;
        ghostWire.visible = true;
        updateGhostWire(ghostWire, anchorPosition, worldPoint, "neutral");
        socketHover.clear();
        socketHover.visible = false;
        dragState = {
          kind: "wire",
          dragMode,
          anchorSocketId,
          anchorPosition,
          current: worldPoint,
          grabbedWire: wire,
        };
        app.canvas.setPointerCapture(pointerId);
        return true;
      };

      const onPointerDown = (event: PointerEvent): void => {
        const activeScene = scene;
        const activeApp = app;
        if (!activeScene || !activeApp) {
          return;
        }
        clearKeyboardFocus();
        startLongPress(event);
        wireTapCandidate = null;
        if (event.button === 1) {
          event.preventDefault();
          setContextMenu(null);
          setSocketTooltip(null);
          dragState = {
            kind: "pan",
            lastScreen: getScreenPoint(event),
          };
          activeApp.canvas.setPointerCapture(event.pointerId);
          return;
        }
        if (event.button !== 0) {
          return;
        }
        setContextMenu(null);
        const screenPoint = getScreenPoint(event);
        const hit = activeScene.hitTest(screenPoint);
        const worldPoint = activeScene.screenToWorld(screenPoint);
        updatePointerPosition(worldPoint, event);
        setSocketTooltip(null);

        if (hit.kind === "socket") {
          const socket = graphSnapshot.sockets.get(hit.socketId);
          if (socket?.direction === "output") {
            ghostWire.visible = true;
            updateGhostWire(ghostWire, hit.position, worldPoint, "neutral");
            dragState = {
              kind: "wire",
              dragMode: "from-output",
              anchorSocketId: socket.id,
              anchorPosition: hit.position,
              current: worldPoint,
              grabbedWire: null,
            };
            activeApp.canvas.setPointerCapture(event.pointerId);
            return;
          }
          if (socket?.direction === "input") {
            const inputWireId = findInputWire(socket.id);
            if (!inputWireId) {
              return;
            }
            const wire = graphSnapshot.wires.get(inputWireId);
            if (!wire) {
              return;
            }
            const fromPosition =
              getSceneSocketPosition(wire.fromSocketId) ?? hit.position;
            const removed = applyGraphCommandTransient({
              kind: "remove-wire",
              wire,
            });
            if (!removed) {
              return;
            }
            ghostWire.visible = true;
            updateGhostWire(ghostWire, fromPosition, worldPoint, "neutral");
            dragState = {
              kind: "wire",
              dragMode: "from-output",
              anchorSocketId: wire.fromSocketId,
              anchorPosition: fromPosition,
              current: worldPoint,
              grabbedWire: wire,
            };
            activeApp.canvas.setPointerCapture(event.pointerId);
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
          activeApp.canvas.setPointerCapture(event.pointerId);
          return;
        }

        if (hit.kind === "frame") {
          const frame = graphSnapshot.frames.get(hit.frameId);
          const resizeHandle =
            frame && !event.shiftKey
              ? getFrameResizeHandle(frame, worldPoint)
              : null;
          if (frame && resizeHandle) {
            setFrameSelection(new Set([hit.frameId]));
            dragState = {
              kind: "resize-frame",
              frameId: hit.frameId,
              handle: resizeHandle,
              origin: worldPoint,
              startFrame: frame,
            };
            activeApp.canvas.setPointerCapture(event.pointerId);
            return;
          }
          const next = new Set(selectedFramesSnapshot);
          if (event.shiftKey) {
            if (next.has(hit.frameId)) {
              next.delete(hit.frameId);
            } else {
              next.add(hit.frameId);
            }
          } else if (!next.has(hit.frameId)) {
            next.clear();
            next.add(hit.frameId);
          }
          setFrameSelection(next);
          if (!next.has(hit.frameId)) {
            dragState = { kind: "none" };
            return;
          }
          const hierarchy = buildFrameHierarchy(graphSnapshot.frames.values());
          const moveFrameIds = collectFrameDescendants(next, hierarchy);
          const nodeOwners = getNodeFrameOwners(
            graphSnapshot.nodes.values(),
            layout,
            hierarchy,
          );
          const startFramePositions = new Map<FrameId, Point>();
          for (const frameId of moveFrameIds) {
            const frame = graphSnapshot.frames.get(frameId);
            if (frame) {
              startFramePositions.set(frameId, { ...frame.position });
            }
          }
          const startNodePositions = new Map<NodeId, Point>();
          for (const [nodeId, ownerFrameId] of nodeOwners.entries()) {
            if (!moveFrameIds.has(ownerFrameId)) {
              continue;
            }
            const node = graphSnapshot.nodes.get(nodeId);
            if (node) {
              startNodePositions.set(nodeId, { ...node.position });
            }
          }
          const dragBounds = mergeBounds(
            getFrameDragBounds(startFramePositions),
            getDragBounds(startNodePositions),
          );
          if (!dragBounds) {
            dragState = { kind: "none" };
            return;
          }
          dragState = {
            kind: "drag-frames",
            origin: worldPoint,
            startFramePositions,
            startNodePositions,
            bounds: dragBounds,
          };
          activeApp.canvas.setPointerCapture(event.pointerId);
          return;
        }

        if (hit.kind === "wire") {
          const next = new Set<WireId>();
          next.add(hit.wireId);
          setWireSelection(next);
          wireTapCandidate = {
            pointerId: event.pointerId,
            wireId: hit.wireId,
            screen: screenPoint,
            client: { x: event.clientX, y: event.clientY },
          };
          return;
        }

        if (event.pointerType === "touch") {
          dragState = { kind: "pan", lastScreen: screenPoint };
          activeApp.canvas.setPointerCapture(event.pointerId);
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
        activeApp.canvas.setPointerCapture(event.pointerId);
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
        if (
          wireTapCandidate &&
          event.pointerId === wireTapCandidate.pointerId
        ) {
          const dx = screenPoint.x - wireTapCandidate.screen.x;
          const dy = screenPoint.y - wireTapCandidate.screen.y;
          if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD) {
            const candidate = wireTapCandidate;
            wireTapCandidate = null;
            if (dragState.kind === "none") {
              const worldPoint = scene.screenToWorld(screenPoint);
              if (
                startWireDragFromWire(
                  candidate.wireId,
                  worldPoint,
                  event.pointerId,
                )
              ) {
                updatePointerPosition(worldPoint, event);
              }
            }
          }
        }
        let worldPoint = scene.screenToWorld(screenPoint);
        updatePointerPosition(worldPoint, event);

        if (dragState.kind === "drag-nodes") {
          setSocketTooltip(null);
          setHoveredNodeId(null);
          setHoveredFrameId(null);
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

        if (dragState.kind === "drag-frames") {
          setSocketTooltip(null);
          setHoveredNodeId(null);
          setHoveredFrameId(null);
          setHoveredWireId(null);
          const delta = getDragDelta(
            dragState.origin,
            worldPoint,
            dragState.bounds,
          );
          const beforeFrameUpdates = Array.from(
            dragState.startFramePositions.entries(),
          ).map(([frameId, start]) => {
            const current =
              graphSnapshot.frames.get(frameId)?.position ?? start;
            return {
              frameId,
              position: { x: current.x, y: current.y },
            };
          });
          const afterFrameUpdates = Array.from(
            dragState.startFramePositions.entries(),
          ).map(([frameId, start]) => ({
            frameId,
            position: { x: start.x + delta.x, y: start.y + delta.y },
          }));
          const beforeNodeUpdates = Array.from(
            dragState.startNodePositions.entries(),
          ).map(([nodeId, start]) => {
            const current = graphSnapshot.nodes.get(nodeId)?.position ?? start;
            return {
              nodeId,
              position: { x: current.x, y: current.y },
            };
          });
          const afterNodeUpdates = Array.from(
            dragState.startNodePositions.entries(),
          ).map(([nodeId, start]) => ({
            nodeId,
            position: { x: start.x + delta.x, y: start.y + delta.y },
          }));
          applyGraphCommandTransient(
            createMoveNodesCommand(beforeNodeUpdates, afterNodeUpdates),
          );
          applyGraphCommandTransient(
            createMoveFramesCommand(beforeFrameUpdates, afterFrameUpdates),
          );
          return;
        }

        if (dragState.kind === "resize-frame") {
          setSocketTooltip(null);
          setHoveredNodeId(null);
          setHoveredFrameId(null);
          setHoveredWireId(null);
          const delta = {
            x: worldPoint.x - dragState.origin.x,
            y: worldPoint.y - dragState.origin.y,
          };
          const nextFrame = resizeFrame(
            dragState.startFrame,
            dragState.handle,
            delta,
          );
          applyGraphCommandTransient(
            createUpdateFrameCommand(dragState.startFrame, nextFrame),
          );
          return;
        }

        if (dragState.kind === "marquee") {
          setSocketTooltip(null);
          setHoveredNodeId(null);
          setHoveredFrameId(null);
          setHoveredWireId(null);
          dragState = { ...dragState, current: worldPoint };
          updateMarquee(marquee, dragState.origin, worldPoint);
          return;
        }

        if (dragState.kind === "wire") {
          if (applyWireAutoScroll(screenPoint)) {
            worldPoint = scene.screenToWorld(screenPoint);
            updatePointerPosition(worldPoint, event);
          }
          const hover = getWireDragHover(screenPoint, worldPoint, dragState);
          const targetPosition = hover.targetPosition ?? worldPoint;
          dragState = { ...dragState, current: targetPosition };
          updateGhostWire(
            ghostWire,
            dragState.anchorPosition,
            targetPosition,
            hover.status,
          );
          updateSocketHover(socketHover, hover.targetPosition, hover.status);
          if (hover.targetSocketId) {
            setSocketTooltip(
              buildSocketTooltip(hover.targetSocketId, screenPoint),
            );
          } else {
            setSocketTooltip(null);
          }
          setHoveredNodeId(null);
          setHoveredFrameId(null);
          setHoveredWireId(null);
          return;
        }

        if (dragState.kind === "pan") {
          setSocketTooltip(null);
          setHoveredNodeId(null);
          setHoveredFrameId(null);
          setHoveredWireId(null);
          const nextScreen = getScreenPoint(event);
          const prevWorld = scene.screenToWorld(dragState.lastScreen);
          const nextWorld = scene.screenToWorld(nextScreen);
          const baseDelta = {
            x: (prevWorld.x - nextWorld.x) * settingsSnapshot.panSensitivity,
            y: (prevWorld.y - nextWorld.y) * settingsSnapshot.panSensitivity,
          };
          const delta = {
            x: applyResponseCurve(baseDelta.x, settingsSnapshot.panCurve),
            y: applyResponseCurve(baseDelta.y, settingsSnapshot.panCurve),
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
            setHoveredFrameId(null);
            setHoveredWireId(null);
          } else if (hit.kind === "node") {
            setSocketTooltip(null);
            setHoveredNodeId(hit.nodeId);
            setHoveredFrameId(null);
            setHoveredWireId(null);
          } else if (hit.kind === "frame") {
            setSocketTooltip(null);
            setHoveredNodeId(null);
            setHoveredFrameId(hit.frameId);
            setHoveredWireId(null);
          } else if (hit.kind === "wire") {
            setSocketTooltip(null);
            setHoveredNodeId(null);
            setHoveredFrameId(null);
            setHoveredWireId(hit.wireId);
          } else {
            setSocketTooltip(null);
            setHoveredNodeId(null);
            setHoveredFrameId(null);
            setHoveredWireId(null);
          }
        }
      };

      const selectItemsInMarquee = (
        origin: Point,
        current: Point,
        additive: boolean,
      ): void => {
        const minX = Math.min(origin.x, current.x);
        const minY = Math.min(origin.y, current.y);
        const maxX = Math.max(origin.x, current.x);
        const maxY = Math.max(origin.y, current.y);
        const selectedNodeIds: NodeId[] = [];
        for (const node of graphSnapshot.nodes.values()) {
          const { width, height } = getNodeSize(node, layout);
          const nodeMinX = node.position.x;
          const nodeMinY = node.position.y;
          const nodeMaxX = node.position.x + width;
          const nodeMaxY = node.position.y + height;
          const contained =
            nodeMinX >= minX &&
            nodeMaxX <= maxX &&
            nodeMinY >= minY &&
            nodeMaxY <= maxY;
          if (contained) {
            selectedNodeIds.push(node.id);
          }
        }
        if (selectedNodeIds.length > 0) {
          const next = additive
            ? new Set(selectedNodesSnapshot)
            : new Set<NodeId>();
          for (const nodeId of selectedNodeIds) {
            next.add(nodeId);
          }
          setNodeSelection(next);
          return;
        }
        const selectedFrameIds: FrameId[] = [];
        for (const frame of graphSnapshot.frames.values()) {
          const frameMinX = frame.position.x;
          const frameMinY = frame.position.y;
          const frameMaxX = frame.position.x + frame.size.width;
          const frameMaxY = frame.position.y + frame.size.height;
          const contained =
            frameMinX >= minX &&
            frameMaxX <= maxX &&
            frameMinY >= minY &&
            frameMaxY <= maxY;
          if (contained) {
            selectedFrameIds.push(frame.id);
          }
        }
        if (selectedFrameIds.length > 0) {
          const next = additive
            ? new Set(selectedFramesSnapshot)
            : new Set<FrameId>();
          for (const frameId of selectedFrameIds) {
            next.add(frameId);
          }
          setFrameSelection(next);
          return;
        }
        if (!additive) {
          clearSelection();
        }
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
          selectItemsInMarquee(
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
          const hover = getWireDragHover(screenPoint, worldPoint, dragState);
          const grabbedWire = dragState.grabbedWire;
          if (hover.status === "valid" && hover.targetSocketId) {
            if (grabbedWire) {
              const isSameTarget =
                dragState.dragMode === "from-output"
                  ? hover.targetSocketId === grabbedWire.toSocketId
                  : hover.targetSocketId === grabbedWire.fromSocketId;
              if (isSameTarget) {
                applyGraphCommandTransient({
                  kind: "add-wire",
                  wire: grabbedWire,
                });
                dragState = { kind: "none" };
                return;
              }
              const addCommand: GraphCommand = {
                kind: "add-wire",
                wire: {
                  id: grabbedWire.id,
                  fromSocketId:
                    dragState.dragMode === "from-output"
                      ? dragState.anchorSocketId
                      : hover.targetSocketId,
                  toSocketId:
                    dragState.dragMode === "from-output"
                      ? hover.targetSocketId
                      : dragState.anchorSocketId,
                },
              };
              const added = applyGraphCommandTransient(addCommand);
              if (!added) {
                applyGraphCommandTransient({
                  kind: "add-wire",
                  wire: grabbedWire,
                });
                dragState = { kind: "none" };
                return;
              }
              beginHistoryBatch(
                dragState.dragMode === "from-output"
                  ? "rewire-input"
                  : "rewire-output",
              );
              recordGraphCommand({ kind: "remove-wire", wire: grabbedWire });
              recordGraphCommand(addCommand);
              commitHistoryBatch();
              refreshActiveOutput();
              setWireSelection(new Set([grabbedWire.id]));
              dragState = { kind: "none" };
              return;
            }
            const wireId = nextWireId();
            const connected = applyGraphCommand({
              kind: "add-wire",
              wire: {
                id: wireId,
                fromSocketId:
                  dragState.dragMode === "from-output"
                    ? dragState.anchorSocketId
                    : hover.targetSocketId,
                toSocketId:
                  dragState.dragMode === "from-output"
                    ? hover.targetSocketId
                    : dragState.anchorSocketId,
              },
            });
            if (connected) {
              setWireSelection(new Set([wireId]));
            }
            dragState = { kind: "none" };
            return;
          }
          if (
            hover.status === "invalid" &&
            hover.targetSocketId &&
            hover.reason
          ) {
            const fromSocketId =
              dragState.dragMode === "from-output"
                ? dragState.anchorSocketId
                : hover.targetSocketId;
            const toSocketId =
              dragState.dragMode === "from-output"
                ? hover.targetSocketId
                : dragState.anchorSocketId;
            recordConnectionAttempt(fromSocketId, toSocketId, hover.reason);
          }
          if (grabbedWire) {
            beginHistoryBatch("disconnect-wire");
            recordGraphCommand({ kind: "remove-wire", wire: grabbedWire });
            commitHistoryBatch();
            refreshActiveOutput();
            setWireSelection(new Set<WireId>());
          }
          dragState = { kind: "none" };
          return;
        }

        if (
          wireTapCandidate &&
          event.pointerId === wireTapCandidate.pointerId
        ) {
          const tap = wireTapCandidate;
          wireTapCandidate = null;
          if (!contextMenu()) {
            const hit = scene.hitTest(screenPoint);
            if (hit.kind === "wire" && hit.wireId === tap.wireId) {
              openWireInsertMenu(tap.screen, tap.client, tap.wireId);
            }
          }
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

        if (dragState.kind === "drag-frames") {
          const delta = getDragDelta(
            dragState.origin,
            worldPoint,
            dragState.bounds,
          );
          const beforeFrameUpdates = Array.from(
            dragState.startFramePositions.entries(),
          ).map(([frameId, start]) => ({
            frameId,
            position: { x: start.x, y: start.y },
          }));
          const afterFrameUpdates = Array.from(
            dragState.startFramePositions.entries(),
          ).map(([frameId, start]) => ({
            frameId,
            position: { x: start.x + delta.x, y: start.y + delta.y },
          }));
          const beforeNodeUpdates = Array.from(
            dragState.startNodePositions.entries(),
          ).map(([nodeId, start]) => ({
            nodeId,
            position: { x: start.x, y: start.y },
          }));
          const afterNodeUpdates = Array.from(
            dragState.startNodePositions.entries(),
          ).map(([nodeId, start]) => ({
            nodeId,
            position: { x: start.x + delta.x, y: start.y + delta.y },
          }));
          const frameCommand = createMoveFramesCommand(
            beforeFrameUpdates,
            afterFrameUpdates,
          );
          const nodeCommand = createMoveNodesCommand(
            beforeNodeUpdates,
            afterNodeUpdates,
          );
          beginHistoryBatch("move-frames");
          if (!isNoopCommand(nodeCommand)) {
            recordGraphCommand(nodeCommand);
          }
          if (!isNoopCommand(frameCommand)) {
            recordGraphCommand(frameCommand);
          }
          commitHistoryBatch();
          dragState = { kind: "none" };
          setSocketTooltip(null);
          return;
        }

        if (dragState.kind === "resize-frame") {
          const delta = {
            x: worldPoint.x - dragState.origin.x,
            y: worldPoint.y - dragState.origin.y,
          };
          const nextFrame = resizeFrame(
            dragState.startFrame,
            dragState.handle,
            delta,
          );
          const command = createUpdateFrameCommand(
            dragState.startFrame,
            nextFrame,
          );
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
          return;
        }
        if (hit.kind === "socket") {
          const socket = graphSnapshot.sockets.get(hit.socketId);
          if (socket) {
            openSocketLabelEditor(socket, screenPoint);
          }
          return;
        }
        if (hit.kind === "node") {
          const node = graphSnapshot.nodes.get(hit.nodeId);
          if (node?.type === SUBGRAPH_NODE_TYPE && onDiveIntoSubgraph) {
            onDiveIntoSubgraph(node.id);
          }
          return;
        }
        if (hit.kind === "frame") {
          const frame = graphSnapshot.frames.get(hit.frameId);
          if (!frame) {
            return;
          }
          const worldPoint = scene.screenToWorld(screenPoint);
          const localY = worldPoint.y - frame.position.y;
          if (localY >= 0 && localY <= FRAME_TITLE_BAR_HEIGHT) {
            openFrameTitleEditor(frame, screenPoint);
          }
        }
      };

      let keybindingSequence: KeybindingChord[] = [];
      let keybindingSequenceTimer: number | null = null;

      const clearKeybindingSequence = (): void => {
        keybindingSequence = [];
        if (keybindingSequenceTimer) {
          window.clearTimeout(keybindingSequenceTimer);
          keybindingSequenceTimer = null;
        }
      };

      const scheduleKeybindingSequenceReset = (): void => {
        if (keybindingSequenceTimer) {
          window.clearTimeout(keybindingSequenceTimer);
        }
        keybindingSequenceTimer = window.setTimeout(
          () => clearKeybindingSequence(),
          900,
        );
      };

      const resolveSequenceAction = (
        chord: KeybindingChord,
      ): {
        actionId: KeybindingActionId;
        sequence: KeybindingChord[];
      } | null => {
        const profile = getActiveKeybindingProfile(
          settingsSnapshot.keybindings,
        );
        const nextSequence = [...keybindingSequence, chord];
        const directMatch = resolveKeybindingSequence(nextSequence, profile);
        if (directMatch) {
          clearKeybindingSequence();
          return { actionId: directMatch, sequence: nextSequence };
        }
        if (isKeybindingSequencePrefix(nextSequence, profile)) {
          keybindingSequence = nextSequence;
          scheduleKeybindingSequenceReset();
          return null;
        }
        clearKeybindingSequence();
        const singleSequence = [chord];
        const singleMatch = resolveKeybindingSequence(singleSequence, profile);
        if (singleMatch) {
          return { actionId: singleMatch, sequence: singleSequence };
        }
        if (isKeybindingSequencePrefix(singleSequence, profile)) {
          keybindingSequence = singleSequence;
          scheduleKeybindingSequenceReset();
        }
        return null;
      };

      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.defaultPrevented) {
          return;
        }
        if (commandPaletteOpenSnapshot) {
          if (event.key === "Escape") {
            event.preventDefault();
            setCommandPaletteOpen(false);
            clearKeybindingSequence();
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
          clearKeyboardFocus();
          if (dragState.kind === "wire" && dragState.grabbedWire) {
            applyGraphCommandTransient({
              kind: "add-wire",
              wire: dragState.grabbedWire,
            });
          }
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
          clearKeybindingSequence();
          return;
        }

        if (isEditableTarget) {
          clearKeybindingSequence();
          return;
        }

        const chord = eventToKeybindingChord(event);
        if (!chord) {
          return;
        }
        const resolved = resolveSequenceAction(chord);
        if (!resolved) {
          return;
        }
        const action = resolved.actionId;
        const binding = serializeKeybindingSequence(resolved.sequence);
        if (binding) {
          publishKeybindingEvent({
            actionId: action,
            binding,
            sequence: resolved.sequence,
          });
        }

        const prevent = (): void => {
          event.preventDefault();
        };

        const handleSocketNavigation = (
          direction: "input" | "output" | "up" | "down",
        ): void => {
          const nodeId = focusedSocketId
            ? (graphSnapshot.sockets.get(focusedSocketId)?.nodeId ?? null)
            : getSingleSelectionId(selectedNodesSnapshot);
          if (!nodeId) {
            return;
          }
          if (direction === "input" || direction === "output") {
            focusFirstSocket(nodeId, direction);
            return;
          }
          const activeSocket = focusedSocketId
            ? graphSnapshot.sockets.get(focusedSocketId)
            : null;
          const column = activeSocket ? activeSocket.direction : "input";
          const delta = direction === "up" ? -1 : 1;
          moveSocketInColumn(nodeId, column, delta);
        };

        const handleActivate = (reverse: boolean): void => {
          if (keyboardFocus === "wire") {
            const wireId = getSingleSelectionId(selectedWiresSnapshot);
            const wire = wireId ? graphSnapshot.wires.get(wireId) : null;
            if (!wire) {
              return;
            }
            const anchor = wireFocusAnchorSocketId;
            let targetSocketId: SocketId | null = null;
            if (
              anchor &&
              (wire.fromSocketId === anchor || wire.toSocketId === anchor)
            ) {
              if (reverse) {
                targetSocketId = anchor;
              } else {
                targetSocketId =
                  wire.fromSocketId === anchor
                    ? wire.toSocketId
                    : wire.fromSocketId;
              }
            } else {
              targetSocketId = reverse ? wire.fromSocketId : wire.toSocketId;
            }
            const socket = targetSocketId
              ? graphSnapshot.sockets.get(targetSocketId)
              : null;
            if (socket) {
              focusNode(socket.nodeId);
            }
            return;
          }
          if (keyboardFocus === "socket" && focusedSocketId) {
            const socket = graphSnapshot.sockets.get(focusedSocketId);
            if (!socket) {
              return;
            }
            if (reverse) {
              focusNode(socket.nodeId);
              return;
            }
            const wires = getWiresForSocket(socket.id);
            if (wires.length > 0) {
              focusWire(wires[0].id, socket.id);
            }
            return;
          }
          const selectedNodeId = getSingleSelectionId(selectedNodesSnapshot);
          if (!selectedNodeId) {
            focusNextNode(1);
            return;
          }
          if (reverse) {
            return;
          }
          focusFirstSocket(selectedNodeId, "input");
        };

        switch (action) {
          case "menu.context":
            prevent();
            openKeyboardContextMenu();
            return;
          case "commandPalette.open":
            prevent();
            setCommandPaletteOpen(true);
            return;
          case "history.undo":
            prevent();
            undo();
            return;
          case "history.redo":
            prevent();
            redo();
            return;
          case "selection.toggleBypass":
            if (selectedNodesSnapshot.size > 0) {
              prevent();
              toggleBypassNodes(selectedNodesSnapshot);
            }
            return;
          case "selection.delete":
            prevent();
            deleteSelection();
            clearKeyboardFocus();
            return;
          case "view.frameSelection":
            prevent();
            if (selectedNodesSnapshot.size === 0) {
              frameNodes();
            } else {
              frameNodes(selectedNodesSnapshot);
            }
            return;
          case "view.frameAll":
            prevent();
            frameNodes();
            return;
          case "group.create":
            prevent();
            groupSelectionIntoFrame();
            return;
          case "group.ungroup":
            prevent();
            ungroupSelectedFrames();
            return;
          case "navigation.focusNext":
            prevent();
            if (keyboardFocus === "socket" && focusedSocketId) {
              const socket = graphSnapshot.sockets.get(focusedSocketId);
              if (socket) {
                moveSocketInColumn(socket.nodeId, socket.direction, 1);
              }
              return;
            }
            if (keyboardFocus === "wire") {
              moveWireFocus(1);
              return;
            }
            focusNextNode(1);
            return;
          case "navigation.focusPrev":
            prevent();
            if (keyboardFocus === "socket" && focusedSocketId) {
              const socket = graphSnapshot.sockets.get(focusedSocketId);
              if (socket) {
                moveSocketInColumn(socket.nodeId, socket.direction, -1);
              }
              return;
            }
            if (keyboardFocus === "wire") {
              moveWireFocus(-1);
              return;
            }
            focusNextNode(-1);
            return;
          case "navigation.activate":
            prevent();
            handleActivate(false);
            return;
          case "navigation.activateReverse":
            prevent();
            handleActivate(true);
            return;
          case "navigation.socketInput":
            prevent();
            handleSocketNavigation("input");
            return;
          case "navigation.socketOutput":
            prevent();
            handleSocketNavigation("output");
            return;
          case "navigation.socketUp":
            prevent();
            handleSocketNavigation("up");
            return;
          case "navigation.socketDown":
            prevent();
            handleSocketNavigation("down");
            return;
          case "navigation.nodeLeft":
            prevent();
            focusDirectionalNode("left");
            return;
          case "navigation.nodeRight":
            prevent();
            focusDirectionalNode("right");
            return;
          case "navigation.nodeUp":
            prevent();
            focusDirectionalNode("up");
            return;
          case "navigation.nodeDown":
            prevent();
            focusDirectionalNode("down");
            return;
          case "view.panUp":
          case "view.panDown":
          case "view.panLeft":
          case "view.panRight": {
            prevent();
            const baseStep = event.shiftKey ? 240 : 120;
            const zoom = scene?.getZoom() ?? 1;
            const step = baseStep / Math.max(zoom, 0.1);
            const delta =
              action === "view.panUp"
                ? { x: 0, y: -step }
                : action === "view.panDown"
                  ? { x: 0, y: step }
                  : action === "view.panLeft"
                    ? { x: -step, y: 0 }
                    : { x: step, y: 0 };
            panCanvasBy(delta);
            return;
          }
          case "view.zoomIn":
          case "view.zoomOut": {
            prevent();
            const factor = action === "view.zoomIn" ? 1.12 : 1 / 1.12;
            zoomCanvasBy(factor);
            return;
          }
          case "clipboard.copy": {
            prevent();
            const payload = buildClipboardPayload();
            if (payload) {
              void writeClipboardPayload(payload);
            }
            return;
          }
          case "clipboard.duplicate":
            prevent();
            duplicateSelection();
            return;
          case "clipboard.paste":
            prevent();
            void pasteClipboardPayload();
            return;
          default: {
            const _exhaustive: KeybindingActionId = action;
            void _exhaustive;
            return;
          }
        }
      };

      const onContextMenu = (event: MouseEvent): void => {
        if (!scene) {
          return;
        }
        event.preventDefault();
        clearLongPress();
        clearKeyboardFocus();
        const screenPoint = getScreenPoint(event);
        openContextMenu(screenPoint, { x: event.clientX, y: event.clientY });
      };

      const onPointerLeave = (): void => {
        if (contextMenu()) {
          setPointerPosition(null);
          clearLongPress();
          dragState = { kind: "none" };
          return;
        }
        if (dragState.kind === "wire" && dragState.grabbedWire) {
          applyGraphCommandTransient({
            kind: "add-wire",
            wire: dragState.grabbedWire,
          });
        }
        ghostWire.clear();
        ghostWire.visible = false;
        socketHover.clear();
        socketHover.visible = false;
        marquee.clear();
        marquee.visible = false;
        setSocketTooltip(null);
        setHoveredNodeId(null);
        setHoveredFrameId(null);
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
        const rawDelta = -event.deltaY * 0.001 * strength;
        const curvedDelta = applyResponseCurve(
          rawDelta,
          settingsSnapshot.zoomCurve,
        );
        const nextZoom = zoom * Math.exp(curvedDelta);
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
        app?.ticker.remove(onTick);
        app?.canvas.removeEventListener("pointerdown", onPointerDown);
        app?.canvas.removeEventListener("pointermove", onPointerMove);
        app?.canvas.removeEventListener("pointerup", onPointerUp);
        app?.canvas.removeEventListener("pointerleave", onPointerLeave);
        app?.canvas.removeEventListener("dblclick", onDoubleClick);
        app?.canvas.removeEventListener("contextmenu", onContextMenu);
        app?.canvas.removeEventListener("wheel", onWheel);
        window.removeEventListener("keydown", onKeyDown);
        mediaQuery?.removeEventListener("change", onSchemeChange);
        clearKeybindingSequence();
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
      unregisterTestApi?.();
    });
  });

  createEffect(() => {
    graphSnapshot = graph();
    dirtyStateSnapshot = dirtyState();
    selectedNodesSnapshot = selectedNodes();
    selectedFramesSnapshot = selectedFrames();
    selectedWiresSnapshot = selectedWires();
    bypassedNodesSnapshot = bypassedNodes();
    collapsedNodesSnapshot = collapsedNodes();
    settingsSnapshot = settings();
    execVisualizationSnapshot = execVisualization();
    commandPaletteOpenSnapshot = commandPaletteOpen();
    hoveredNodeIdSnapshot = hoveredNodeId();
    hoveredFrameIdSnapshot = hoveredFrameId();
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

  createEffect(() => {
    const wireId = hoveredWireId();
    const { wireHoverLabels } = settings();
    if (!wireId || !wireHoverLabels || !scene) {
      setWireTooltip(null);
      return;
    }
    const timer = window.setTimeout(() => {
      if (hoveredWireId() !== wireId || !settings().wireHoverLabels) {
        return;
      }
      setWireTooltip(buildWireTooltip(wireId));
    }, WIRE_TOOLTIP_DELAY_MS);
    onCleanup(() => {
      window.clearTimeout(timer);
    });
  });

  createEffect(() => {
    if (!textEdit()) {
      return;
    }
    if (textEditInput) {
      textEditInput.focus();
      textEditInput.select();
    }
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
      <Show when={socketTooltip()} keyed>
        {(tooltip) => (
          <div
            class="pointer-events-none absolute z-[var(--layer-canvas-overlay)] max-w-[240px] rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-panel-soft)] px-[0.6rem] py-[0.45rem] text-[0.72rem] leading-[1.35] text-[color:var(--text-soft)] shadow-[var(--shadow-toast)]"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
            }}
          >
            <div class="text-[0.75rem] font-semibold">{tooltip.title}</div>
            <div class="mt-[0.15rem] text-[color:var(--text-muted)]">
              {tooltip.typeLabel}
            </div>
            <div class="mt-[0.2rem] text-[color:var(--text-strong)]">
              {tooltip.valueLabel}
            </div>
            {tooltip.connectionLabel ? (
              <div class="mt-[0.2rem] text-[color:var(--text-muted)]">
                {tooltip.connectionLabel}
              </div>
            ) : null}
          </div>
        )}
      </Show>
      <Show when={wireTooltip()} keyed>
        {(tooltip) => (
          <div
            class="pointer-events-none absolute z-[var(--layer-canvas-overlay)] max-w-[240px] rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-panel-soft)] px-[0.6rem] py-[0.45rem] text-[0.72rem] leading-[1.35] text-[color:var(--text-soft)] shadow-[var(--shadow-toast)]"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
            }}
          >
            <div class="text-[0.75rem] font-semibold">{tooltip.title}</div>
            <div class="mt-[0.15rem] text-[color:var(--text-muted)]">
              {tooltip.typeLabel}
            </div>
            <div class="mt-[0.2rem] text-[color:var(--text-strong)]">
              {tooltip.valueLabel}
            </div>
          </div>
        )}
      </Show>
      <Show when={textEdit()} keyed>
        {(edit) => (
          <>
            <div
              class="absolute inset-0 z-[var(--layer-canvas-overlay)]"
              aria-hidden="true"
              onPointerDown={(event) => {
                event.stopPropagation();
                commitTextEdit(edit);
              }}
            />
            <form
              class="absolute z-[var(--layer-canvas-menu)] w-[260px] rounded-xl border border-[color:var(--border-muted)] bg-[color:var(--surface-panel-strong)] p-2 text-[0.75rem] text-[color:var(--text-strong)] shadow-[var(--shadow-panel)]"
              style={{
                left: `clamp(12px, ${edit.screen.x}px, calc(100% - 280px))`,
                top: `clamp(12px, ${edit.screen.y}px, calc(100% - 120px))`,
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onSubmit={(event) => {
                event.preventDefault();
                commitTextEdit(edit);
              }}
            >
              <div class="flex items-center gap-2">
                <input
                  ref={(el) => {
                    textEditInput = el;
                  }}
                  class="flex-1 rounded-lg border border-[color:var(--border-muted)] bg-[color:var(--surface-panel-soft)] px-2 py-1 text-[0.75rem] text-[color:var(--text-strong)] outline-none focus:border-[color:var(--border-strong)]"
                  value={textEditValue()}
                  aria-label={
                    edit.kind === "frame-title"
                      ? "Edit frame title"
                      : "Edit socket label"
                  }
                  onInput={(event) => {
                    setTextEditValue(event.currentTarget.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelTextEdit();
                    }
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitTextEdit(edit);
                    }
                  }}
                />
                <button
                  type="button"
                  class="rounded-lg border border-[color:var(--border-muted)] p-1 text-[color:var(--text-muted)] transition hover:text-[color:var(--text-strong)]"
                  aria-label="Clear text"
                  onClick={() => {
                    setTextEditValue("");
                  }}
                >
                  <X class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-[color:var(--border-muted)] p-1 text-[color:var(--text-muted)] transition hover:text-[color:var(--text-strong)]"
                  aria-label="Reset text"
                  onClick={() => {
                    setTextEditValue(edit.defaultValue);
                  }}
                >
                  <RotateCcw class="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </>
        )}
      </Show>
      {contextMenu() ? (
        <>
          <div
            class="absolute inset-0 z-[var(--layer-canvas-overlay)]"
            aria-hidden="true"
            onPointerDown={() => {
              setContextMenu(null);
            }}
          />
          <div
            class="absolute z-[var(--layer-canvas-menu)] min-w-[200px] rounded-xl border border-[color:var(--border-muted)] bg-[color:var(--surface-panel-strong)] p-2 text-[0.8rem] text-[color:var(--text-soft)] shadow-[var(--shadow-panel)]"
            data-testid="canvas-context-menu"
            style={{
              left: `clamp(12px, ${contextMenu()!.screen.x}px, calc(100% - 220px))`,
              top: `clamp(12px, ${contextMenu()!.screen.y}px, calc(100% - 220px))`,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            role="menu"
            aria-label="Canvas actions"
          >
            {buildContextMenuEntries(contextMenu()!).map((entry) =>
              entry.kind === "separator" ? (
                <div
                  class="my-1 h-px bg-[color:var(--border-subtle)]"
                  role="separator"
                />
              ) : (
                <button
                  class="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-[color:var(--surface-highlight)]"
                  data-testid={`canvas-menu-${toMenuTestId(entry.label)}`}
                  role="menuitem"
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
        </>
      ) : null}
    </div>
  );
}
