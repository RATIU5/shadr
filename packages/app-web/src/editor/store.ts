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
  Graph,
  GraphEffect,
  GraphSocket,
  NodeId,
  SocketId,
  WireId,
} from "@shadr/graph-core";
import { createGraph } from "@shadr/graph-core";
import type { GraphDocumentV1, JsonValue } from "@shadr/shared";
import { makeGraphId, makeNodeId, makeSocketId } from "@shadr/shared";
import { Either } from "effect";
import type { Accessor } from "solid-js";
import { createSignal } from "solid-js";

import { resolveNodeDefinition } from "~/editor/exec";
import type { ExecDebugEntry, ExecDebugNodeError } from "~/editor/exec-debug";
import type { GraphCommand, HistoryEntry } from "~/editor/history";
import {
  applyCommandEffect,
  commandAffectsExecution,
  createUpdateParamCommand,
  getUndoCommands,
  isNoopCommand,
} from "~/editor/history";
import {
  createDefaultParams,
  getNodeCatalogEntry,
} from "~/editor/node-catalog";
import {
  DEFAULT_SETTINGS,
  type EditorSettings,
  snapPointToGrid,
} from "~/editor/settings";
import {
  evaluateSocketWithStatsEffect,
  markDirtyForWireChangeEffect,
} from "~/services/exec-service";
import { graphFromDocument } from "~/services/graph-service";
import { runAppEffectSyncEither } from "~/services/runtime";

type ExecStatsWindow = Window & { __SHADR_EXEC_STATS__?: ExecEvaluationStats };
type Point = Readonly<{ x: number; y: number }>;
type PointerPosition = Readonly<{ screen: Point; world: Point }>;
const MAX_EXEC_HISTORY = 50;

