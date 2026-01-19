import type {
  DirtyState,
  ExecError,
  ExecEvaluationStats,
} from "@shadr/exec-engine";
import {
  createExecState,
  markDirty,
  markDirtyForParamChange,
} from "@shadr/exec-engine";
import type {
  FrameId,
  Graph,
  GraphEffect,
  GraphNode,
  GraphSocket,
  GraphWire,
  NodeId,
  SocketId,
  WireId,
} from "@shadr/graph-core";
import { createGraph } from "@shadr/graph-core";
import type { GraphDocumentV1, JsonObject, JsonValue } from "@shadr/shared";
import {
  GRAPH_DOCUMENT_V1_SCHEMA_VERSION,
  makeGraphId,
  makeNodeId,
  makeSocketId,
  makeSubgraphInputNodeType,
  makeWireId,
  SUBGRAPH_INPUT_SOCKET_KEY,
  SUBGRAPH_NODE_TYPE,
  type SubgraphInputMapping,
  type SubgraphNodeParams,
  type SubgraphOutputMapping,
} from "@shadr/shared";
import { Either } from "effect";
import type { Accessor } from "solid-js";
import { createSignal } from "solid-js";

import { CONVERSION_REGISTRY } from "~/editor/conversion-registry";
import type { DebugEvent } from "~/editor/debug-events";
import { resolveNodeDefinition } from "~/editor/exec";
import type { ExecDebugEntry, ExecDebugNodeError } from "~/editor/exec-debug";
import {
  createExecWorkerClient,
  type ExecWorkerProgress,
} from "~/editor/exec-worker-client";
import type { GraphCommand, HistoryEntry } from "~/editor/history";
import {
  applyCommandEffect,
  commandAffectsExecution,
  createRemoveNodeCommand,
  createUpdateParamCommand,
  getUndoCommands,
  isNoopCommand,
} from "~/editor/history";
import {
  createDefaultParams,
  getNodeCatalogEntry,
} from "~/editor/node-catalog";
import { isOutputNodeType } from "~/editor/output-artifacts";
import {
  DEFAULT_SETTINGS,
  type EditorSettings,
  snapPointToGrid,
} from "~/editor/settings";
import type { GraphBreadcrumb } from "~/editor/ui-state";
import type {
  ConnectionAttempt,
  ConnectionAttemptReason,
  ValidationWarning,
} from "~/editor/validation-warnings";
import { collectValidationWarnings } from "~/editor/validation-warnings";
import {
  evaluateSocketWithStatsEffect,
  markDirtyForWireChangeEffect,
} from "~/services/exec-service";
import { graphFromDocument } from "~/services/graph-service";
import { runAppEffectSyncEither } from "~/services/runtime";

type ExecStatsWindow = Window & { __SHADR_EXEC_STATS__?: ExecEvaluationStats };
type Point = Readonly<{ x: number; y: number }>;
type PointerPosition = Readonly<{ screen: Point; world: Point }>;
type ExecProgress = Readonly<{ completed: number; total: number }>;
export type ExecVisualizationEntry = Readonly<{
  nodeId: NodeId;
  nodeType: string;
  durationMs: number;
  cacheHit: boolean;
  order: number;
}>;
export type ExecVisualizationState = Readonly<{
  runId: number;
  active: boolean;
  totalMs: number;
  maxDurationMs: number;
  nodes: ReadonlyMap<NodeId, ExecVisualizationEntry>;
  timeline: ReadonlyArray<ExecVisualizationEntry>;
}>;
const MAX_EXEC_HISTORY = 50;
const MAX_CONNECTION_ATTEMPTS = 50;
const MAX_DEBUG_EVENTS = 200;
const MAX_WATCHED_SOCKETS = 50;

