import type { DirtyState, ExecError } from "@shadr/exec-engine";
import {
  createExecState,
  evaluateSocket,
  markDirty,
  markDirtyForParamChange,
  markDirtyForWireChange,
} from "@shadr/exec-engine";
import type {
  Graph,
  GraphEffect,
  NodeId,
  SocketId,
  WireId,
} from "@shadr/graph-core";
import { createGraph, graphFromDocumentV1 } from "@shadr/graph-core";
import type { GraphDocumentV1, JsonValue } from "@shadr/shared";
import { makeGraphId } from "@shadr/shared";
import { Effect, Either } from "effect";
import type { Accessor } from "solid-js";
import { createSignal } from "solid-js";

import { resolveNodeDefinition } from "~/editor/exec";
import type { GraphCommand, HistoryEntry } from "~/editor/history";
import {
  applyCommandEffect,
  commandAffectsExecution,
  createUpdateParamCommand,
  getUndoCommands,
  isNoopCommand,
} from "~/editor/history";

/* eslint-disable no-unused-vars */
export type EditorStore = Readonly<{
  graph: Accessor<Graph>;
  dirtyState: Accessor<DirtyState>;
  activeOutputSocketId: Accessor<SocketId | null>;
  outputValue: Accessor<JsonValue | null>;
  outputError: Accessor<ExecError | null>;
  selectedNodes: Accessor<ReadonlySet<NodeId>>;
  selectedWires: Accessor<ReadonlySet<WireId>>;
  loadGraphDocument: (document: GraphDocumentV1) => boolean;
  updateNodeParam: (nodeId: NodeId, key: string, value: JsonValue) => boolean;
  requestOutput: (socketId: SocketId) => void;
  refreshActiveOutput: () => void;
  clearSelection: () => void;
  setNodeSelection: (next: ReadonlySet<NodeId>) => void;
  setWireSelection: (next: ReadonlySet<WireId>) => void;
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
  const [selectedNodes, setSelectedNodes] = createSignal<ReadonlySet<NodeId>>(
    new Set(),
  );
  const [selectedWires, setSelectedWires] = createSignal<ReadonlySet<WireId>>(
    new Set(),
  );
  let undoStack: HistoryEntry[] = [];
  let redoStack: HistoryEntry[] = [];
  let openBatch: HistoryEntry | null = null;

  const resetGraphState = (nextGraph: Graph): void => {
    setGraph(nextGraph);
    setDirtyState(createExecState());
    setActiveOutputSocketId(null);
    setOutputValue(null);
    setOutputError(null);
    setSelectedNodes(new Set());
    setSelectedWires(new Set());
    undoStack = [];
    redoStack = [];
    openBatch = null;
  };

  const runGraphEffect = (effect: GraphEffect<Graph>): Graph | null => {
    const result = Effect.runSync(Effect.either(effect));
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
  };

  const markDirtyForWireChangeGraph = (
    graphState: Graph,
    wireId: WireId,
  ): void => {
    const result = Effect.runSync(
      Effect.either(markDirtyForWireChange(graphState, dirtyState(), wireId)),
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
    const result = Effect.runSync(Effect.either(graphFromDocumentV1(document)));
    if (Either.isLeft(result)) {
      console.warn("Graph load failed", result.left);
      return false;
    }
    resetGraphState(result.right);
    return true;
  };

  const evaluateOutputSocket = (socketId: SocketId): void => {
    const result = Effect.runSync(
      Effect.either(
        evaluateSocket(graph(), socketId, resolveNodeDefinition, dirtyState()),
      ),
    );
    if (Either.isLeft(result)) {
      console.warn("Output evaluation failed", result.left);
      setOutputError(result.left);
      setOutputValue(null);
    } else {
      setOutputError(null);
      setOutputValue(result.right);
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

  const refreshActiveOutput = (): void => {
    const socketId = activeOutputSocketId();
    if (socketId) {
      evaluateOutputSocket(socketId);
    }
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
  };

  return {
    graph,
    dirtyState,
    activeOutputSocketId,
    outputValue,
    outputError,
    selectedNodes,
    selectedWires,
    loadGraphDocument,
    updateNodeParam,
    requestOutput,
    refreshActiveOutput,
    markDirtyForNodeChange,
    clearSelection,
    setNodeSelection,
    setWireSelection,
    applyGraphCommand,
    applyGraphCommandTransient,
    recordGraphCommand,
    beginHistoryBatch,
    commitHistoryBatch,
    undo,
    redo,
  };
};
