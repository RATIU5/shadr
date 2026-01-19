import * as Toast from "@kobalte/core/toast";
import {
  type FrameId,
  type GraphNode,
  type GraphSocket,
  graphToDocumentV1,
  type NodeId,
  type SocketId,
  type WireId,
} from "@shadr/graph-core";
import type { ParamSchemaDefinition } from "@shadr/plugin-system";
import type {
  GraphDocumentV1,
  GraphId,
  JsonObject,
  JsonValue,
  SocketTypeId,
  SubgraphNodeParams,
} from "@shadr/shared";
import {
  getSocketTypeMetadata,
  MAX_SUBGRAPH_DEPTH,
  SOCKET_TYPE_PRIMITIVES,
  SUBGRAPH_NODE_TYPE,
} from "@shadr/shared";
import { clientOnly } from "@solidjs/start";
import { Either } from "effect";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  CircleDot,
  EyeOff,
  Minimize2,
  Redo2,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
} from "solid-js";

import CommandPalette, {
  type CommandPaletteEntry,
} from "~/components/CommandPalette";
import SubgraphParamOverrides from "~/components/SubgraphParamOverrides";
import { downloadTextFile } from "~/editor/download";
import {
  formatGraphImportError,
  graphDocumentToJson,
  parseGraphDocumentJson,
} from "~/editor/graph-io";
import {
  createRemoveFrameCommand,
  createRemoveNodeCommand,
  createRemoveWireCommand,
  createUpdateNodeIoCommand,
  type GraphCommand,
} from "~/editor/history";
import { getNodeCatalogEntry, NODE_CATALOG } from "~/editor/node-catalog";
import {
  compileOutputArtifact,
  downloadOutputArtifact,
  isOutputNodeType,
  type OutputArtifact,
  type OutputNodeType,
} from "~/editor/output-artifacts";
import { coerceSettings, settingsToJson } from "~/editor/settings";
import { createEditorStore } from "~/editor/store";
import {
  parseSubgraphParams,
  serializeSubgraphParams,
} from "~/editor/subgraph-io";
import {
  coerceUiState,
  DEFAULT_UI_STATE,
  type EditorUiState,
  type GraphBreadcrumb,
  uiStateToJson,
} from "~/editor/ui-state";
import {
  createAppLayer,
  runAppEffect,
  runAppEffectEither,
} from "~/services/runtime";
import {
  loadGraphDocument as loadGraphDocumentEffect,
  loadSettings as loadSettingsEffect,
  loadUiState as loadUiStateEffect,
  saveGraphDocument as saveGraphDocumentEffect,
  saveSettings as saveSettingsEffect,
  saveUiState as saveUiStateEffect,
} from "~/services/storage-service";
import {
  createUiEventServiceLayer,
  notifyUi,
} from "~/services/ui-event-service";

const EditorCanvas = clientOnly(() => import("~/components/EditorCanvas"));

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

type Point = Readonly<{ x: number; y: number }>;

type GraphFocusSnapshot = Readonly<{
  canvasCenter: Point;
  selectedNodes: ReadonlyArray<NodeId>;
  selectedFrames: ReadonlyArray<FrameId>;
  selectedWires: ReadonlyArray<WireId>;
}>;

type GraphNavEntry = Readonly<{
  breadcrumb: GraphBreadcrumb;
  document: GraphDocumentV1;
  focus: GraphFocusSnapshot;
  parentNodeId?: NodeId;
}>;

type GraphNavHistory = Readonly<{
  entries: ReadonlyArray<ReadonlyArray<GraphNavEntry>>;
  index: number;
}>;

const formatExecError = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "_tag" in error) {
    const tagValue = (error as { _tag: string })._tag;
    return typeof tagValue === "string" ? tagValue : "ExecutionError";
  }
  return "ExecutionError";
};