/* eslint-disable no-unused-vars */
export type EditorStore = Readonly<{
  graph: Accessor<Graph>;
  dirtyState: Accessor<DirtyState>;
  activeOutputSocketId: Accessor<SocketId | null>;
  outputValue: Accessor<JsonValue | null>;
  outputError: Accessor<ExecError | null>;
  execHistory: Accessor<ReadonlyArray<ExecDebugEntry>>;
  selectedNodes: Accessor<ReadonlySet<NodeId>>;
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
  refreshActiveOutput: () => void;
  clearExecHistory: () => void;
  clearSelection: () => void;
  setNodeSelection: (next: ReadonlySet<NodeId>) => void;
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
  addNodeAt: (nodeType: string, position?: Point) => NodeId | null;
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
  const [graph, setGraph] = createSignal(createGraph(makeGraphId("main")));
  const [dirtyState, setDirtyState] = createSignal(createExecState(), {
    equals: false,
  });
  const [activeOutputSocketId, setActiveOutputSocketId] =
    createSignal<SocketId | null>(null);
  const [outputValue, setOutputValue] = createSignal<JsonValue | null>(null);
  const [outputError, setOutputError] = createSignal<ExecError | null>(null);
  const [execHistory, setExecHistory] = createSignal<ExecDebugEntry[]>([], {
    equals: false,
  });
  const [selectedNodes, setSelectedNodes] = createSignal<ReadonlySet<NodeId>>(
    new Set(),
  );
  const [selectedWires, setSelectedWires] = createSignal<ReadonlySet<WireId>>(
    new Set(),
  );
  const [bypassedNodes, setBypassedNodes] = createSignal<ReadonlySet<NodeId>>(
    new Set(),
  );
  const [collapsedNodes, setCollapsedNodes] = createSignal<ReadonlySet<NodeId>>(
    new Set(),
  );
  const [settings, setSettings] =
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
  let undoStack: HistoryEntry[] = [];
  let redoStack: HistoryEntry[] = [];
  let openBatch: HistoryEntry | null = null;
  let nodeCounter = 1;
  let execHistoryCounter = 1;

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

  const resetGraphState = (nextGraph: Graph): void => {
    setGraph(nextGraph);
    setDirtyState(createExecState());
    setActiveOutputSocketId(null);
    setOutputValue(null);
    setOutputError(null);
    setExecHistory([]);
    setSelectedNodes(new Set());
    setSelectedWires(new Set());
    setBypassedNodes(new Set());
    setCollapsedNodes(new Set());
    setPointerPosition(null);
    nodeCounter = nextNodeCounterForGraph(nextGraph);
    execHistoryCounter = 1;
    undoStack = [];
    redoStack = [];
    openBatch = null;
    setHistoryState({ undo: 0, redo: 0 });
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

  const runGraphEffect = (effect: GraphEffect<Graph>): Graph | null => {
    const result = runAppEffectSyncEither(effect);
    if (Either.isLeft(result)) {
      console.warn("Graph update failed", result.left);
      return null;
    }
    setGraph(result.right);
    return result.right;
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
    return true;
  };

  const loadGraphDocument = (document: GraphDocumentV1): boolean => {
    const result = runAppEffectSyncEither(graphFromDocument(document));
    if (Either.isLeft(result)) {
      console.warn("Graph load failed", result.left);
      return false;
    }
    resetGraphState(result.right);
    return true;
  };

  const evaluateOutputSocket = (socketId: SocketId): void => {
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
      recordExecHistory({
        timestamp,
        outputSocketId,
        status: "success",
        stats: result.right.stats,
        nodeErrors: collectNodeErrors(dirtyState()),
      });
    }
    setDirtyState(dirtyState());
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

  const requestOutput = (socketId: SocketId): void => {
    setActiveOutputSocketId(socketId);
    evaluateOutputSocket(socketId);
  };

  const clearOutput = (): void => {
    setActiveOutputSocketId(null);
    setOutputValue(null);
    setOutputError(null);
  };

  const refreshActiveOutput = (): void => {
    const socketId = activeOutputSocketId();
    if (socketId) {
      evaluateOutputSocket(socketId);
    }
  };

  const clearExecHistory = (): void => {
    setExecHistory([]);
  };

  const markDirtyForNodeChange = (nodeId: NodeId): void => {
    setDirtyState((state) => markDirty(graph(), state, nodeId));
  };

  const clearSelection = (): void => {
    setSelectedNodes(new Set());
    setSelectedWires(new Set());
  };

  const setNodeSelection = (next: ReadonlySet<NodeId>): void => {
    setSelectedNodes(new Set(next));
    setSelectedWires(new Set());
  };

  const setWireSelection = (next: ReadonlySet<WireId>): void => {
    setSelectedWires(new Set(next));
    setSelectedNodes(new Set());
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
        direction: "input",
        dataType: input.dataType,
        required: input.isOptional ? false : true,
        minConnections: input.minConnections,
        maxConnections: input.maxConnections ?? 1,
      });
    }
    for (const output of definition.outputs) {
      const socketId = makeSocketId(`${nodeId}.${output.key}`);
      outputIds.push(socketId);
      sockets.push({
        id: socketId,
        nodeId,
        name: output.key,
        direction: "output",
        dataType: output.dataType,
        required: false,
        minConnections: output.minConnections,
        maxConnections: output.maxConnections,
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
    dirtyState,
    activeOutputSocketId,
    outputValue,
    outputError,
    execHistory,
    selectedNodes,
    selectedWires,
    bypassedNodes,
    collapsedNodes,
    settings,
    canvasCenter,
    pointerPosition,
    commandPaletteOpen,
    canUndo: () => historyState().undo > 0,
    canRedo: () => historyState().redo > 0,
    loadGraphDocument,
    updateNodeParam,
    requestOutput,
    clearOutput,
    refreshActiveOutput,
    clearExecHistory,
    markDirtyForNodeChange,
    clearSelection,
    setNodeSelection,
    setWireSelection,
    toggleBypassNodes,
    toggleCollapsedNodes,
    setBypassedNodes: setBypassedNodesState,
    setCollapsedNodes: setCollapsedNodesState,
    setCanvasCenter,
    setPointerPosition,
    setCommandPaletteOpen,
    setSettings,
    updateSettings: (patch) => {
      setSettings((current) => ({ ...current, ...patch }));
    },
    addNodeAt,
    applyGraphCommand,
    applyGraphCommandTransient,
    recordGraphCommand,
    beginHistoryBatch,
    commitHistoryBatch,
    undo,
    redo,
  };
};