/* eslint-disable no-unused-vars */
export type EditorStore = Readonly<{
  graph: Accessor<Graph>;
  graphPath: Accessor<ReadonlyArray<GraphBreadcrumb>>;
  dirtyState: Accessor<DirtyState>;
  activeOutputSocketId: Accessor<SocketId | null>;
  outputValue: Accessor<JsonValue | null>;
  outputError: Accessor<ExecError | null>;
  outputProgress: Accessor<ExecProgress | null>;
  execHistory: Accessor<ReadonlyArray<ExecDebugEntry>>;
  execVisualization: Accessor<ExecVisualizationState | null>;
  debugEvents: Accessor<ReadonlyArray<DebugEvent>>;
  watchedSockets: Accessor<ReadonlyArray<SocketId>>;
  validationWarnings: Accessor<ReadonlyArray<ValidationWarning>>;
  selectedNodes: Accessor<ReadonlySet<NodeId>>;
  selectedFrames: Accessor<ReadonlySet<FrameId>>;
  selectedWires: Accessor<ReadonlySet<WireId>>;
  bypassedNodes: Accessor<ReadonlySet<NodeId>>;
  collapsedNodes: Accessor<ReadonlySet<NodeId>>;
  settings: Accessor<EditorSettings>;
  canvasCenter: Accessor<Point>;
  pointerPosition: Accessor<PointerPosition | null>;
  commandPaletteOpen: Accessor<boolean>;
  canUndo: Accessor<boolean>;
  canRedo: Accessor<boolean>;
  loadGraphDocument: (document: GraphDocumentV1) => boolean;
  updateNodeParam: (nodeId: NodeId, key: string, value: JsonValue) => boolean;
  requestOutput: (socketId: SocketId) => void;
  clearOutput: () => void;
  cancelOutputEvaluation: () => void;
  refreshActiveOutput: () => void;
  clearExecHistory: () => void;
  clearDebugEvents: () => void;
  clearSelection: () => void;
  setNodeSelection: (next: ReadonlySet<NodeId>) => void;
  setFrameSelection: (next: ReadonlySet<FrameId>) => void;
  setWireSelection: (next: ReadonlySet<WireId>) => void;
  toggleBypassNodes: (nodeIds: ReadonlySet<NodeId>) => void;
  toggleCollapsedNodes: (nodeIds: ReadonlySet<NodeId>) => void;
  setBypassedNodes: (next: ReadonlySet<NodeId>) => void;
  setCollapsedNodes: (next: ReadonlySet<NodeId>) => void;
  setCanvasCenter: (center: Point) => void;
  setPointerPosition: (position: PointerPosition | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSettings: (next: EditorSettings) => void;
  updateSettings: (patch: Partial<EditorSettings>) => void;
  setGraphPath: (path: ReadonlyArray<GraphBreadcrumb>) => void;
  addWatchedSocket: (socketId: SocketId) => void;
  removeWatchedSocket: (socketId: SocketId) => void;
  clearWatchedSockets: () => void;
  recordConnectionAttempt: (
    fromSocketId: SocketId,
    toSocketId: SocketId,
    reason: ConnectionAttemptReason,
  ) => void;
  addNodeAt: (nodeType: string, position?: Point) => NodeId | null;
  collapseSelectionToSubgraph: () => NodeId | null;
  applyGraphCommand: (command: GraphCommand) => boolean;
  applyGraphCommandTransient: (command: GraphCommand) => boolean;
  recordGraphCommand: (command: GraphCommand) => void;
  beginHistoryBatch: (label?: string) => void;
  commitHistoryBatch: () => void;
  undo: () => void;
  redo: () => void;
}>;
/* eslint-enable no-unused-vars */

export const createEditorStore = (): EditorStore => {
  const initialGraph = createGraph(makeGraphId("main"));
  const [graph, setGraph] = createSignal(initialGraph);
  const [graphPath, setGraphPath] = createSignal<
    ReadonlyArray<GraphBreadcrumb>
  >([{ id: initialGraph.graphId, label: "Main" }]);
  const [dirtyState, setDirtyState] = createSignal(createExecState(), {
    equals: false,
  });
  const [activeOutputSocketId, setActiveOutputSocketId] =
    createSignal<SocketId | null>(null);
  const [outputValue, setOutputValue] = createSignal<JsonValue | null>(null);
  const [outputError, setOutputError] = createSignal<ExecError | null>(null);
  const [outputProgress, setOutputProgress] = createSignal<ExecProgress | null>(
    null,
  );
  const [execHistory, setExecHistory] = createSignal<ExecDebugEntry[]>([], {
    equals: false,
  });
  const [execVisualization, setExecVisualization] =
    createSignal<ExecVisualizationState | null>(null, { equals: false });
  const [debugEvents, setDebugEvents] = createSignal<DebugEvent[]>([], {
    equals: false,
  });
  const [watchedSockets, setWatchedSockets] = createSignal<SocketId[]>([], {
    equals: false,
  });
  const [validationWarnings, setValidationWarnings] = createSignal<
    ReadonlyArray<ValidationWarning>
  >([], { equals: false });
  const execWorker =
    typeof window !== "undefined" && typeof Worker !== "undefined"
      ? createExecWorkerClient()
      : null;
  let evaluationToken = 0;
  const [selectedNodes, setSelectedNodes] = createSignal<ReadonlySet<NodeId>>(
    new Set(),
  );
  const [selectedFrames, setSelectedFrames] = createSignal<
    ReadonlySet<FrameId>
  >(new Set());
  const [selectedWires, setSelectedWires] = createSignal<ReadonlySet<WireId>>(
    new Set(),
  );
  const [bypassedNodes, setBypassedNodes] = createSignal<ReadonlySet<NodeId>>(
    new Set(),
  );
  const [collapsedNodes, setCollapsedNodes] = createSignal<ReadonlySet<NodeId>>(
    new Set(),
  );
  const [settings, setSettingsState] =
    createSignal<EditorSettings>(DEFAULT_SETTINGS);
  const [canvasCenter, setCanvasCenter] = createSignal<Point>({ x: 0, y: 0 });
  const [pointerPosition, setPointerPosition] =
    createSignal<PointerPosition | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] =
    createSignal<boolean>(false);
  const [historyState, setHistoryState] = createSignal({
    undo: 0,
    redo: 0,
  });
  const [connectionAttempts, setConnectionAttempts] = createSignal<
    ReadonlyArray<ConnectionAttempt>
  >([], { equals: false });
  let undoStack: HistoryEntry[] = [];
  let redoStack: HistoryEntry[] = [];
  let openBatch: HistoryEntry | null = null;
  let nodeCounter = 1;
  let execHistoryCounter = 1;
  let connectionAttemptCounter = 1;
  let debugEventCounter = 1;

  const nextNodeCounterForGraph = (nextGraph: Graph): number => {
    let max = 0;
    for (const nodeId of nextGraph.nodes.keys()) {
      const match = /^node-(\d+)$/u.exec(nodeId);
      if (!match) {
        continue;
      }
      const value = Number(match[1]);
      if (Number.isFinite(value)) {
        max = Math.max(max, value);
      }
    }
    return max + 1;
  };

  const buildValidationWarnings = (
    graphSnapshot: Graph,
    attempts: ReadonlyArray<ConnectionAttempt>,
  ): ReadonlyArray<ValidationWarning> =>
    collectValidationWarnings(graphSnapshot, attempts, {
      conversionRegistry: CONVERSION_REGISTRY,
      isOutputNodeType,
    });

  const refreshValidationWarnings = (
    graphSnapshot: Graph,
    attempts: ReadonlyArray<ConnectionAttempt> = connectionAttempts(),
  ): void => {
    setValidationWarnings(buildValidationWarnings(graphSnapshot, attempts));
  };

  const resetGraphState = (nextGraph: Graph): void => {
    setGraph(nextGraph);
    setGraphPath([{ id: nextGraph.graphId, label: "Main" }]);
    setDirtyState(createExecState());
    setActiveOutputSocketId(null);
    setOutputValue(null);
    setOutputError(null);
    setExecHistory([]);
    setExecVisualization(null);
    setDebugEvents([]);
    setWatchedSockets([]);
    setSelectedNodes(new Set());
    setSelectedFrames(new Set());
    setSelectedWires(new Set());
    setBypassedNodes(new Set());
    setCollapsedNodes(new Set());
    setPointerPosition(null);
    setConnectionAttempts([]);
    nodeCounter = nextNodeCounterForGraph(nextGraph);
    execHistoryCounter = 1;
    connectionAttemptCounter = 1;
    debugEventCounter = 1;
    undoStack = [];
    redoStack = [];
    openBatch = null;
    setHistoryState({ undo: 0, redo: 0 });
    refreshValidationWarnings(nextGraph, []);
  };

  const collectNodeErrors = (state: DirtyState): ExecDebugNodeError[] => {
    const entries: ExecDebugNodeError[] = [];
    for (const [nodeId, errors] of state.nodeErrors.entries()) {
      if (errors.length === 0) {
        continue;
      }
      entries.push({
        nodeId,
        tags: errors.map((error) => error._tag),
      });
    }
    entries.sort((left, right) => left.nodeId.localeCompare(right.nodeId));
    return entries;
  };

  const recordExecHistory = (entry: Omit<ExecDebugEntry, "id">): void => {
    const resolved: ExecDebugEntry = {
      id: execHistoryCounter,
      ...entry,
    };
    execHistoryCounter += 1;
    setExecHistory((current) => {
      const next = [resolved, ...current];
      return next.length > MAX_EXEC_HISTORY
        ? next.slice(0, MAX_EXEC_HISTORY)
        : next;
    });
  };

  const recordDebugEvent = (entry: Omit<DebugEvent, "id">): void => {
    const resolved: DebugEvent = {
      id: debugEventCounter,
      ...entry,
    };
    debugEventCounter += 1;
    setDebugEvents((current) => {
      const next = [resolved, ...current];
      return next.length > MAX_DEBUG_EVENTS
        ? next.slice(0, MAX_DEBUG_EVENTS)
        : next;
    });
  };

  const pruneWatchedSockets = (graphSnapshot: Graph): void => {
    setWatchedSockets((current) =>
      current.filter((socketId) => graphSnapshot.sockets.has(socketId)),
    );
  };

  const formatGraphCommandEvent = (
    command: GraphCommand,
  ): Omit<DebugEvent, "id"> => {
    const timestamp = Date.now();
    switch (command.kind) {
      case "add-node":
        return {
          timestamp,
          kind: "graph",
          label: "Node added",
          detail: `${command.node.type} (${command.node.id})`,
        };
      case "remove-node":
        return {
          timestamp,
          kind: "graph",
          label: "Node removed",
          detail: `${command.node.type} (${command.node.id})`,
        };
      case "add-frame":
        return {
          timestamp,
          kind: "graph",
          label: "Frame added",
          detail: `${command.frame.title} (${command.frame.id})`,
        };
      case "remove-frame":
        return {
          timestamp,
          kind: "graph",
          label: "Frame removed",
          detail: `${command.frame.title} (${command.frame.id})`,
        };
      case "add-wire":
        return {
          timestamp,
          kind: "graph",
          label: "Wire connected",
          detail: `${command.wire.fromSocketId} -> ${command.wire.toSocketId}`,
        };
      case "remove-wire":
        return {
          timestamp,
          kind: "graph",
          label: "Wire disconnected",
          detail: `${command.wire.fromSocketId} -> ${command.wire.toSocketId}`,
        };
      case "move-nodes":
        return {
          timestamp,
          kind: "graph",
          label: "Nodes moved",
          detail: `${command.after.length} node(s)`,
        };
      case "move-frames":
        return {
          timestamp,
          kind: "graph",
          label: "Frames moved",
          detail: `${command.after.length} frame(s)`,
        };
      case "update-frame":
        return {
          timestamp,
          kind: "graph",
          label: "Frame updated",
          detail: `${command.after.title} (${command.after.id})`,
        };
      case "update-param":
        return {
          timestamp,
          kind: "graph",
          label: "Param updated",
          detail: `${command.nodeId}.${command.key}`,
        };
      case "update-node-io":
        return {
          timestamp,
          kind: "graph",
          label: "Node IO updated",
          detail: `${command.after.node.type} (${command.after.node.id})`,
        };
      case "replace-node-io":
        return {
          timestamp,
          kind: "graph",
          label: "Node IO replaced",
          detail: `${command.after.node.type} (${command.after.node.id})`,
        };
    }
  };

  const runGraphEffect = (effect: GraphEffect<Graph>): Graph | null => {
    const result = runAppEffectSyncEither(effect);
    if (Either.isLeft(result)) {
      console.warn("Graph update failed", result.left);
      return null;
    }
    setGraph(result.right);
    refreshValidationWarnings(result.right);
    pruneWatchedSockets(result.right);
    return result.right;
  };

  const recordConnectionAttempt = (
    fromSocketId: SocketId,
    toSocketId: SocketId,
    reason: ConnectionAttemptReason,
  ): void => {
    const graphSnapshot = graph();
    const fromSocket = graphSnapshot.sockets.get(fromSocketId);
    const toSocket = graphSnapshot.sockets.get(toSocketId);
    const attempt: ConnectionAttempt = {
      id: connectionAttemptCounter,
      timestamp: Date.now(),
      fromSocketId,
      toSocketId,
      ...(fromSocket ? { fromType: fromSocket.dataType } : {}),
      ...(toSocket ? { toType: toSocket.dataType } : {}),
      reason,
    };
    connectionAttemptCounter += 1;
    const nextAttempts = [attempt, ...connectionAttempts()];
    const trimmed =
      nextAttempts.length > MAX_CONNECTION_ATTEMPTS
        ? nextAttempts.slice(0, MAX_CONNECTION_ATTEMPTS)
        : nextAttempts;
    setConnectionAttempts(trimmed);
    setValidationWarnings(buildValidationWarnings(graphSnapshot, trimmed));
  };

  const recordHistoryEntry = (entry: HistoryEntry): void => {
    if (openBatch) {
      openBatch = {
        label: openBatch.label,
        commands: [...openBatch.commands, ...entry.commands],
      };
      return;
    }
    undoStack = [...undoStack, entry];
    redoStack = [];
    setHistoryState({ undo: undoStack.length, redo: redoStack.length });
  };

  const recordCommand = (command: GraphCommand): void => {
    if (isNoopCommand(command)) {
      return;
    }
    recordHistoryEntry({ commands: [command] });
  };

  const beginHistoryBatch = (label?: string): void => {
    if (openBatch) {
      return;
    }
    redoStack = [];
    openBatch = { label, commands: [] };
    setHistoryState({ undo: undoStack.length, redo: redoStack.length });
  };

  const commitHistoryBatch = (): void => {
    if (!openBatch) {
      return;
    }
    const batch = openBatch;
    openBatch = null;
    if (batch.commands.length === 0) {
      return;
    }
    undoStack = [...undoStack, batch];
    redoStack = [];
    setHistoryState({ undo: undoStack.length, redo: redoStack.length });
  };

  const markDirtyForWireChangeGraph = (
    graphState: Graph,
    wireId: WireId,
  ): void => {
    const result = runAppEffectSyncEither(
      markDirtyForWireChangeEffect(graphState, dirtyState(), wireId),
    );
    if (Either.isLeft(result)) {
      console.warn("Wire dirty propagation failed", result.left);
      return;
    }
    setDirtyState(result.right);
  };

  const applyGraphCommandInternal = (
    command: GraphCommand,
    options: Readonly<{ record: boolean; refresh: boolean }>,
  ): boolean => {
    if (isNoopCommand(command)) {
      return false;
    }
    if (command.kind === "remove-node") {
      markDirtyForNodeChange(command.node.id);
      setBypassedNodes((current) => {
        if (!current.has(command.node.id)) {
          return current;
        }
        const next = new Set(current);
        next.delete(command.node.id);
        return next;
      });
      setCollapsedNodes((current) => {
        if (!current.has(command.node.id)) {
          return current;
        }
        const next = new Set(current);
        next.delete(command.node.id);
        return next;
      });
    }
    if (command.kind === "remove-wire") {
      markDirtyForWireChangeGraph(graph(), command.wire.id);
    }
    if (command.kind === "update-node-io") {
      markDirtyForNodeChange(command.after.node.id);
    }
    if (command.kind === "replace-node-io") {
      markDirtyForNodeChange(command.after.node.id);
    }
    const nextGraph = runGraphEffect(applyCommandEffect(graph(), command));
    if (!nextGraph) {
      return false;
    }
    if (command.kind === "add-wire") {
      markDirtyForWireChangeGraph(nextGraph, command.wire.id);
    }
    if (command.kind === "update-param") {
      setDirtyState((state) =>
        markDirtyForParamChange(nextGraph, state, command.nodeId),
      );
    }
    if (options.record) {
      recordCommand(command);
    }
    if (options.refresh && commandAffectsExecution(command)) {
      refreshActiveOutput();
    }
    recordDebugEvent(formatGraphCommandEvent(command));
    return true;
  };

  const loadGraphDocument = (document: GraphDocumentV1): boolean => {
    const result = runAppEffectSyncEither(graphFromDocument(document));
    if (Either.isLeft(result)) {
      console.warn("Graph load failed", result.left);
      return false;
    }
    resetGraphState(result.right);
    recordDebugEvent({
      timestamp: Date.now(),
      kind: "system",
      label: "Graph loaded",
      detail: result.right.graphId,
    });
    return true;
  };

  const buildExecVisualization = (
    runId: number,
    stats: ExecEvaluationStats,
  ): ExecVisualizationState => {
    const nodes = new Map<NodeId, ExecVisualizationEntry>();
    const timeline: ExecVisualizationEntry[] = [];
    let maxDurationMs = 0;
    stats.nodeTimings.forEach((timing, index) => {
      const entry: ExecVisualizationEntry = {
        nodeId: timing.nodeId,
        nodeType: timing.nodeType,
        durationMs: timing.durationMs,
        cacheHit: timing.cacheHit,
        order: index + 1,
      };
      timeline.push(entry);
      nodes.set(entry.nodeId, entry);
      maxDurationMs = Math.max(maxDurationMs, timing.durationMs);
    });
    const safeMaxDurationMs = Math.max(1, maxDurationMs);
    return {
      runId,
      active: false,
      totalMs: stats.totalMs,
      maxDurationMs: safeMaxDurationMs,
      nodes,
      timeline,
    };
  };

  const applyExecProgress = (
    current: ExecVisualizationState | null,
    runId: number,
    progress: ExecWorkerProgress,
  ): ExecVisualizationState | null => {
    if (!current || current.runId !== runId) {
      return current;
    }
    if (!progress.nodeId || !progress.nodeType) {
      return current;
    }
    if (current.nodes.has(progress.nodeId)) {
      return current;
    }
    const durationMs =
      typeof progress.durationMs === "number" ? progress.durationMs : 0;
    const cacheHit = progress.cacheHit === true;
    const entry: ExecVisualizationEntry = {
      nodeId: progress.nodeId,
      nodeType: progress.nodeType,
      durationMs,
      cacheHit,
      order: current.timeline.length + 1,
    };
    const nodes = new Map(current.nodes);
    nodes.set(entry.nodeId, entry);
    const nextMaxDurationMs = Math.max(
      1,
      Math.max(current.maxDurationMs, durationMs),
    );
    return {
      ...current,
      nodes,
      timeline: [...current.timeline, entry],
      maxDurationMs: nextMaxDurationMs,
    };
  };

  const evaluateOutputSocket = (socketId: SocketId): void => {
    evaluationToken += 1;
    const runId = evaluationToken;
    if (execWorker) {
      execWorker.cancel();
      setOutputProgress(null);
      if (settings().executionVizEnabled) {
        setExecVisualization({
          runId,
          active: true,
          totalMs: 0,
          maxDurationMs: 1,
          nodes: new Map(),
          timeline: [],
        });
      } else {
        setExecVisualization(null);
      }
      execWorker
        .evaluate(graph(), socketId, dirtyState(), (progress) => {
          if (runId !== evaluationToken) {
            return;
          }
          setOutputProgress({
            completed: progress.completed,
            total: progress.total,
          });
          if (settings().executionVizEnabled) {
            setExecVisualization((current) =>
              applyExecProgress(current, runId, progress),
            );
          }
        })
        .then(({ result, execState }) => {
          if (runId !== evaluationToken) {
            return;
          }
          const timestamp = Date.now();
          const outputSocketId = socketId;
          setOutputError(null);
          setOutputValue(result.value);
          if (typeof window !== "undefined") {
            const target = window as ExecStatsWindow;
            target.__SHADR_EXEC_STATS__ = result.stats;
          }
          if (settings().executionVizEnabled) {
            setExecVisualization(buildExecVisualization(runId, result.stats));
          } else {
            setExecVisualization(null);
          }
          recordExecHistory({
            timestamp,
            outputSocketId,
            status: "success",
            stats: result.stats,
            nodeErrors: collectNodeErrors(execState),
          });
          setDirtyState(execState);
        })
        .catch((error: ExecError) => {
          if (runId !== evaluationToken) {
            return;
          }
          const timestamp = Date.now();
          const outputSocketId = socketId;
          console.warn("Output evaluation failed", error);
          setOutputError(error);
          setOutputValue(null);
          setExecVisualization(null);
          recordExecHistory({
            timestamp,
            outputSocketId,
            status: "error",
            error,
          });
        })
        .finally(() => {
          if (runId === evaluationToken) {
            setOutputProgress(null);
          }
        });
      return;
    }

    const result = runAppEffectSyncEither(
      evaluateSocketWithStatsEffect(
        graph(),
        socketId,
        resolveNodeDefinition,
        dirtyState(),
      ),
    );
    const timestamp = Date.now();
    const outputSocketId = socketId;
    if (Either.isLeft(result)) {
      console.warn("Output evaluation failed", result.left);
      setOutputError(result.left);
      setOutputValue(null);
      setExecVisualization(null);
      recordExecHistory({
        timestamp,
        outputSocketId,
        status: "error",
        error: result.left,
      });
    } else {
      setOutputError(null);
      setOutputValue(result.right.value);
      if (typeof window !== "undefined") {
        const target = window as ExecStatsWindow;
        target.__SHADR_EXEC_STATS__ = result.right.stats;
      }
      if (settings().executionVizEnabled) {
        setExecVisualization(buildExecVisualization(runId, result.right.stats));
      } else {
        setExecVisualization(null);
      }
      recordExecHistory({
        timestamp,
        outputSocketId,
        status: "success",
        stats: result.right.stats,
        nodeErrors: collectNodeErrors(dirtyState()),
      });
    }
    setDirtyState(dirtyState());
    setOutputProgress(null);
  };

  const updateNodeParam = (
    nodeId: NodeId,
    key: string,
    value: JsonValue,
  ): boolean => {
    const node = graph().nodes.get(nodeId);
    if (!node) {
      console.warn("Param update failed: missing node", nodeId);
      return false;
    }
    const before = node.params[key] ?? null;
    const command = createUpdateParamCommand(nodeId, key, before, value);
    return applyGraphCommandInternal(command, {
      record: true,
      refresh: true,
    });
  };

  const cancelOutputEvaluationInternal = (notify: boolean): void => {
    if (!execWorker) {
      return;
    }
    evaluationToken += 1;
    execWorker.cancel();
    setOutputProgress(null);
    setExecVisualization(null);
    if (notify) {
      setOutputError({ _tag: "ExecutionCanceled" });
      setOutputValue(null);
    }
  };

  const cancelOutputEvaluation = (): void => {
    cancelOutputEvaluationInternal(true);
  };

  const requestOutput = (socketId: SocketId): void => {
    setActiveOutputSocketId(socketId);
    evaluateOutputSocket(socketId);
    recordDebugEvent({
      timestamp: Date.now(),
      kind: "execution",
      label: "Output requested",
      detail: socketId,
    });
  };

  const clearOutput = (): void => {
    cancelOutputEvaluationInternal(false);
    setActiveOutputSocketId(null);
    setOutputValue(null);
    setOutputError(null);
    recordDebugEvent({
      timestamp: Date.now(),
      kind: "execution",
      label: "Output cleared",
    });
  };

  const refreshActiveOutput = (): void => {
    const socketId = activeOutputSocketId();
    if (socketId) {
      evaluateOutputSocket(socketId);
      recordDebugEvent({
        timestamp: Date.now(),
        kind: "execution",
        label: "Output refreshed",
        detail: socketId,
      });
    }
  };

  const clearExecHistory = (): void => {
    setExecHistory([]);
  };

  const clearDebugEvents = (): void => {
    setDebugEvents([]);
    debugEventCounter = 1;
  };

  const addWatchedSocket = (socketId: SocketId): void => {
    if (!graph().sockets.has(socketId)) {
      return;
    }
    setWatchedSockets((current) => {
      if (current.includes(socketId)) {
        return current;
      }
      const next = [socketId, ...current];
      return next.length > MAX_WATCHED_SOCKETS
        ? next.slice(0, MAX_WATCHED_SOCKETS)
        : next;
    });
    recordDebugEvent({
      timestamp: Date.now(),
      kind: "watch",
      label: "Socket watched",
      detail: socketId,
    });
  };

  const removeWatchedSocket = (socketId: SocketId): void => {
    setWatchedSockets((current) =>
      current.filter((entry) => entry !== socketId),
    );
    recordDebugEvent({
      timestamp: Date.now(),
      kind: "watch",
      label: "Socket unwatch",
      detail: socketId,
    });
  };

  const clearWatchedSockets = (): void => {
    setWatchedSockets([]);
    recordDebugEvent({
      timestamp: Date.now(),
      kind: "watch",
      label: "Watch list cleared",
    });
  };

  const markDirtyForNodeChange = (nodeId: NodeId): void => {
    setDirtyState((state) => markDirty(graph(), state, nodeId));
  };

  const clearSelection = (): void => {
    setSelectedNodes(new Set());
    setSelectedFrames(new Set());
    setSelectedWires(new Set());
    recordDebugEvent({
      timestamp: Date.now(),
      kind: "selection",
      label: "Selection cleared",
    });
  };

  const setNodeSelection = (next: ReadonlySet<NodeId>): void => {
    setSelectedNodes(new Set(next));
    setSelectedFrames(new Set());
    setSelectedWires(new Set());
    recordDebugEvent({
      timestamp: Date.now(),
      kind: "selection",
      label: "Node selection",
      detail: `${next.size} nodes`,
    });
  };

  const setFrameSelection = (next: ReadonlySet<FrameId>): void => {
    setSelectedFrames(new Set(next));
    setSelectedNodes(new Set());
    setSelectedWires(new Set());
    recordDebugEvent({
      timestamp: Date.now(),
      kind: "selection",
      label: "Frame selection",
      detail: `${next.size} frames`,
    });
  };

  const setWireSelection = (next: ReadonlySet<WireId>): void => {
    setSelectedWires(new Set(next));
    setSelectedNodes(new Set());
    setSelectedFrames(new Set());
    recordDebugEvent({
      timestamp: Date.now(),
      kind: "selection",
      label: "Wire selection",
      detail: `${next.size} wires`,
    });
  };

  const toggleBypassNodes = (nodeIds: ReadonlySet<NodeId>): void => {
    if (nodeIds.size === 0) {
      return;
    }
    setBypassedNodes((current) => {
      const next = new Set(current);
      for (const nodeId of nodeIds) {
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
      }
      return next;
    });
  };

  const setBypassedNodesState = (next: ReadonlySet<NodeId>): void => {
    setBypassedNodes(new Set(next));
  };

  const toggleCollapsedNodes = (nodeIds: ReadonlySet<NodeId>): void => {
    if (nodeIds.size === 0) {
      return;
    }
    setCollapsedNodes((current) => {
      const next = new Set(current);
      for (const nodeId of nodeIds) {
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
      }
      return next;
    });
  };

  const setCollapsedNodesState = (next: ReadonlySet<NodeId>): void => {
    setCollapsedNodes(new Set(next));
  };

  const createSocketsForNode = (
    nodeId: NodeId,
    definition: ReturnType<typeof resolveNodeDefinition>,
  ): {
    sockets: GraphSocket[];
    inputIds: SocketId[];
    outputIds: SocketId[];
  } => {
    if (!definition) {
      return { sockets: [], inputIds: [], outputIds: [] };
    }
    const sockets: GraphSocket[] = [];
    const inputIds: SocketId[] = [];
    const outputIds: SocketId[] = [];
    for (const input of definition.inputs) {
      const socketId = makeSocketId(`${nodeId}.${input.key}`);
      inputIds.push(socketId);
      sockets.push({
        id: socketId,
        nodeId,
        name: input.key,
        label: input.label,
        direction: "input",
        dataType: input.dataType,
        required: input.isOptional ? false : true,
        minConnections: input.minConnections,
        maxConnections: input.maxConnections ?? 1,
        labelSettings: input.labelSettings,
        metadata: input.metadata,
      });
    }
    for (const output of definition.outputs) {
      const socketId = makeSocketId(`${nodeId}.${output.key}`);
      outputIds.push(socketId);
      sockets.push({
        id: socketId,
        nodeId,
        name: output.key,
        label: output.label,
        direction: "output",
        dataType: output.dataType,
        required: false,
        minConnections: output.minConnections,
        maxConnections: output.maxConnections,
        labelSettings: output.labelSettings,
        metadata: output.metadata,
      });
    }
    return { sockets, inputIds, outputIds };
  };

  const addNodeAt = (nodeType: string, position?: Point): NodeId | null => {
    const definition = resolveNodeDefinition(nodeType);
    if (!definition) {
      console.warn("Node creation failed: missing definition", nodeType);
      return null;
    }
    const basePosition = position ?? canvasCenter();
    const nextPosition = settings().snapToGrid
      ? snapPointToGrid(basePosition)
      : basePosition;
    let nextId = makeNodeId(`node-${nodeCounter}`);
    while (graph().nodes.has(nextId)) {
      nodeCounter += 1;
      nextId = makeNodeId(`node-${nodeCounter}`);
    }
    nodeCounter += 1;
    const catalogEntry = getNodeCatalogEntry(definition.typeId);
    const params = createDefaultParams(catalogEntry?.paramSchema);
    const { sockets, inputIds, outputIds } = createSocketsForNode(
      nextId,
      definition,
    );
    const node = {
      id: nextId,
      type: definition.typeId,
      position: nextPosition,
      params,
      inputs: inputIds,
      outputs: outputIds,
    };
    if (applyGraphCommand({ kind: "add-node", node, sockets })) {
      setNodeSelection(new Set([nextId]));
      return nextId;
    }
    return null;
  };

  const applyGraphCommand = (command: GraphCommand): boolean =>
    applyGraphCommandInternal(command, { record: true, refresh: true });

  const applyGraphCommandTransient = (command: GraphCommand): boolean =>
    applyGraphCommandInternal(command, { record: false, refresh: false });

  const recordGraphCommand = (command: GraphCommand): void => {
    recordCommand(command);
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

  const collapseSelectionToSubgraph = (): NodeId | null => {
    const graphSnapshot = graph();
    const selection = selectedNodes();
    if (selection.size === 0) {
      return null;
    }

    const selectedNodesList: GraphNode[] = [];
    for (const nodeId of selection) {
      const node = graphSnapshot.nodes.get(nodeId);
      if (!node) {
        return null;
      }
      selectedNodesList.push(node);
    }

    const selectedNodeIds = new Set<NodeId>(
      selectedNodesList.map((node) => node.id),
    );

    const selectedSockets: GraphSocket[] = [];
    for (const node of selectedNodesList) {
      for (const socketId of [...node.inputs, ...node.outputs]) {
        const socket = graphSnapshot.sockets.get(socketId);
        if (!socket) {
          return null;
        }
        selectedSockets.push(socket);
      }
    }

    const internalWires: GraphWire[] = [];
    const boundaryInputs: Array<{
      fromSocket: GraphSocket;
      toSocket: GraphSocket;
    }> = [];
    const boundaryOutputs: Array<{
      fromSocket: GraphSocket;
      toSocket: GraphSocket;
    }> = [];

    for (const wire of graphSnapshot.wires.values()) {
      const fromSocket = graphSnapshot.sockets.get(wire.fromSocketId);
      const toSocket = graphSnapshot.sockets.get(wire.toSocketId);
      if (!fromSocket || !toSocket) {
        return null;
      }
      const fromInside = selectedNodeIds.has(fromSocket.nodeId);
      const toInside = selectedNodeIds.has(toSocket.nodeId);
      if (fromInside && toInside) {
        internalWires.push(wire);
      } else if (!fromInside && toInside) {
        boundaryInputs.push({ fromSocket, toSocket });
      } else if (fromInside && !toInside) {
        boundaryOutputs.push({ fromSocket, toSocket });
      }
    }

    const usedInputNames = new Set<string>();
    const usedOutputNames = new Set<string>();
    const makeUniqueName = (base: string, used: Set<string>): string => {
      const root = base.trim().length > 0 ? base.trim() : "socket";
      let candidate = root;
      let index = 1;
      while (used.has(candidate)) {
        candidate = `${root}-${index}`;
        index += 1;
      }
      used.add(candidate);
      return candidate;
    };
    const getNodeLabel = (node: GraphNode): string =>
      getNodeCatalogEntry(node.type)?.label ?? node.type;

    const usedInternalNodeIds = new Set<NodeId>(selectedNodeIds);
    const nextInternalNodeId = (() => {
      let index = 1;
      return () => {
        let candidate = makeNodeId(`subgraph-input-${index}`);
        while (usedInternalNodeIds.has(candidate)) {
          index += 1;
          candidate = makeNodeId(`subgraph-input-${index}`);
        }
        usedInternalNodeIds.add(candidate);
        index += 1;
        return candidate;
      };
    })();

    const usedInternalWireIds = new Set<WireId>(
      internalWires.map((wire) => wire.id),
    );
    const nextInternalWireId = (() => {
      let index = 1;
      return () => {
        let candidate = makeWireId(`subgraph-wire-${index}`);
        while (usedInternalWireIds.has(candidate)) {
          index += 1;
          candidate = makeWireId(`subgraph-wire-${index}`);
        }
        usedInternalWireIds.add(candidate);
        index += 1;
        return candidate;
      };
    })();

    const usedWireIds = new Set<WireId>(graphSnapshot.wires.keys());
    const nextOuterWireId = (() => {
      let index = 1;
      return () => {
        let candidate = makeWireId(`wire-${index}`);
        while (usedWireIds.has(candidate)) {
          index += 1;
          candidate = makeWireId(`wire-${index}`);
        }
        usedWireIds.add(candidate);
        index += 1;
        return candidate;
      };
    })();

    let subgraphNodeId = makeNodeId(`node-${nodeCounter}`);
    while (graphSnapshot.nodes.has(subgraphNodeId)) {
      nodeCounter += 1;
      subgraphNodeId = makeNodeId(`node-${nodeCounter}`);
    }
    nodeCounter += 1;

    const internalNodes: GraphNode[] = [...selectedNodesList];
    const internalSockets: GraphSocket[] = [...selectedSockets];
    const internalWiresWithInputs: GraphWire[] = [...internalWires];
    const inputMappings: SubgraphInputMapping[] = [];
    const outputMappings: SubgraphOutputMapping[] = [];
    const wrapperSockets: GraphSocket[] = [];
    const wrapperInputIds: SocketId[] = [];
    const wrapperOutputIds: SocketId[] = [];
    const outerWires: GraphWire[] = [];

    const boundaryInputsBySocket = new Map<SocketId, GraphSocket>();
    for (const boundary of boundaryInputs) {
      if (!boundaryInputsBySocket.has(boundary.toSocket.id)) {
        boundaryInputsBySocket.set(boundary.toSocket.id, boundary.fromSocket);
      }
    }

    for (const [toSocketId, fromSocket] of boundaryInputsBySocket) {
      const toSocket = graphSnapshot.sockets.get(toSocketId);
      if (!toSocket) {
        return null;
      }
      const internalNode = graphSnapshot.nodes.get(toSocket.nodeId);
      if (!internalNode) {
        return null;
      }
      const baseName = `${getNodeLabel(internalNode)}.${toSocket.name}`;
      const inputKey = makeUniqueName(baseName, usedInputNames);
      const inputNodeId = nextInternalNodeId();
      const inputSocketId = makeSocketId(
        `${inputNodeId}.${SUBGRAPH_INPUT_SOCKET_KEY}`,
      );
      internalNodes.push({
        id: inputNodeId,
        type: makeSubgraphInputNodeType(toSocket.dataType),
        position: {
          x: internalNode.position.x - 220,
          y: internalNode.position.y,
        },
        params: {},
        inputs: [],
        outputs: [inputSocketId],
      });
      internalSockets.push({
        id: inputSocketId,
        nodeId: inputNodeId,
        name: SUBGRAPH_INPUT_SOCKET_KEY,
        direction: "output",
        dataType: toSocket.dataType,
        required: false,
      });
      internalWiresWithInputs.push({
        id: nextInternalWireId(),
        fromSocketId: inputSocketId,
        toSocketId: toSocket.id,
      });
      inputMappings.push({ key: inputKey, nodeId: inputNodeId });

      const wrapperSocketId = makeSocketId(`${subgraphNodeId}.${inputKey}`);
      wrapperInputIds.push(wrapperSocketId);
      wrapperSockets.push({
        id: wrapperSocketId,
        nodeId: subgraphNodeId,
        name: inputKey,
        direction: "input",
        dataType: toSocket.dataType,
        required: toSocket.required,
        defaultValue: toSocket.defaultValue,
        minConnections: toSocket.minConnections,
        maxConnections: toSocket.maxConnections,
      });
      outerWires.push({
        id: nextOuterWireId(),
        fromSocketId: fromSocket.id,
        toSocketId: wrapperSocketId,
      });
    }

    const boundaryOutputsBySocket = new Map<
      SocketId,
      { fromSocket: GraphSocket; toSockets: GraphSocket[] }
    >();
    for (const boundary of boundaryOutputs) {
      const entry = boundaryOutputsBySocket.get(boundary.fromSocket.id);
      if (entry) {
        entry.toSockets.push(boundary.toSocket);
      } else {
        boundaryOutputsBySocket.set(boundary.fromSocket.id, {
          fromSocket: boundary.fromSocket,
          toSockets: [boundary.toSocket],
        });
      }
    }

    for (const entry of boundaryOutputsBySocket.values()) {
      const internalNode = graphSnapshot.nodes.get(entry.fromSocket.nodeId);
      if (!internalNode) {
        return null;
      }
      const baseName = `${getNodeLabel(internalNode)}.${entry.fromSocket.name}`;
      const outputKey = makeUniqueName(baseName, usedOutputNames);
      const wrapperSocketId = makeSocketId(`${subgraphNodeId}.${outputKey}`);
      wrapperOutputIds.push(wrapperSocketId);
      wrapperSockets.push({
        id: wrapperSocketId,
        nodeId: subgraphNodeId,
        name: outputKey,
        direction: "output",
        dataType: entry.fromSocket.dataType,
        required: false,
        minConnections: entry.fromSocket.minConnections,
        maxConnections: entry.fromSocket.maxConnections,
      });
      outputMappings.push({
        key: outputKey,
        socketId: entry.fromSocket.id,
      });
      for (const toSocket of entry.toSockets) {
        outerWires.push({
          id: nextOuterWireId(),
          fromSocketId: wrapperSocketId,
          toSocketId: toSocket.id,
        });
      }
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const node of selectedNodesList) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x);
      maxY = Math.max(maxY, node.position.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return null;
    }
    const center = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    };
    const subgraphPosition = settings().snapToGrid
      ? snapPointToGrid(center)
      : center;

    const subgraphDocument: GraphDocumentV1 = {
      schemaVersion: GRAPH_DOCUMENT_V1_SCHEMA_VERSION,
      graphId: makeGraphId(`subgraph-${subgraphNodeId}`),
      nodes: internalNodes,
      sockets: internalSockets,
      wires: internalWiresWithInputs,
    };
    const subgraphParams: SubgraphNodeParams = {
      graph: subgraphDocument,
      inputs: inputMappings,
      outputs: outputMappings,
    };
    const params: JsonObject = {
      graph: subgraphParams.graph as unknown as JsonValue,
      inputs: subgraphParams.inputs as unknown as JsonValue,
      outputs: subgraphParams.outputs as unknown as JsonValue,
    };

    const subgraphNode: GraphNode = {
      id: subgraphNodeId,
      type: SUBGRAPH_NODE_TYPE,
      position: subgraphPosition,
      params,
      inputs: wrapperInputIds,
      outputs: wrapperOutputIds,
    };

    const commands: GraphCommand[] = [];
    for (const node of selectedNodesList) {
      const command = createRemoveNodeCommand(graphSnapshot, node.id);
      if (command) {
        commands.push(command);
      }
    }
    commands.push({
      kind: "add-node",
      node: subgraphNode,
      sockets: wrapperSockets,
    });
    for (const wire of outerWires) {
      commands.push({ kind: "add-wire", wire });
    }

    const changed = applyCommands("collapse-subgraph", commands);
    if (!changed) {
      return null;
    }
    setNodeSelection(new Set([subgraphNodeId]));
    setWireSelection(new Set());
    setFrameSelection(new Set());
    return subgraphNodeId;
  };

  const undo = (): void => {
    if (openBatch) {
      commitHistoryBatch();
    }
    const entry = undoStack.pop();
    if (!entry) {
      return;
    }
    let refresh = false;
    const commands = [...entry.commands].reverse();
    for (const command of commands) {
      const undoCommands = getUndoCommands(command);
      for (const undoCommand of undoCommands) {
        const applied = applyGraphCommandInternal(undoCommand, {
          record: false,
          refresh: false,
        });
        if (applied && commandAffectsExecution(undoCommand)) {
          refresh = true;
        }
      }
    }
    if (refresh) {
      refreshActiveOutput();
    }
    redoStack = [...redoStack, entry];
    setHistoryState({ undo: undoStack.length, redo: redoStack.length });
  };

  const redo = (): void => {
    if (openBatch) {
      commitHistoryBatch();
    }
    const entry = redoStack.pop();
    if (!entry) {
      return;
    }
    let refresh = false;
    for (const command of entry.commands) {
      const applied = applyGraphCommandInternal(command, {
        record: false,
        refresh: false,
      });
      if (applied && commandAffectsExecution(command)) {
        refresh = true;
      }
    }
    if (refresh) {
      refreshActiveOutput();
    }
    undoStack = [...undoStack, entry];
    setHistoryState({ undo: undoStack.length, redo: redoStack.length });
  };

  return {
    graph,
    graphPath,
    dirtyState,
    activeOutputSocketId,
    outputValue,
    outputError,
    outputProgress,
    execHistory,
    debugEvents,
    watchedSockets,
    validationWarnings,
    selectedNodes,
    selectedFrames,
    selectedWires,
    bypassedNodes,
    collapsedNodes,
    settings,
    canvasCenter,
    pointerPosition,
    commandPaletteOpen,
    execVisualization,
    canUndo: () => historyState().undo > 0,
    canRedo: () => historyState().redo > 0,
    loadGraphDocument,
    updateNodeParam,
    requestOutput,
    clearOutput,
    cancelOutputEvaluation,
    refreshActiveOutput,
    clearExecHistory,
    clearDebugEvents,
    markDirtyForNodeChange,
    clearSelection,
    setNodeSelection,
    setFrameSelection,
    setWireSelection,
    toggleBypassNodes,
    toggleCollapsedNodes,
    setBypassedNodes: setBypassedNodesState,
    setCollapsedNodes: setCollapsedNodesState,
    setCanvasCenter,
    setPointerPosition,
    setCommandPaletteOpen,
    setSettings: (next) => {
      setSettingsState(next);
      if (!next.executionVizEnabled) {
        setExecVisualization(null);
      }
    },
    updateSettings: (patch) => {
      setSettingsState((current) => {
        const next = { ...current, ...patch };
        if (!next.executionVizEnabled) {
          setExecVisualization(null);
        }
        return next;
      });
    },
    setGraphPath,
    addWatchedSocket,
    removeWatchedSocket,
    clearWatchedSockets,
    recordConnectionAttempt,
    addNodeAt,
    collapseSelectionToSubgraph,
    applyGraphCommand,
    applyGraphCommandTransient,
    recordGraphCommand,
    beginHistoryBatch,
    commitHistoryBatch,
    undo,
    redo,
  };
};