export default function EditorShell() {
  const toaster = Toast.toaster;
  const store = createEditorStore();
  const [isLoaded, setIsLoaded] = createSignal(false);
  const [settingsLoaded, setSettingsLoaded] = createSignal(false);
  const [uiStateLoaded, setUiStateLoaded] = createSignal(false);
  const [pendingUiState, setPendingUiState] =
    createSignal<EditorUiState | null>(null);
  const [recentGraphIds, setRecentGraphIds] = createSignal<
    ReadonlyArray<GraphId>
  >(DEFAULT_UI_STATE.recentGraphIds);
  const [navStack, setNavStack] = createSignal<ReadonlyArray<GraphNavEntry>>(
    [],
  );
  const [navHistory, setNavHistory] = createSignal<GraphNavHistory>({
    entries: [],
    index: -1,
  });

  type AutosaveStatus = "idle" | "saving" | "saved" | "error";
  const [autosaveStatus, setAutosaveStatus] =
    createSignal<AutosaveStatus>("idle");
  type OutputStatus = "idle" | "running" | "ready" | "error";
  const [outputStatus, setOutputStatus] = createSignal<OutputStatus>("idle");
  const [outputArtifact, setOutputArtifact] =
    createSignal<OutputArtifact | null>(null);
  const [outputMessage, setOutputMessage] = createSignal<string | null>(null);

  const isDirtyGraph = createMemo(() => store.dirtyState().dirty.size > 0);
  const selectionCount = createMemo(
    () =>
      store.selectedNodes().size +
      store.selectedFrames().size +
      store.selectedWires().size,
  );
  const isEmptyGraph = createMemo(() => store.graph().nodes.size === 0);
  const gridVisible = createMemo(() => store.settings().gridVisible);
  const snapToGrid = createMemo(() => store.settings().snapToGrid);
  const wireHoverLabels = createMemo(() => store.settings().wireHoverLabels);
  const graphPath = createMemo<ReadonlyArray<GraphBreadcrumb>>(() => {
    const path = store.graphPath();
    if (path.length > 0) {
      return path;
    }
    return [{ id: store.graph().graphId, label: "Main" }];
  });
  const canNavigateBack = createMemo(() => navHistory().index > 0);
  const canNavigateForward = createMemo(() => {
    const history = navHistory();
    return history.index >= 0 && history.index < history.entries.length - 1;
  });

  const statusBase =
    "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.18em]";
  const statusWarn =
    "border-[color:var(--status-warn-border)] bg-[color:var(--status-warn-bg)] text-[color:var(--status-warn-text)]";
  const statusInfo =
    "border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)]";
  const statusSuccess =
    "border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]";
  const statusDanger =
    "border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)]";
  const statusMuted =
    "border-[color:var(--status-muted-border)] bg-[color:var(--status-muted-bg)] text-[color:var(--status-muted-text)]";
  const appBadge =
    "pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--border-muted)] bg-[color:var(--surface-panel-muted)] px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--app-text)]";
  const breadcrumbRoot =
    "pointer-events-auto flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-panel-muted)] px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]";
  const breadcrumbItem =
    "inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--app-text)] transition";
  const breadcrumbItemActive =
    "hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-strong)]";
  const breadcrumbItemDisabled = "cursor-default";
  const breadcrumbSeparator = "text-[color:var(--text-muted)]";
  const historyButtonBase =
    "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.55rem] uppercase tracking-[0.18em] transition";
  const historyButtonActive =
    "border-[color:var(--border-muted)] bg-[color:var(--surface-panel-muted)] text-[color:var(--app-text)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-strong)]";
  const historyButtonDisabled =
    "cursor-not-allowed border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-soft)] text-[color:var(--text-muted)]";
  const overlayRoot = "pointer-events-none absolute inset-0";
  const controlMenuRoot =
    "pointer-events-auto flex w-[min(92vw,720px)] flex-col gap-2 rounded-[1.1rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-panel)] px-3 py-2 text-[color:var(--app-text)] shadow-[var(--shadow-panel)] backdrop-blur max-h-[35vh] overflow-y-auto";
  const controlMenuTitle =
    "text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]";
  const controlMenuValue = "text-[0.8rem] text-[color:var(--text-strong)]";
  const controlMenuButton =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.2em] transition disabled:cursor-not-allowed disabled:opacity-50";
  const controlMenuMuted =
    "border-[color:var(--border-muted)] bg-[color:var(--surface-panel-muted)] text-[color:var(--app-text)] hover:border-[color:var(--border-strong)]";
  const controlMenuInfo =
    "border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)] hover:border-[color:var(--status-info-border)]";
  const controlMenuWarn =
    "border-[color:var(--status-warn-border)] bg-[color:var(--status-warn-bg)] text-[color:var(--status-warn-text)] hover:border-[color:var(--status-warn-border)]";
  const controlMenuDanger =
    "border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)] hover:border-[color:var(--status-danger-border)]";

  const sidePanelRoot =
    "pointer-events-auto flex w-[min(92vw,320px)] flex-col gap-3 rounded-[1.1rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-panel-strong)] px-3 py-3 text-[color:var(--app-text)] shadow-[var(--shadow-panel)] backdrop-blur max-h-[70vh] overflow-y-auto";
  const sidePanelTitle =
    "text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]";
  const sidePanelValue = "text-[0.85rem] text-[color:var(--text-strong)]";
  const sidePanelChip =
    "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[0.6rem] uppercase tracking-[0.18em]";
  const sidePanelRow =
    "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1 text-[0.7rem]";
  const sidePanelMuted =
    "border-[color:var(--border-muted)] bg-[color:var(--surface-panel-muted)] text-[color:var(--text-soft)]";
  const sidePanelInfo =
    "border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)]";
  const sidePanelWarn =
    "border-[color:var(--status-warn-border)] bg-[color:var(--status-warn-bg)] text-[color:var(--status-warn-text)]";
  const sidePanelDanger =
    "border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)]";
  const sidePanelSuccess =
    "border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]";
  const ioPanel =
    "flex flex-col gap-2 rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-panel)] px-2.5 py-2 text-[0.7rem]";
  const ioLabel =
    "text-[0.55rem] uppercase tracking-[0.18em] text-[color:var(--text-muted)]";
  const ioInput =
    "w-full rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-muted)] px-2 py-1 text-[0.75rem] text-[color:var(--text-strong)] focus:border-[color:var(--border-strong)] focus:outline-none";
  const ioSelect =
    "w-full rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-muted)] px-2 py-1 text-[0.7rem] text-[color:var(--text-strong)] focus:border-[color:var(--border-strong)] focus:outline-none";

  const toastRegion = "fixed right-4 top-4 z-30 w-[min(280px,90vw)]";
  const toastList = "flex flex-col gap-2";
  const toastRoot =
    "flex items-start justify-between gap-3 rounded-[0.9rem] border border-[color:var(--status-info-border)] bg-[color:var(--surface-panel-strong)] px-3 py-2 text-[0.85rem] text-[color:var(--app-text)] shadow-[var(--shadow-toast)]";
  const toastTitle = "text-[0.8rem] font-semibold uppercase tracking-[0.14em]";
  const toastDescription = "mt-1 text-[0.8rem] text-[color:var(--text-muted)]";
  const toastClose =
    "rounded-full border border-[color:var(--border-muted)] px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.18em] text-[color:var(--text-soft)]";

  const showToast = (title: string, description?: string): number =>
    toaster.show((props) => (
      <Toast.Root class={toastRoot} toastId={props.toastId}>
        <div class="flex flex-col">
          <Toast.Title class={toastTitle}>{title}</Toast.Title>
          {description ? (
            <Toast.Description class={toastDescription}>
              {description}
            </Toast.Description>
          ) : null}
        </div>
        <Toast.CloseButton class={toastClose}>Dismiss</Toast.CloseButton>
      </Toast.Root>
    ));

  const uiEventLayer = createUiEventServiceLayer((event) => {
    if (event.kind === "toast") {
      showToast(event.title, event.description);
    }
  });
  const appLayer = createAppLayer(uiEventLayer);
  const notifyToast = (title: string, description?: string): void => {
    void runAppEffect(
      notifyUi({ kind: "toast", title, description }),
      appLayer,
    );
  };
  const notifyViewportEmpty = (): void => {
    if (!isLoaded()) {
      return;
    }
    notifyToast("Nothing in view", "Press F to frame all nodes.");
  };

  let importInput: HTMLInputElement | undefined;
  let autosaveStatusTimer: number | null = null;
  let uiStateSaveTimer: number | null = null;

  const setAutosaveStatusWithTimeout = (
    status: AutosaveStatus,
    timeoutMs?: number,
  ): void => {
    setAutosaveStatus(status);
    if (autosaveStatusTimer !== null) {
      window.clearTimeout(autosaveStatusTimer);
    }
    if (timeoutMs !== undefined) {
      autosaveStatusTimer = window.setTimeout(() => {
        autosaveStatusTimer = null;
        setAutosaveStatus("idle");
      }, timeoutMs);
    }
  };

  const mergeRecentGraphIds = (
    graphId: GraphId,
    current: ReadonlyArray<GraphId>,
  ): ReadonlyArray<GraphId> => {
    const ordered: GraphId[] = [graphId];
    for (const entry of current) {
      if (entry !== graphId) {
        ordered.push(entry);
      }
    }
    return ordered.slice(0, 5);
  };

  const formatRootLabel = (graphId: GraphId): string =>
    graphId === "main" ? "Main" : graphId;

  const createFocusSnapshot = (): GraphFocusSnapshot => ({
    canvasCenter: store.canvasCenter(),
    selectedNodes: Array.from(store.selectedNodes()).sort((left, right) =>
      left.localeCompare(right),
    ),
    selectedFrames: Array.from(store.selectedFrames()).sort((left, right) =>
      left.localeCompare(right),
    ),
    selectedWires: Array.from(store.selectedWires()).sort((left, right) =>
      left.localeCompare(right),
    ),
  });

  const applyFocusSnapshot = (snapshot: GraphFocusSnapshot): void => {
    store.setCanvasCenter(snapshot.canvasCenter);
    const nodes = new Set(snapshot.selectedNodes);
    const frames = new Set(snapshot.selectedFrames);
    const wires = new Set(snapshot.selectedWires);
    if (nodes.size > 0) {
      store.setNodeSelection(nodes);
      return;
    }
    if (frames.size > 0) {
      store.setFrameSelection(frames);
      return;
    }
    if (wires.size > 0) {
      store.setWireSelection(wires);
      return;
    }
    store.clearSelection();
  };

  const getGraphDocumentCenter = (document: GraphDocumentV1): Point => {
    if (document.nodes.length === 0) {
      return { x: 0, y: 0 };
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const node of document.nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x);
      maxY = Math.max(maxY, node.position.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return { x: 0, y: 0 };
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  };

  const getSubgraphDocumentDepth = (
    document: GraphDocumentV1,
    stack: Set<GraphId>,
  ): number => {
    if (stack.has(document.graphId)) {
      return MAX_SUBGRAPH_DEPTH + 1;
    }
    stack.add(document.graphId);
    let maxDepth = 0;
    for (const node of document.nodes) {
      if (node.type !== SUBGRAPH_NODE_TYPE) {
        continue;
      }
      const params = parseSubgraphParams(node.params);
      if (!params) {
        continue;
      }
      const depth = 1 + getSubgraphDocumentDepth(params.graph, stack);
      maxDepth = Math.max(maxDepth, depth);
    }
    stack.delete(document.graphId);
    return maxDepth;
  };

  const getSelectionSubgraphDepth = (): number => {
    let maxDepth = 0;
    const graphSnapshot = store.graph();
    for (const nodeId of store.selectedNodes()) {
      const node = graphSnapshot.nodes.get(nodeId);
      if (!node || node.type !== SUBGRAPH_NODE_TYPE) {
        continue;
      }
      const params = parseSubgraphParams(node.params);
      if (!params) {
        continue;
      }
      const depth = 1 + getSubgraphDocumentDepth(params.graph, new Set());
      maxDepth = Math.max(maxDepth, depth);
    }
    return maxDepth;
  };

  const canNestSubgraph = (): boolean => {
    const currentDepth = navStack().length - 1;
    const selectionDepth = getSelectionSubgraphDepth();
    return currentDepth + 1 + selectionDepth <= MAX_SUBGRAPH_DEPTH;
  };

  const handleCollapseSubgraph = (): void => {
    if (!canNestSubgraph()) {
      notifyToast(
        "Subgraph limit reached",
        `Nested subgraphs are limited to ${MAX_SUBGRAPH_DEPTH} levels.`,
      );
      return;
    }
    store.collapseSelectionToSubgraph();
  };

  const getSubgraphDocumentForNode = (
    document: GraphDocumentV1,
    nodeId: NodeId,
  ): GraphDocumentV1 | null => {
    const node = document.nodes.find((entry) => entry.id === nodeId);
    if (!node || node.type !== SUBGRAPH_NODE_TYPE) {
      return null;
    }
    const params = parseSubgraphParams(node.params);
    return params ? params.graph : null;
  };

  const updateSubgraphInstancesInDocument = (
    document: GraphDocumentV1,
    targetGraphId: GraphId,
    nextSubgraphDocument: GraphDocumentV1,
    stack: ReadonlySet<GraphId> = new Set(),
  ): { document: GraphDocumentV1; updated: boolean } => {
    if (stack.has(document.graphId)) {
      return { document, updated: false };
    }
    const nextStack = new Set(stack);
    nextStack.add(document.graphId);
    let updated = false;
    const nodes = document.nodes.map((node) => {
      if (node.type !== SUBGRAPH_NODE_TYPE) {
        return node;
      }
      const params = parseSubgraphParams(node.params);
      if (!params) {
        return node;
      }
      let nextGraph = params.graph;
      let graphUpdated = false;
      if (params.graph.graphId === targetGraphId) {
        nextGraph = nextSubgraphDocument;
        graphUpdated = true;
      } else if (!nextStack.has(params.graph.graphId)) {
        const nestedResult = updateSubgraphInstancesInDocument(
          params.graph,
          targetGraphId,
          nextSubgraphDocument,
          nextStack,
        );
        if (nestedResult.updated) {
          nextGraph = nestedResult.document;
          graphUpdated = true;
        }
      }
      if (!graphUpdated) {
        return node;
      }
      updated = true;
      return {
        ...node,
        params: serializeSubgraphParams({
          ...params,
          graph: nextGraph,
        }),
      };
    });
    if (!updated) {
      return { document, updated: false };
    }
    return { document: { ...document, nodes }, updated: true };
  };

  const rebuildNavStack = (
    stack: ReadonlyArray<GraphNavEntry>,
    rootDocument: GraphDocumentV1,
  ): ReadonlyArray<GraphNavEntry> => {
    if (stack.length === 0) {
      return stack;
    }
    const nextStack: GraphNavEntry[] = [
      { ...stack[0], document: rootDocument },
    ];
    for (let index = 1; index < stack.length; index += 1) {
      const entry = stack[index];
      const parent = nextStack[index - 1];
      const parentNodeId = entry.parentNodeId;
      const resolved =
        parentNodeId !== undefined
          ? getSubgraphDocumentForNode(parent.document, parentNodeId)
          : null;
      if (!resolved) {
        notifyToast("Subgraph update failed", "Parent graph data missing.");
        nextStack.push(entry);
        continue;
      }
      nextStack.push({ ...entry, document: resolved });
    }
    return nextStack;
  };

  const commitNavigationStack = (): ReadonlyArray<GraphNavEntry> => {
    const stack = navStack();
    if (stack.length === 0) {
      return stack;
    }
    const currentDocument = graphToDocumentV1(store.graph());
    const currentFocus = createFocusSnapshot();
    let nextStack = [
      ...stack.slice(0, -1),
      {
        ...stack[stack.length - 1],
        document: currentDocument,
        focus: currentFocus,
      },
    ];
    if (nextStack.length === 1) {
      setNavStack(nextStack);
      setNavHistory((current) => {
        if (current.index < 0) {
          return { entries: [nextStack], index: 0 };
        }
        const entries = [...current.entries];
        entries[current.index] = nextStack;
        return { entries, index: current.index };
      });
      return nextStack;
    }
    const rootEntry = nextStack[0];
    const updateResult = updateSubgraphInstancesInDocument(
      rootEntry.document,
      currentDocument.graphId,
      currentDocument,
    );
    if (updateResult.updated) {
      nextStack = rebuildNavStack(nextStack, updateResult.document);
    } else {
      notifyToast("Subgraph update failed", "Parent graph data missing.");
    }
    setNavStack(nextStack);
    setNavHistory((current) => {
      if (current.index < 0) {
        return { entries: [nextStack], index: 0 };
      }
      const entries = [...current.entries];
      entries[current.index] = nextStack;
      return { entries, index: current.index };
    });
    return nextStack;
  };

  const applyNavigationStack = (
    stack: ReadonlyArray<GraphNavEntry>,
    recordHistory: boolean,
  ): void => {
    if (stack.length === 0) {
      return;
    }
    const current = stack[stack.length - 1];
    const loaded = store.loadGraphDocument(current.document);
    if (!loaded) {
      notifyToast("Navigation failed", "Unable to load graph.");
      return;
    }
    store.setGraphPath(stack.map((entry) => entry.breadcrumb));
    applyFocusSnapshot(current.focus);
    setNavStack(stack);
    if (recordHistory) {
      setNavHistory((currentHistory) => {
        const base =
          currentHistory.index >= 0
            ? currentHistory.entries.slice(0, currentHistory.index + 1)
            : [];
        const entries = [...base, stack];
        return { entries, index: entries.length - 1 };
      });
    }
  };

  const initializeNavigation = (): void => {
    const document = graphToDocumentV1(store.graph());
    const rootEntry: GraphNavEntry = {
      breadcrumb: {
        id: document.graphId,
        label: formatRootLabel(document.graphId),
      },
      document,
      focus: createFocusSnapshot(),
    };
    const stack = [rootEntry];
    setNavStack(stack);
    setNavHistory({ entries: [stack], index: 0 });
    store.setGraphPath(stack.map((entry) => entry.breadcrumb));
  };

  const navigateHistory = (direction: "back" | "forward"): void => {
    const historySnapshot = navHistory();
    if (historySnapshot.index < 0) {
      return;
    }
    commitNavigationStack();
    const nextHistory = navHistory();
    const delta = direction === "back" ? -1 : 1;
    const nextIndex = nextHistory.index + delta;
    if (nextIndex < 0 || nextIndex >= nextHistory.entries.length) {
      return;
    }
    const targetStack = nextHistory.entries[nextIndex];
    setNavHistory({ entries: nextHistory.entries, index: nextIndex });
    applyNavigationStack(targetStack, false);
  };

  const navigateToBreadcrumb = (targetIndex: number): void => {
    const stack = commitNavigationStack();
    if (targetIndex < 0 || targetIndex >= stack.length - 1) {
      return;
    }
    const nextStack = stack.slice(0, targetIndex + 1);
    applyNavigationStack(nextStack, true);
  };

  const navigateToSubgraph = (nodeId: NodeId): void => {
    if (navStack().length - 1 >= MAX_SUBGRAPH_DEPTH) {
      notifyToast(
        "Subgraph limit reached",
        `Nested subgraphs are limited to ${MAX_SUBGRAPH_DEPTH} levels.`,
      );
      return;
    }
    const node = store.graph().nodes.get(nodeId);
    if (!node || node.type !== SUBGRAPH_NODE_TYPE) {
      return;
    }
    const params = parseSubgraphParams(node.params);
    if (!params) {
      notifyToast("Subgraph missing", "Unable to read subgraph data.");
      return;
    }
    const stack = commitNavigationStack();
    const suffix = node.id.startsWith("node-") ? node.id.slice(5) : node.id;
    const entry: GraphNavEntry = {
      breadcrumb: {
        id: params.graph.graphId,
        label: `Subgraph ${suffix}`,
      },
      document: params.graph,
      focus: {
        canvasCenter: getGraphDocumentCenter(params.graph),
        selectedNodes: [],
        selectedFrames: [],
        selectedWires: [],
      },
      parentNodeId: node.id,
    };
    const nextStack = [...stack, entry];
    applyNavigationStack(nextStack, true);
  };

  const normalizeGraphPath = (
    path: ReadonlyArray<GraphBreadcrumb>,
    graphId: GraphId,
  ): ReadonlyArray<GraphBreadcrumb> => {
    if (path.length === 0 || path[0].id !== graphId) {
      return [{ id: graphId, label: "Main" }];
    }
    return path;
  };

  const applyUiState = (state: EditorUiState): void => {
    const graphSnapshot = store.graph();
    const validNodes = (ids: ReadonlyArray<NodeId>): NodeId[] =>
      ids.filter((id) => graphSnapshot.nodes.has(id));
    const validFrames = (ids: ReadonlyArray<FrameId>): FrameId[] =>
      ids.filter((id) => graphSnapshot.frames.has(id));
    const validWires = (ids: ReadonlyArray<WireId>): WireId[] =>
      ids.filter((id) => graphSnapshot.wires.has(id));

    store.setGraphPath(
      normalizeGraphPath(state.graphPath, graphSnapshot.graphId),
    );
    store.setCanvasCenter(state.canvasCenter);
    store.setBypassedNodes(new Set(validNodes(state.bypassedNodes)));
    store.setCollapsedNodes(new Set(validNodes(state.collapsedNodes)));

    const selectedNodes = validNodes(state.selectedNodes);
    const selectedFrames = validFrames(state.selectedFrames);
    const selectedWires = validWires(state.selectedWires);
    if (selectedNodes.length > 0) {
      store.setNodeSelection(new Set(selectedNodes));
    } else if (selectedFrames.length > 0) {
      store.setFrameSelection(new Set(selectedFrames));
    } else if (selectedWires.length > 0) {
      store.setWireSelection(new Set(selectedWires));
    } else {
      store.clearSelection();
    }
  };

  onMount(() => {
    void runAppEffectEither(loadUiStateEffect(), appLayer).then((uiResult) => {
      let uiState = DEFAULT_UI_STATE;
      if (Either.isLeft(uiResult)) {
        console.warn("Failed to load UI state", uiResult.left);
        notifyToast("Storage error", "UI layout reset.");
      } else {
        uiState = coerceUiState(uiResult.right);
      }
      setPendingUiState(uiState);
      setRecentGraphIds(uiState.recentGraphIds);
      const graphId = uiState.lastGraphId ?? store.graph().graphId;
      void runAppEffectEither(loadGraphDocumentEffect(graphId), appLayer).then(
        (result) => {
          if (Either.isLeft(result)) {
            console.warn("Failed to load graph document", result.left);
            notifyToast("Storage error", "Starting with a new graph session.");
            const initialUiState = pendingUiState() ?? uiState;
            applyUiState(initialUiState);
            initializeNavigation();
            setPendingUiState(null);
            setRecentGraphIds((current) =>
              mergeRecentGraphIds(store.graph().graphId, current),
            );
            setIsLoaded(true);
            setUiStateLoaded(true);
            return;
          }
          const document = result.right;
          if (document) {
            const loaded = store.loadGraphDocument(document);
            if (!loaded) {
              notifyToast("Load failed", "Stored graph was invalid.");
            }
          }
          const initialUiState = pendingUiState() ?? uiState;
          applyUiState(initialUiState);
          initializeNavigation();
          setPendingUiState(null);
          setRecentGraphIds((current) =>
            mergeRecentGraphIds(store.graph().graphId, current),
          );
          setIsLoaded(true);
          setUiStateLoaded(true);
        },
      );
    });

    let autosaveTimer: number | null = null;
    const scheduleAutosave = (): void => {
      if (!isLoaded()) {
        return;
      }
      if (autosaveTimer !== null) {
        window.clearTimeout(autosaveTimer);
      }
      autosaveTimer = window.setTimeout(() => {
        autosaveTimer = null;
        const document = graphToDocumentV1(store.graph());
        setAutosaveStatusWithTimeout("saving");
        void runAppEffectEither(
          saveGraphDocumentEffect(document),
          appLayer,
        ).then((saveResult) => {
          if (Either.isLeft(saveResult)) {
            console.warn("Autosave failed", saveResult.left);
            notifyToast("Autosave failed", "Changes stay local.");
            setAutosaveStatusWithTimeout("error", 2200);
          } else {
            setAutosaveStatusWithTimeout("saved", 1400);
          }
        });
      }, 600);
    };

    createEffect(() => {
      store.graph();
      scheduleAutosave();
    });

    onCleanup(() => {
      if (autosaveTimer !== null) {
        window.clearTimeout(autosaveTimer);
      }
      if (autosaveStatusTimer !== null) {
        window.clearTimeout(autosaveStatusTimer);
      }
      if (uiStateSaveTimer !== null) {
        window.clearTimeout(uiStateSaveTimer);
      }
    });
  });

  onMount(() => {
    void runAppEffectEither(loadSettingsEffect(), appLayer).then((result) => {
      if (Either.isLeft(result)) {
        console.warn("Failed to load settings", result.left);
        notifyToast("Settings error", "Using default preferences.");
        setSettingsLoaded(true);
        return;
      }
      const settings = coerceSettings(result.right);
      store.setSettings(settings);
      setSettingsLoaded(true);
    });

    let settingsSaveTimer: number | null = null;
    const scheduleSettingsSave = (): void => {
      if (!settingsLoaded()) {
        return;
      }
      if (settingsSaveTimer !== null) {
        window.clearTimeout(settingsSaveTimer);
      }
      settingsSaveTimer = window.setTimeout(() => {
        settingsSaveTimer = null;
        const payload = settingsToJson(store.settings());
        void runAppEffectEither(saveSettingsEffect(payload), appLayer).then(
          (saveResult) => {
            if (Either.isLeft(saveResult)) {
              console.warn("Settings save failed", saveResult.left);
              notifyToast("Settings not saved", "Preferences will reset.");
            }
          },
        );
      }, 400);
    };

    createEffect(() => {
      store.settings();
      scheduleSettingsSave();
    });

    onCleanup(() => {
      if (settingsSaveTimer !== null) {
        window.clearTimeout(settingsSaveTimer);
      }
    });
  });

  const scheduleUiStateSave = (): void => {
    if (!isLoaded() || !uiStateLoaded()) {
      return;
    }
    if (uiStateSaveTimer !== null) {
      window.clearTimeout(uiStateSaveTimer);
    }
    uiStateSaveTimer = window.setTimeout(() => {
      uiStateSaveTimer = null;
      const graphSnapshot = store.graph();
      const mergedRecent = mergeRecentGraphIds(
        graphSnapshot.graphId,
        recentGraphIds(),
      );
      setRecentGraphIds(mergedRecent);
      const uiState: EditorUiState = {
        lastGraphId: graphSnapshot.graphId,
        recentGraphIds: mergedRecent,
        graphPath: store.graphPath(),
        canvasCenter: store.canvasCenter(),
        selectedNodes: Array.from(store.selectedNodes()).sort((left, right) =>
          left.localeCompare(right),
        ),
        selectedFrames: Array.from(store.selectedFrames()).sort((left, right) =>
          left.localeCompare(right),
        ),
        selectedWires: Array.from(store.selectedWires()).sort((left, right) =>
          left.localeCompare(right),
        ),
        bypassedNodes: Array.from(store.bypassedNodes()).sort((left, right) =>
          left.localeCompare(right),
        ),
        collapsedNodes: Array.from(store.collapsedNodes()).sort((left, right) =>
          left.localeCompare(right),
        ),
      };
      const payload = uiStateToJson(uiState);
      void runAppEffectEither(saveUiStateEffect(payload), appLayer).then(
        (saveResult) => {
          if (Either.isLeft(saveResult)) {
            console.warn("UI state save failed", saveResult.left);
            notifyToast("UI state not saved", "Layout may reset.");
          }
        },
      );
    }, 500);
  };

  createEffect(() => {
    store.graph();
    store.graphPath();
    store.canvasCenter();
    store.selectedNodes();
    store.selectedFrames();
    store.selectedWires();
    store.bypassedNodes();
    store.collapsedNodes();
    scheduleUiStateSave();
  });

  const selectionTone = createMemo(() =>
    selectionCount() > 0 ? statusInfo : statusMuted,
  );
  const emptyHintStyle = createMemo(() => {
    const raw = clamp(store.canvasCenter().x, -24, 24);
    return { transform: `translateX(${raw}px)` };
  });
  const selectedNodeIds = createMemo(() =>
    Array.from(store.selectedNodes()).sort((left, right) =>
      left.localeCompare(right),
    ),
  );
  const selectedFrameIds = createMemo(() =>
    Array.from(store.selectedFrames()).sort((left, right) =>
      left.localeCompare(right),
    ),
  );
  const selectedWireIds = createMemo(() =>
    Array.from(store.selectedWires()).sort((left, right) =>
      left.localeCompare(right),
    ),
  );
  const selectedNode = createMemo(() => {
    const ids = selectedNodeIds();
    if (ids.length !== 1) {
      return null;
    }
    return store.graph().nodes.get(ids[0]) ?? null;
  });
  const selectedNodeEntry = createMemo(() => {
    const node = selectedNode();
    return node ? (getNodeCatalogEntry(node.type) ?? null) : null;
  });
  const selectedSubgraphNode = createMemo(() => {
    const node = selectedNode();
    return node?.type === SUBGRAPH_NODE_TYPE ? node : null;
  });
  const selectedSubgraphParams = createMemo(() => {
    const node = selectedSubgraphNode();
    if (!node) {
      return null;
    }
    return parseSubgraphParams(node.params);
  });
  type SubgraphSocketRow = Readonly<{ socket: GraphSocket; index: number }>;
  const subgraphInputRows = createMemo<SubgraphSocketRow[]>(() => {
    const node = selectedSubgraphNode();
    const params = selectedSubgraphParams();
    if (!node || !params) {
      return [];
    }
    const graphSnapshot = store.graph();
    const rows: SubgraphSocketRow[] = [];
    node.inputs.forEach((socketId, index) => {
      const socket = graphSnapshot.sockets.get(socketId);
      if (socket) {
        rows.push({ socket, index });
      }
    });
    return rows;
  });
  const subgraphOutputRows = createMemo<SubgraphSocketRow[]>(() => {
    const node = selectedSubgraphNode();
    const params = selectedSubgraphParams();
    if (!node || !params) {
      return [];
    }
    const graphSnapshot = store.graph();
    const rows: SubgraphSocketRow[] = [];
    node.outputs.forEach((socketId, index) => {
      const socket = graphSnapshot.sockets.get(socketId);
      if (socket) {
        rows.push({ socket, index });
      }
    });
    return rows;
  });
  type SubgraphOverrideNode = Readonly<{
    node: GraphNode;
    label: string;
    schema: ParamSchemaDefinition;
    overrides?: JsonObject;
  }>;
  const subgraphOverrideNodes = createMemo<SubgraphOverrideNode[]>(() => {
    const params = selectedSubgraphParams();
    if (!params) {
      return [];
    }
    return params.graph.nodes.flatMap((node) => {
      const entry = getNodeCatalogEntry(node.type);
      if (!entry?.paramSchema) {
        return [];
      }
      return [
        {
          node,
          label: entry.label ?? node.type,
          schema: entry.paramSchema,
          overrides: params.overrides?.[node.id],
        },
      ];
    });
  });
  const subgraphOverrideCount = createMemo(() => {
    const params = selectedSubgraphParams();
    if (!params?.overrides) {
      return 0;
    }
    let count = 0;
    for (const overrides of Object.values(params.overrides)) {
      count += Object.keys(overrides).length;
    }
    return count;
  });
  const selectedNodeLabel = createMemo(() => {
    const ids = selectedNodeIds();
    if (ids.length === 0) {
      return null;
    }
    if (ids.length > 1) {
      return `${ids.length} nodes`;
    }
    const node = selectedNode();
    if (!node) {
      return "Node";
    }
    return selectedNodeEntry()?.label ?? node.type;
  });
  const selectionSummary = createMemo(() => {
    const nodeCount = selectedNodeIds().length;
    const frameCount = selectedFrameIds().length;
    const wireCount = selectedWireIds().length;
    if (nodeCount === 1 && frameCount === 0 && wireCount === 0) {
      return selectedNodeLabel() ?? "1 node";
    }
    const parts: string[] = [];
    if (nodeCount > 0) {
      parts.push(`${nodeCount} node${nodeCount === 1 ? "" : "s"}`);
    }
    if (frameCount > 0) {
      parts.push(`${frameCount} frame${frameCount === 1 ? "" : "s"}`);
    }
    if (wireCount > 0) {
      parts.push(`${wireCount} wire${wireCount === 1 ? "" : "s"}`);
    }
    if (parts.length > 0) {
      return parts.join(", ");
    }
    return "No selection";
  });
  const selectedOutputNode = createMemo(() => {
    const node = selectedNode();
    return node && isOutputNodeType(node.type) ? node : null;
  });
  const selectedOutputType = createMemo<OutputNodeType | null>(() => {
    const node = selectedOutputNode();
    return node ? node.type : null;
  });
  const selectedOutputSocketId = createMemo(() => {
    const node = selectedOutputNode();
    return node?.outputs[0] ?? null;
  });
  const isSingleSelection = createMemo(() => selectedNodeIds().length === 1);
  const isBypassedSelection = createMemo(() => {
    if (!isSingleSelection()) {
      return false;
    }
    const node = selectedNode();
    if (!node) {
      return false;
    }
    return store.bypassedNodes().has(node.id);
  });
  const isCollapsedSelection = createMemo(() => {
    if (!isSingleSelection()) {
      return false;
    }
    const node = selectedNode();
    if (!node) {
      return false;
    }
    return store.collapsedNodes().has(node.id);
  });
  const isSelectedDirty = createMemo(() => {
    const node = selectedNode();
    if (!node) {
      return false;
    }
    return store.dirtyState().dirty.has(node.id);
  });
  const selectedNodeErrors = createMemo(() => {
    const node = selectedNode();
    if (!node) {
      return [];
    }
    return store.dirtyState().nodeErrors.get(node.id) ?? [];
  });
  const outputStatusTone = createMemo(() => {
    switch (outputStatus()) {
      case "running":
        return sidePanelInfo;
      case "ready":
        return sidePanelSuccess;
      case "error":
        return sidePanelDanger;
      default:
        return sidePanelMuted;
    }
  });
  const outputLabel = createMemo(() => {
    const artifact = outputArtifact();
    if (artifact) {
      return artifact.label;
    }
    const entry = selectedNodeEntry();
    return entry?.label ?? selectedOutputType() ?? "Output";
  });

  const collectNodeSockets = (node: GraphNode): GraphSocket[] | null => {
    const graphSnapshot = store.graph();
    const sockets: GraphSocket[] = [];
    for (const socketId of [...node.inputs, ...node.outputs]) {
      const socket = graphSnapshot.sockets.get(socketId);
      if (!socket) {
        return null;
      }
      sockets.push(socket);
    }
    return sockets;
  };

  const getSocketTypeLabel = (typeId: SocketTypeId): string =>
    getSocketTypeMetadata(typeId)?.label ?? typeId;

  const buildSubgraphParamsForNode = (
    node: GraphNode,
    inputs: ReadonlyArray<GraphSocket>,
    outputs: ReadonlyArray<GraphSocket>,
  ) => {
    const params = selectedSubgraphParams();
    if (!params) {
      return null;
    }
    const inputsByKey = new Map(
      params.inputs.map((entry) => [entry.key, entry]),
    );
    const outputsByKey = new Map(
      params.outputs.map((entry) => [entry.key, entry]),
    );
    const nextInputs = inputs.flatMap((socket) => {
      const entry = inputsByKey.get(socket.name);
      if (!entry) {
        return [];
      }
      return [{ ...entry, key: socket.name }];
    });
    const nextOutputs = outputs.flatMap((socket) => {
      const entry = outputsByKey.get(socket.name);
      if (!entry) {
        return [];
      }
      return [{ ...entry, key: socket.name }];
    });
    if (nextInputs.length !== inputs.length) {
      return null;
    }
    if (nextOutputs.length !== outputs.length) {
      return null;
    }
    return {
      ...params,
      inputs: nextInputs,
      outputs: nextOutputs,
    };
  };

  const buildSubgraphInstanceSocketMap = (
    params: SubgraphNodeParams,
    sockets: ReadonlyArray<GraphSocket>,
  ): {
    inputMap: Map<NodeId, GraphSocket>;
    outputMap: Map<SocketId, GraphSocket>;
  } | null => {
    const inputMap = new Map<NodeId, GraphSocket>();
    const outputMap = new Map<SocketId, GraphSocket>();
    for (const entry of params.inputs) {
      const socket = sockets.find(
        (item) => item.direction === "input" && item.name === entry.key,
      );
      if (!socket) {
        return null;
      }
      inputMap.set(entry.nodeId, socket);
    }
    for (const entry of params.outputs) {
      const socket = sockets.find(
        (item) => item.direction === "output" && item.name === entry.key,
      );
      if (!socket) {
        return null;
      }
      outputMap.set(entry.socketId, socket);
    }
    return { inputMap, outputMap };
  };

  const buildSubgraphInstanceCommand = (
    instanceNode: GraphNode,
    instanceSockets: ReadonlyArray<GraphSocket>,
    instanceParams: SubgraphNodeParams,
    definitionParams: SubgraphNodeParams,
    definitionSockets: ReadonlyArray<GraphSocket>,
  ): GraphCommand | null => {
    const socketMaps = buildSubgraphInstanceSocketMap(
      instanceParams,
      instanceSockets,
    );
    if (!socketMaps) {
      return null;
    }
    const definitionInputs = new Map<string, GraphSocket>();
    const definitionOutputs = new Map<string, GraphSocket>();
    for (const socket of definitionSockets) {
      if (socket.direction === "input") {
        definitionInputs.set(socket.name, socket);
      } else {
        definitionOutputs.set(socket.name, socket);
      }
    }
    const nextSocketsById = new Map<SocketId, GraphSocket>();
    const nextInputIds: SocketId[] = [];
    const nextOutputIds: SocketId[] = [];

    for (const entry of definitionParams.inputs) {
      const instanceSocket = socketMaps.inputMap.get(entry.nodeId);
      const definitionSocket = definitionInputs.get(entry.key);
      if (!instanceSocket || !definitionSocket) {
        return null;
      }
      nextInputIds.push(instanceSocket.id);
      nextSocketsById.set(instanceSocket.id, {
        ...instanceSocket,
        name: entry.key,
        dataType: definitionSocket.dataType,
        required: definitionSocket.required,
        defaultValue: definitionSocket.defaultValue,
        minConnections: definitionSocket.minConnections,
        maxConnections: definitionSocket.maxConnections,
      });
    }

    for (const entry of definitionParams.outputs) {
      const instanceSocket = socketMaps.outputMap.get(entry.socketId);
      const definitionSocket = definitionOutputs.get(entry.key);
      if (!instanceSocket || !definitionSocket) {
        return null;
      }
      nextOutputIds.push(instanceSocket.id);
      nextSocketsById.set(instanceSocket.id, {
        ...instanceSocket,
        name: entry.key,
        dataType: definitionSocket.dataType,
        required: definitionSocket.required,
        defaultValue: definitionSocket.defaultValue,
        minConnections: definitionSocket.minConnections,
        maxConnections: definitionSocket.maxConnections,
      });
    }

    const nextSockets = instanceSockets.map(
      (socket) => nextSocketsById.get(socket.id) ?? socket,
    );
    const nextParams: SubgraphNodeParams = {
      ...definitionParams,
      ...(instanceParams.overrides
        ? { overrides: instanceParams.overrides }
        : {}),
    };
    const nextNode: GraphNode = {
      ...instanceNode,
      inputs: nextInputIds,
      outputs: nextOutputIds,
      params: serializeSubgraphParams(nextParams),
    };

    return createUpdateNodeIoCommand(
      { node: instanceNode, sockets: instanceSockets },
      { node: nextNode, sockets: nextSockets },
    );
  };

  const commitSubgraphIoUpdate = (
    afterNode: GraphNode,
    afterSockets: ReadonlyArray<GraphSocket>,
    nextParamsOverride?: ReturnType<typeof parseSubgraphParams> | null,
  ): void => {
    const inputs = afterNode.inputs.flatMap((socketId) =>
      afterSockets.filter(
        (socket) => socket.direction === "input" && socket.id === socketId,
      ),
    );
    const outputs = afterNode.outputs.flatMap((socketId) =>
      afterSockets.filter(
        (socket) => socket.direction === "output" && socket.id === socketId,
      ),
    );
    const nextParams =
      nextParamsOverride ??
      buildSubgraphParamsForNode(afterNode, inputs, outputs);
    if (!nextParams) {
      notifyToast("Subgraph update failed", "Inputs or outputs went missing.");
      return;
    }
    const graphSnapshot = store.graph();
    const definitionGraphId = nextParams.graph.graphId;
    const commands: GraphCommand[] = [];
    for (const node of graphSnapshot.nodes.values()) {
      if (node.type !== SUBGRAPH_NODE_TYPE) {
        continue;
      }
      const params = parseSubgraphParams(node.params);
      if (!params || params.graph.graphId !== definitionGraphId) {
        continue;
      }
      const sockets = collectNodeSockets(node);
      if (!sockets) {
        continue;
      }
      const command = buildSubgraphInstanceCommand(
        node,
        sockets,
        params,
        nextParams,
        afterSockets,
      );
      if (command) {
        commands.push(command);
      }
    }
    if (commands.length === 0) {
      notifyToast(
        "Subgraph update failed",
        "Unable to sync subgraph instances.",
      );
      return;
    }
    store.beginHistoryBatch("update-subgraph-io");
    let changed = false;
    for (const command of commands) {
      if (store.applyGraphCommandTransient(command)) {
        store.recordGraphCommand(command);
        changed = true;
      }
    }
    store.commitHistoryBatch();
    if (changed) {
      store.refreshActiveOutput();
    }
  };

  const setSubgraphParamOverride = (
    targetNodeId: NodeId,
    fieldId: string,
    value: JsonValue,
  ): void => {
    const node = selectedSubgraphNode();
    const params = selectedSubgraphParams();
    if (!node || !params) {
      return;
    }
    const overrides: Record<string, JsonObject> = {
      ...(params.overrides ?? {}),
    };
    const nodeOverrides: Record<string, JsonValue> = {
      ...(overrides[targetNodeId] ?? {}),
      [fieldId]: value,
    };
    overrides[targetNodeId] = nodeOverrides;
    const nextOverrides = Object.keys(overrides).length > 0 ? overrides : null;
    store.updateNodeParam(node.id, "overrides", nextOverrides ?? null);
  };

  const resetSubgraphParamOverride = (
    targetNodeId: NodeId,
    fieldId: string,
  ): void => {
    const node = selectedSubgraphNode();
    const params = selectedSubgraphParams();
    if (!node || !params?.overrides) {
      return;
    }
    const overrides: Record<string, JsonObject> = { ...params.overrides };
    const nodeOverrides = overrides[targetNodeId];
    if (!nodeOverrides || !(fieldId in nodeOverrides)) {
      return;
    }
    const nextNodeOverrides: Record<string, JsonValue> = {
      ...nodeOverrides,
    };
    delete nextNodeOverrides[fieldId];
    if (Object.keys(nextNodeOverrides).length > 0) {
      overrides[targetNodeId] = nextNodeOverrides;
    } else {
      delete overrides[targetNodeId];
    }
    const nextOverrides = Object.keys(overrides).length > 0 ? overrides : null;
    store.updateNodeParam(node.id, "overrides", nextOverrides ?? null);
  };

  const sanitizeSocketName = (value: string): string => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "socket";
  };

  const updateSubgraphSocketName = (
    node: GraphNode,
    socketId: string,
    nextName: string,
  ): void => {
    const params = selectedSubgraphParams();
    const sockets = collectNodeSockets(node);
    if (!sockets || !params) {
      return;
    }
    const socket = sockets.find((entry) => entry.id === socketId);
    if (!socket) {
      return;
    }
    const name = sanitizeSocketName(nextName);
    if (name === socket.name) {
      return;
    }
    const duplicates = sockets.some(
      (entry) =>
        entry.id !== socket.id &&
        entry.direction === socket.direction &&
        entry.name === name,
    );
    if (duplicates) {
      notifyToast("Rename blocked", "Socket names must be unique.");
      return;
    }
    const nextSockets = sockets.map((entry) =>
      entry.id === socket.id ? { ...entry, name } : entry,
    );
    const nextParams =
      socket.direction === "input"
        ? {
            ...params,
            inputs: params.inputs.map((entry) =>
              entry.key === socket.name ? { ...entry, key: name } : entry,
            ),
          }
        : {
            ...params,
            outputs: params.outputs.map((entry) =>
              entry.key === socket.name ? { ...entry, key: name } : entry,
            ),
          };
    commitSubgraphIoUpdate({ ...node }, nextSockets, nextParams);
  };

  const updateSubgraphSocketType = (
    node: GraphNode,
    socketId: string,
    nextType: SocketTypeId,
  ): void => {
    const sockets = collectNodeSockets(node);
    if (!sockets) {
      return;
    }
    const socket = sockets.find((entry) => entry.id === socketId);
    if (!socket || socket.dataType === nextType) {
      return;
    }
    const nextSockets = sockets.map((entry) =>
      entry.id === socket.id ? { ...entry, dataType: nextType } : entry,
    );
    commitSubgraphIoUpdate({ ...node }, nextSockets);
  };

  const updateSubgraphSocketRequired = (
    node: GraphNode,
    socketId: string,
    required: boolean,
  ): void => {
    const sockets = collectNodeSockets(node);
    if (!sockets) {
      return;
    }
    const socket = sockets.find((entry) => entry.id === socketId);
    if (!socket || socket.required === required) {
      return;
    }
    const nextSockets = sockets.map((entry) =>
      entry.id === socket.id ? { ...entry, required } : entry,
    );
    commitSubgraphIoUpdate({ ...node }, nextSockets);
  };

  const updateSubgraphSocketDefault = (
    node: GraphNode,
    socketId: string,
    value: JsonValue | undefined,
  ): void => {
    const sockets = collectNodeSockets(node);
    if (!sockets) {
      return;
    }
    const socket = sockets.find((entry) => entry.id === socketId);
    if (!socket) {
      return;
    }
    const nextSockets = sockets.map((entry) =>
      entry.id === socket.id ? { ...entry, defaultValue: value } : entry,
    );
    commitSubgraphIoUpdate({ ...node }, nextSockets);
  };

  const updateSubgraphSocketOrder = (
    node: GraphNode,
    direction: "input" | "output",
    fromIndex: number,
    toIndex: number,
  ): void => {
    const list = direction === "input" ? node.inputs : node.outputs;
    if (fromIndex === toIndex) {
      return;
    }
    const nextList = [...list];
    const [moved] = nextList.splice(fromIndex, 1);
    if (!moved) {
      return;
    }
    nextList.splice(toIndex, 0, moved);
    const sockets = collectNodeSockets(node);
    if (!sockets) {
      return;
    }
    const nextNode =
      direction === "input"
        ? { ...node, inputs: nextList }
        : { ...node, outputs: nextList };
    commitSubgraphIoUpdate(nextNode, sockets);
  };

  const parseDefaultValue = (
    typeId: SocketTypeId,
    raw: string,
  ): JsonValue | undefined => {
    if (raw.trim() === "") {
      return undefined;
    }
    if (typeId === "float") {
      const value = Number.parseFloat(raw);
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeId === "int") {
      const value = Number.parseInt(raw, 10);
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeId === "bool") {
      return raw.trim().toLowerCase() === "true";
    }
    try {
      return JSON.parse(raw) as JsonValue;
    } catch {
      return undefined;
    }
  };

  const formatDefaultValue = (value: JsonValue | undefined): string => {
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return JSON.stringify(value);
  };

  const applyDefaultInput = (
    node: GraphNode,
    socket: GraphSocket,
    raw: string,
  ): void => {
    const nextValue = parseDefaultValue(socket.dataType, raw);
    if (nextValue === undefined && raw.trim().length > 0) {
      notifyToast("Invalid default", "Use a compatible value.");
      return;
    }
    updateSubgraphSocketDefault(node, socket.id, nextValue);
  };

  let lastOutputError: string | null = null;

  const requestOutputNow = (): void => {
    const socketId = selectedOutputSocketId();
    if (!socketId) {
      return;
    }
    setOutputStatus("running");
    setOutputMessage(null);
    store.requestOutput(socketId);
  };

  const downloadOutput = (): void => {
    const artifact = outputArtifact();
    if (!artifact) {
      return;
    }
    const error = downloadOutputArtifact(artifact);
    if (error) {
      notifyToast("Download failed", error);
    }
  };

  const exportGraph = (): void => {
    const document = graphToDocumentV1(store.graph());
    const payload = graphDocumentToJson(document);
    const filename = `shadr-${document.graphId}.json`;
    const error = downloadTextFile(filename, payload);
    if (error) {
      notifyToast("Export failed", error);
      return;
    }
    notifyToast("Export ready", "Graph JSON downloaded.");
  };

  const triggerImport = (): void => {
    if (importInput) {
      importInput.value = "";
      importInput.click();
    }
  };

  const handleImportFile = async (event: Event): Promise<void> => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    target.value = "";
    try {
      const text = await file.text();
      const result = parseGraphDocumentJson(text);
      if (!result.ok) {
        notifyToast("Import failed", formatGraphImportError(result.error));
        return;
      }
      const loaded = store.loadGraphDocument(result.document);
      if (!loaded) {
        notifyToast("Import failed", "Graph document was invalid.");
        return;
      }
      initializeNavigation();
      notifyToast(
        "Graph imported",
        `${result.document.nodes.length} nodes loaded.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to read file.";
      notifyToast("Import failed", message);
    }
  };

  createEffect(() => {
    const socketId = selectedOutputSocketId();
    if (!socketId) {
      store.clearOutput();
      setOutputStatus("idle");
      setOutputArtifact(null);
      setOutputMessage(null);
      lastOutputError = null;
      return;
    }
    requestOutputNow();
  });

  createEffect(() => {
    const outputType = selectedOutputType();
    if (!outputType) {
      return;
    }
    const execError = store.outputError();
    if (execError) {
      const message = formatExecError(execError);
      setOutputStatus("error");
      setOutputMessage(message);
      setOutputArtifact(null);
      if (message !== lastOutputError) {
        notifyToast("Output error", message);
        lastOutputError = message;
      }
      return;
    }
    const result = compileOutputArtifact(outputType, store.outputValue());
    if (result.error) {
      setOutputStatus("error");
      setOutputMessage(result.error);
      setOutputArtifact(null);
      if (result.error !== lastOutputError) {
        notifyToast("Output error", result.error);
        lastOutputError = result.error;
      }
      return;
    }
    setOutputStatus("ready");
    setOutputMessage(null);
    setOutputArtifact(result.artifact);
    lastOutputError = null;
  });

  const applyCommands = (label: string, commands: GraphCommand[]): boolean => {
    if (commands.length === 0) {
      return false;
    }
    store.beginHistoryBatch(label);
    let changed = false;
    for (const command of commands) {
      if (store.applyGraphCommandTransient(command)) {
        store.recordGraphCommand(command);
        changed = true;
      }
    }
    store.commitHistoryBatch();
    if (changed) {
      store.refreshActiveOutput();
    }
    return changed;
  };

  const deleteSelection = (): void => {
    const graphSnapshot = store.graph();
    const nodeCommands = selectedNodeIds()
      .map((nodeId) => createRemoveNodeCommand(graphSnapshot, nodeId))
      .filter((command): command is NonNullable<typeof command> => !!command);
    const frameCommands = selectedFrameIds()
      .map((frameId) => createRemoveFrameCommand(graphSnapshot, frameId))
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
    const wireCommands = selectedWireIds()
      .filter((wireId) => !removedWireIds.has(wireId))
      .map((wireId) => createRemoveWireCommand(graphSnapshot, wireId))
      .filter((command): command is NonNullable<typeof command> => !!command);
    const commands = [...nodeCommands, ...frameCommands, ...wireCommands];
    if (applyCommands("delete-selection", commands)) {
      store.clearSelection();
    }
  };
  const toggleBypassSelection = (): void => {
    const ids = selectedNodeIds();
    if (ids.length === 0) {
      return;
    }
    store.toggleBypassNodes(new Set<NodeId>(ids));
  };
  const toggleCollapseSelection = (): void => {
    const ids = selectedNodeIds();
    if (ids.length === 0) {
      return;
    }
    store.toggleCollapsedNodes(new Set<NodeId>(ids));
  };
  const clearSelection = (): void => {
    store.clearSelection();
  };

  const commandPaletteEntries = createMemo<CommandPaletteEntry[]>(() => {
    const settingsSnapshot = store.settings();
    const hasSelection = selectionCount() > 0;
    const hasNodeSelection = selectedNodeIds().length > 0;

    const commandEntries: CommandPaletteEntry[] = [
      {
        id: "command:undo",
        label: "Undo",
        description: "Revert the last change",
        kind: "command",
        keywords: ["history"],
        onSelect: () => store.undo(),
      },
      {
        id: "command:redo",
        label: "Redo",
        description: "Reapply the last change",
        kind: "command",
        keywords: ["history"],
        onSelect: () => store.redo(),
      },
      {
        id: "command:delete-selection",
        label: "Delete selection",
        description: "Remove selected nodes, frames, or wires",
        kind: "command",
        enabled: hasSelection,
        keywords: ["remove", "delete"],
        onSelect: () => deleteSelection(),
      },
      {
        id: "command:clear-selection",
        label: "Clear selection",
        description: "Deselect all items",
        kind: "command",
        enabled: hasSelection,
        keywords: ["deselect", "clear"],
        onSelect: () => clearSelection(),
      },
      {
        id: "command:toggle-bypass",
        label: "Toggle bypass",
        description: "Bypass selected nodes",
        kind: "command",
        enabled: hasNodeSelection,
        keywords: ["bypass", "node"],
        onSelect: () => toggleBypassSelection(),
      },
      {
        id: "command:toggle-collapse",
        label: "Toggle collapse",
        description: "Collapse selected nodes",
        kind: "command",
        enabled: hasNodeSelection,
        keywords: ["collapse", "node"],
        onSelect: () => toggleCollapseSelection(),
      },
      {
        id: "command:collapse-subgraph",
        label: "Collapse to subgraph",
        description: "Wrap selected nodes as a subgraph",
        kind: "command",
        enabled: hasNodeSelection,
        keywords: ["subgraph", "collapse", "group"],
        onSelect: () => handleCollapseSubgraph(),
      },
    ];

    const controlEntries: CommandPaletteEntry[] = [
      {
        id: "control:grid-visibility",
        label: "Grid visibility",
        description: "Show or hide the canvas grid",
        kind: "control",
        stateLabel: settingsSnapshot.gridVisible ? "On" : "Off",
        keywords: ["grid", "visibility"],
        onSelect: () =>
          store.updateSettings({
            gridVisible: !store.settings().gridVisible,
          }),
      },
      {
        id: "control:snap-to-grid",
        label: "Snap to grid",
        description: "Toggle snap-to-grid placement",
        kind: "control",
        stateLabel: settingsSnapshot.snapToGrid ? "On" : "Off",
        keywords: ["grid", "snap"],
        onSelect: () =>
          store.updateSettings({
            snapToGrid: !store.settings().snapToGrid,
          }),
      },
      {
        id: "control:wire-hover-labels",
        label: "Wire hover labels",
        description: "Show wire type/value labels on hover",
        kind: "control",
        stateLabel: settingsSnapshot.wireHoverLabels ? "On" : "Off",
        keywords: ["wire", "hover", "label", "value"],
        onSelect: () =>
          store.updateSettings({
            wireHoverLabels: !store.settings().wireHoverLabels,
          }),
      },
    ];

    const nodeEntries: CommandPaletteEntry[] = NODE_CATALOG.map((entry) => {
      const keywords = [entry.type, entry.label, entry.description].filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      );
      return {
        id: `node:${entry.type}`,
        label: entry.label,
        description: entry.description,
        kind: "node",
        keywords,
        onSelect: () => {
          const pointer = store.pointerPosition();
          store.addNodeAt(entry.type, pointer?.world);
        },
      };
    });

    return [...commandEntries, ...controlEntries, ...nodeEntries];
  });

  return (
    <main class="relative h-screen w-screen overflow-hidden bg-[color:var(--app-bg)] text-[color:var(--app-text)]">
      <div class="absolute inset-0">
        <EditorCanvas
          store={store}
          onViewportEmpty={notifyViewportEmpty}
          onDiveIntoSubgraph={navigateToSubgraph}
          onCollapseSelectionToSubgraph={handleCollapseSubgraph}
        />
      </div>

      <div class={overlayRoot}>
        <div class="absolute left-3 top-3 flex items-center gap-2">
          <div class={appBadge}>
            <Sparkles class="h-4 w-4 text-[color:var(--status-info-text)]" />
            <span class="sr-only">Shadr</span>
          </div>
          <button
            class={`${historyButtonBase} ${
              canNavigateBack() ? historyButtonActive : historyButtonDisabled
            }`}
            disabled={!canNavigateBack()}
            onClick={() => navigateHistory("back")}
            aria-label="Back"
          >
            <ArrowLeft class="h-3 w-3" />
            <span class="sr-only">Back</span>
          </button>
          <button
            class={`${historyButtonBase} ${
              canNavigateForward() ? historyButtonActive : historyButtonDisabled
            }`}
            disabled={!canNavigateForward()}
            onClick={() => navigateHistory("forward")}
            aria-label="Forward"
          >
            <ArrowRight class="h-3 w-3" />
            <span class="sr-only">Forward</span>
          </button>
          <div class={breadcrumbRoot} aria-label="Graph path">
            <For each={graphPath()}>
              {(entry, index) => {
                const isCurrent = () => index() === graphPath().length - 1;
                return (
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      class={`${breadcrumbItem} ${
                        isCurrent()
                          ? breadcrumbItemDisabled
                          : breadcrumbItemActive
                      }`}
                      disabled={isCurrent()}
                      aria-current={isCurrent() ? "page" : undefined}
                      onClick={() => {
                        if (!isCurrent()) {
                          navigateToBreadcrumb(index());
                        }
                      }}
                    >
                      {entry.label}
                    </button>
                    {index() < graphPath().length - 1 ? (
                      <ChevronRight class={`h-3 w-3 ${breadcrumbSeparator}`} />
                    ) : null}
                  </div>
                );
              }}
            </For>
          </div>
          <button
            class={`${historyButtonBase} ${
              store.canUndo() ? historyButtonActive : historyButtonDisabled
            }`}
            disabled={!store.canUndo()}
            onClick={() => store.undo()}
            aria-label="Undo"
          >
            <Undo2 class="h-3 w-3" />
            <span class="sr-only">Undo</span>
          </button>
          <button
            class={`${historyButtonBase} ${
              store.canRedo() ? historyButtonActive : historyButtonDisabled
            }`}
            disabled={!store.canRedo()}
            onClick={() => store.redo()}
            aria-label="Redo"
          >
            <Redo2 class="h-3 w-3" />
            <span class="sr-only">Redo</span>
          </button>
        </div>

        <div class="absolute bottom-4 left-3 flex flex-wrap items-center gap-2">
          {autosaveStatus() === "saving" ? (
            <span class={`${statusBase} ${statusInfo}`}>Saving</span>
          ) : null}
          {autosaveStatus() === "saved" ? (
            <span class={`${statusBase} ${statusSuccess}`}>Saved</span>
          ) : null}
          {autosaveStatus() === "error" ? (
            <span class={`${statusBase} ${statusDanger}`}>Save failed</span>
          ) : null}
          {outputStatus() === "running" ? (
            <span class={`${statusBase} ${statusInfo}`}>Compiling</span>
          ) : null}
          {outputStatus() === "ready" ? (
            <span class={`${statusBase} ${statusSuccess}`}>Result ready</span>
          ) : null}
          {outputStatus() === "error" ? (
            <span class={`${statusBase} ${statusDanger}`}>Output error</span>
          ) : null}
          {isDirtyGraph() ? (
            <span class={`${statusBase} ${statusWarn}`}>
              <CircleDot class="h-3 w-3" />
              Dirty
            </span>
          ) : null}
          {selectionCount() > 0 ? (
            <span class={`${statusBase} ${selectionTone()}`}>
              {selectionCount()} selected
            </span>
          ) : null}
        </div>

        {isEmptyGraph() ? (
          <div
            class={`${statusBase} ${statusMuted} absolute bottom-24 left-1/2 -translate-x-1/2`}
            style={emptyHintStyle()}
          >
            Double-click to add
          </div>
        ) : null}

        <div class="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div class={controlMenuRoot}>
            {selectionCount() > 0 ? (
              <>
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class={controlMenuTitle}>Selection</span>
                    <span class={controlMenuValue}>{selectionSummary()}</span>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    {selectedNodeIds().length > 0 ? (
                      <>
                        <button
                          class={`${controlMenuButton} ${
                            isBypassedSelection()
                              ? controlMenuWarn
                              : controlMenuMuted
                          }`}
                          onClick={toggleBypassSelection}
                        >
                          <EyeOff class="h-3.5 w-3.5" />
                          Bypass
                        </button>
                        <button
                          class={`${controlMenuButton} ${
                            isCollapsedSelection()
                              ? controlMenuInfo
                              : controlMenuMuted
                          }`}
                          onClick={toggleCollapseSelection}
                        >
                          <Minimize2 class="h-3.5 w-3.5" />
                          Collapse
                        </button>
                      </>
                    ) : null}
                    <button
                      class={`${controlMenuButton} ${controlMenuDanger}`}
                      onClick={deleteSelection}
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                      Delete
                    </button>
                    <button
                      class={`${controlMenuButton} ${controlMenuMuted}`}
                      onClick={clearSelection}
                    >
                      <X class="h-3.5 w-3.5" />
                      Clear
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class={controlMenuTitle}>Workspace</span>
                    <span class={controlMenuValue}>No selection</span>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      class={`${controlMenuButton} ${controlMenuMuted}`}
                      onClick={triggerImport}
                    >
                      Import
                    </button>
                    <button
                      class={`${controlMenuButton} ${controlMenuInfo}`}
                      onClick={exportGraph}
                    >
                      Export
                    </button>
                    <button
                      class={`${controlMenuButton} ${controlMenuMuted}`}
                      onClick={() => store.setCommandPaletteOpen(true)}
                    >
                      Commands
                    </button>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class={controlMenuTitle}>Settings</span>
                  <button
                    class={`${controlMenuButton} ${
                      gridVisible() ? controlMenuInfo : controlMenuMuted
                    }`}
                    onClick={() =>
                      store.updateSettings({
                        gridVisible: !store.settings().gridVisible,
                      })
                    }
                  >
                    Grid {gridVisible() ? "On" : "Off"}
                  </button>
                  <button
                    class={`${controlMenuButton} ${
                      snapToGrid() ? controlMenuInfo : controlMenuMuted
                    }`}
                    onClick={() =>
                      store.updateSettings({
                        snapToGrid: !store.settings().snapToGrid,
                      })
                    }
                  >
                    Snap {snapToGrid() ? "On" : "Off"}
                  </button>
                  <button
                    class={`${controlMenuButton} ${
                      wireHoverLabels() ? controlMenuInfo : controlMenuMuted
                    }`}
                    onClick={() =>
                      store.updateSettings({
                        wireHoverLabels: !store.settings().wireHoverLabels,
                      })
                    }
                  >
                    Wire Labels {wireHoverLabels() ? "On" : "Off"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <input
          ref={(element) => {
            importInput = element;
          }}
          class="hidden"
          type="file"
          accept="application/json"
          onChange={handleImportFile}
        />

        {selectionCount() > 0 ? (
          <aside class="absolute right-3 top-1/2 -translate-y-1/2">
            <div class={sidePanelRoot}>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <Sparkles class="h-3.5 w-3.5 text-[color:var(--status-info-text)]" />
                  <span class={sidePanelTitle}>Context</span>
                </div>
                <span class={`${sidePanelChip} ${sidePanelInfo}`}>
                  {selectionCount()} selected
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                {selectedNodeIds().length > 0 ? (
                  <span class={`${sidePanelChip} ${sidePanelInfo}`}>
                    {selectedNodeIds().length} nodes
                  </span>
                ) : null}
                {selectedFrameIds().length > 0 ? (
                  <span class={`${sidePanelChip} ${sidePanelInfo}`}>
                    {selectedFrameIds().length} frames
                  </span>
                ) : null}
                {selectedWireIds().length > 0 ? (
                  <span class={`${sidePanelChip} ${sidePanelInfo}`}>
                    {selectedWireIds().length} wires
                  </span>
                ) : null}
              </div>

              {selectedNode() ? (
                <div class="flex flex-col gap-2">
                  <div class="flex items-center gap-2">
                    <CircleDot class="h-3.5 w-3.5 text-[color:var(--status-info-text)]" />
                    <span class={sidePanelTitle}>Node</span>
                  </div>
                  <div class={sidePanelValue}>{selectedNodeLabel()}</div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span
                      class={`${sidePanelChip} ${
                        isSelectedDirty() ? sidePanelWarn : sidePanelInfo
                      }`}
                    >
                      {isSelectedDirty() ? "Dirty" : "Clean"}
                    </span>
                    <span
                      class={`${sidePanelChip} ${
                        selectedNodeErrors().length > 0
                          ? sidePanelDanger
                          : sidePanelMuted
                      }`}
                    >
                      {selectedNodeErrors().length > 0
                        ? `${selectedNodeErrors().length} errors`
                        : "No errors"}
                    </span>
                    {isBypassedSelection() ? (
                      <span class={`${sidePanelChip} ${sidePanelWarn}`}>
                        Bypassed
                      </span>
                    ) : null}
                    {isCollapsedSelection() ? (
                      <span class={`${sidePanelChip} ${sidePanelInfo}`}>
                        Collapsed
                      </span>
                    ) : null}
                  </div>

                  {selectedOutputType() ? (
                    <div class="flex flex-col gap-2">
                      <div class="flex items-center gap-2">
                        <Sparkles class="h-3.5 w-3.5 text-[color:var(--status-info-text)]" />
                        <span class={sidePanelTitle}>Output</span>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
                        <span class={`${sidePanelChip} ${outputStatusTone()}`}>
                          {outputStatus() === "running"
                            ? "Compiling"
                            : outputStatus() === "ready"
                              ? "Ready"
                              : outputStatus() === "error"
                                ? "Error"
                                : "Idle"}
                        </span>
                        <span class={`${sidePanelChip} ${sidePanelMuted}`}>
                          {outputLabel()}
                        </span>
                      </div>
                      {outputMessage() ? (
                        <div class={`${sidePanelRow} ${sidePanelDanger}`}>
                          <span class="truncate">{outputMessage()}</span>
                        </div>
                      ) : null}
                      {outputArtifact() ? (
                        <div class="flex flex-col gap-2">
                          {outputArtifact()!.kind === "image" ? (
                            <img
                              class="h-28 w-full rounded-lg border border-[color:var(--border-soft)] object-cover"
                              src={outputArtifact()!.dataUrl}
                              alt="Output preview"
                            />
                          ) : (
                            <pre class="max-h-32 overflow-auto rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-panel-muted)] p-2 text-[0.75rem] text-[color:var(--text-soft)]">
                              {outputArtifact()!.text}
                            </pre>
                          )}
                        </div>
                      ) : null}
                      <div class="flex flex-wrap items-center gap-2">
                        <button
                          class={`${controlMenuButton} ${controlMenuInfo}`}
                          onClick={requestOutputNow}
                        >
                          Compile
                        </button>
                        <button
                          class={`${controlMenuButton} ${controlMenuMuted}`}
                          onClick={downloadOutput}
                          disabled={!outputArtifact()}
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {selectedSubgraphNode() ? (
                    <div class="flex flex-col gap-2">
                      <div class="flex items-center gap-2">
                        <Sparkles class="h-3.5 w-3.5 text-[color:var(--status-info-text)]" />
                        <span class={sidePanelTitle}>Subgraph I/O</span>
                      </div>
                      {!selectedSubgraphParams() ? (
                        <div class={`${sidePanelRow} ${sidePanelDanger}`}>
                          Subgraph params missing
                        </div>
                      ) : (
                        <>
                          <div class="flex items-center justify-between">
                            <span class={sidePanelTitle}>Inputs</span>
                            <span class={`${sidePanelChip} ${sidePanelMuted}`}>
                              {subgraphInputRows().length}
                            </span>
                          </div>
                          <For each={subgraphInputRows()}>
                            {(row) => (
                              <div class={ioPanel}>
                                <div class="flex items-center justify-between gap-2">
                                  <input
                                    class={ioInput}
                                    value={row.socket.name}
                                    onChange={(event) => {
                                      const node = selectedSubgraphNode();
                                      if (!node) {
                                        return;
                                      }
                                      updateSubgraphSocketName(
                                        node,
                                        row.socket.id,
                                        event.currentTarget.value,
                                      );
                                    }}
                                  />
                                  <div class="flex items-center gap-1">
                                    <button
                                      class={`${controlMenuButton} ${controlMenuMuted}`}
                                      disabled={row.index === 0}
                                      onClick={() => {
                                        const node = selectedSubgraphNode();
                                        if (!node) {
                                          return;
                                        }
                                        updateSubgraphSocketOrder(
                                          node,
                                          "input",
                                          row.index,
                                          row.index - 1,
                                        );
                                      }}
                                    >
                                      Up
                                    </button>
                                    <button
                                      class={`${controlMenuButton} ${controlMenuMuted}`}
                                      disabled={
                                        row.index ===
                                        subgraphInputRows().length - 1
                                      }
                                      onClick={() => {
                                        const node = selectedSubgraphNode();
                                        if (!node) {
                                          return;
                                        }
                                        updateSubgraphSocketOrder(
                                          node,
                                          "input",
                                          row.index,
                                          row.index + 1,
                                        );
                                      }}
                                    >
                                      Down
                                    </button>
                                  </div>
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                  <div class="flex flex-col gap-1">
                                    <span class={ioLabel}>Type</span>
                                    <select
                                      class={ioSelect}
                                      value={row.socket.dataType}
                                      onChange={(event) => {
                                        const node = selectedSubgraphNode();
                                        if (!node) {
                                          return;
                                        }
                                        updateSubgraphSocketType(
                                          node,
                                          row.socket.id,
                                          event.currentTarget
                                            .value as SocketTypeId,
                                        );
                                      }}
                                    >
                                      <For each={SOCKET_TYPE_PRIMITIVES}>
                                        {(typeId) => (
                                          <option value={typeId}>
                                            {getSocketTypeLabel(typeId)}
                                          </option>
                                        )}
                                      </For>
                                    </select>
                                  </div>
                                  <div class="flex flex-col gap-1">
                                    <span class={ioLabel}>Required</span>
                                    <label class="flex items-center gap-2 text-[0.7rem] text-[color:var(--text-strong)]">
                                      <input
                                        type="checkbox"
                                        checked={row.socket.required}
                                        onChange={(event) => {
                                          const node = selectedSubgraphNode();
                                          if (!node) {
                                            return;
                                          }
                                          updateSubgraphSocketRequired(
                                            node,
                                            row.socket.id,
                                            event.currentTarget.checked,
                                          );
                                        }}
                                      />
                                      Required
                                    </label>
                                  </div>
                                  <div class="col-span-2 flex flex-col gap-1">
                                    <span class={ioLabel}>Default</span>
                                    {row.socket.dataType === "bool" ? (
                                      <label class="flex items-center gap-2 text-[0.7rem] text-[color:var(--text-strong)]">
                                        <input
                                          type="checkbox"
                                          checked={
                                            row.socket.defaultValue === true
                                          }
                                          onChange={(event) => {
                                            const node = selectedSubgraphNode();
                                            if (!node) {
                                              return;
                                            }
                                            updateSubgraphSocketDefault(
                                              node,
                                              row.socket.id,
                                              event.currentTarget.checked,
                                            );
                                          }}
                                        />
                                        True
                                      </label>
                                    ) : (
                                      <input
                                        class={ioInput}
                                        value={formatDefaultValue(
                                          row.socket.defaultValue,
                                        )}
                                        placeholder="(none)"
                                        onChange={(event) => {
                                          const node = selectedSubgraphNode();
                                          if (!node) {
                                            return;
                                          }
                                          applyDefaultInput(
                                            node,
                                            row.socket,
                                            event.currentTarget.value,
                                          );
                                        }}
                                      />
                                    )}
                                    <button
                                      class={`${controlMenuButton} ${controlMenuMuted}`}
                                      disabled={
                                        row.socket.defaultValue === undefined
                                      }
                                      onClick={() => {
                                        const node = selectedSubgraphNode();
                                        if (!node) {
                                          return;
                                        }
                                        updateSubgraphSocketDefault(
                                          node,
                                          row.socket.id,
                                          undefined,
                                        );
                                      }}
                                    >
                                      Clear default
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </For>

                          <div class="flex items-center justify-between">
                            <span class={sidePanelTitle}>Outputs</span>
                            <span class={`${sidePanelChip} ${sidePanelMuted}`}>
                              {subgraphOutputRows().length}
                            </span>
                          </div>
                          <For each={subgraphOutputRows()}>
                            {(row) => (
                              <div class={ioPanel}>
                                <div class="flex items-center justify-between gap-2">
                                  <input
                                    class={ioInput}
                                    value={row.socket.name}
                                    onChange={(event) => {
                                      const node = selectedSubgraphNode();
                                      if (!node) {
                                        return;
                                      }
                                      updateSubgraphSocketName(
                                        node,
                                        row.socket.id,
                                        event.currentTarget.value,
                                      );
                                    }}
                                  />
                                  <div class="flex items-center gap-1">
                                    <button
                                      class={`${controlMenuButton} ${controlMenuMuted}`}
                                      disabled={row.index === 0}
                                      onClick={() => {
                                        const node = selectedSubgraphNode();
                                        if (!node) {
                                          return;
                                        }
                                        updateSubgraphSocketOrder(
                                          node,
                                          "output",
                                          row.index,
                                          row.index - 1,
                                        );
                                      }}
                                    >
                                      Up
                                    </button>
                                    <button
                                      class={`${controlMenuButton} ${controlMenuMuted}`}
                                      disabled={
                                        row.index ===
                                        subgraphOutputRows().length - 1
                                      }
                                      onClick={() => {
                                        const node = selectedSubgraphNode();
                                        if (!node) {
                                          return;
                                        }
                                        updateSubgraphSocketOrder(
                                          node,
                                          "output",
                                          row.index,
                                          row.index + 1,
                                        );
                                      }}
                                    >
                                      Down
                                    </button>
                                  </div>
                                </div>
                                <div class="flex flex-col gap-1">
                                  <span class={ioLabel}>Type</span>
                                  <div class={ioInput}>
                                    {getSocketTypeLabel(row.socket.dataType)}
                                  </div>
                                </div>
                              </div>
                            )}
                          </For>

                          <div class="flex items-center justify-between">
                            <span class={sidePanelTitle}>
                              Instance Overrides
                            </span>
                            <span
                              class={`${sidePanelChip} ${
                                subgraphOverrideCount() > 0
                                  ? sidePanelInfo
                                  : sidePanelMuted
                              }`}
                            >
                              {subgraphOverrideCount()} overrides
                            </span>
                          </div>
                          {subgraphOverrideNodes().length === 0 ? (
                            <div class={`${sidePanelRow} ${sidePanelMuted}`}>
                              No overrideable params
                            </div>
                          ) : (
                            <SubgraphParamOverrides
                              nodes={subgraphOverrideNodes()}
                              onOverrideChange={setSubgraphParamOverride}
                              onOverrideReset={resetSubgraphParamOverride}
                            />
                          )}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      <Toast.Region class={toastRegion} duration={4200} limit={3}>
        <Toast.List class={toastList} />
      </Toast.Region>

      <CommandPalette
        open={store.commandPaletteOpen()}
        onOpenChange={store.setCommandPaletteOpen}
        entries={commandPaletteEntries()}
      />
    </main>
  );
}
