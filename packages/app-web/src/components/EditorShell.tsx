import * as Dialog from "@kobalte/core/dialog";
import * as Toast from "@kobalte/core/toast";
import { isDirty } from "@shadr/exec-engine";
import type { GraphSocket, SocketId, WireId } from "@shadr/graph-core";
import { graphToDocumentV1 } from "@shadr/graph-core";
import type { JsonValue } from "@shadr/shared";
import { Either } from "effect";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
} from "solid-js";

import EditorCanvas from "~/components/EditorCanvas";
import ExecDebugConsole from "~/components/ExecDebugConsole";
import GraphDiagnostics from "~/components/GraphDiagnostics";
import ParamEditor from "~/components/ParamEditor";
import {
  getNodeCatalogEntry,
  NODE_CATALOG,
  NODE_DRAG_TYPE,
} from "~/editor/node-catalog";
import type { OutputArtifact } from "~/editor/output-artifacts";
import {
  compileOutputArtifact,
  downloadOutputArtifact,
  isOutputNodeType,
} from "~/editor/output-artifacts";
import {
  coerceSettings,
  type EditorSettings,
  MAX_PAN_SENSITIVITY,
  MAX_ZOOM_SENSITIVITY,
  MIN_PAN_SENSITIVITY,
  MIN_ZOOM_SENSITIVITY,
  settingsToJson,
} from "~/editor/settings";
import { createEditorStore } from "~/editor/store";
import {
  createAppLayer,
  runAppEffect,
  runAppEffectEither,
} from "~/services/runtime";
import {
  loadGraphDocument as loadGraphDocumentEffect,
  loadSettings as loadSettingsEffect,
  saveGraphDocument as saveGraphDocumentEffect,
  saveSettings as saveSettingsEffect,
} from "~/services/storage-service";
import {
  createUiEventServiceLayer,
  notifyUi,
} from "~/services/ui-event-service";

const formatPreviewValue = (value: unknown): string => {
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

const formatExecError = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "_tag" in error) {
    const tagValue = (error as { _tag: string })._tag;
    return typeof tagValue === "string" ? tagValue : "UnknownError";
  }
  return "UnknownError";
};

const scoreFuzzyToken = (source: string, token: string): number => {
  let score = 0;
  let index = 0;
  let streak = 0;
  for (const char of token) {
    const found = source.indexOf(char, index);
    if (found === -1) {
      return -1;
    }
    if (found === index) {
      streak += 1;
      score += 3 + streak;
    } else {
      streak = 0;
      score += 1;
    }
    index = found + 1;
  }
  return score;
};

const scoreFuzzy = (source: string, query: string): number => {
  const tokens = query.split(/\s+/u).filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return 0;
  }
  const lowered = source.toLowerCase();
  let total = 0;
  for (const token of tokens) {
    const tokenScore = scoreFuzzyToken(lowered, token);
    if (tokenScore < 0) {
      return -1;
    }
    total += tokenScore;
  }
  return total;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

type OutputPanelState =
  | Readonly<{ status: "idle"; message: string }>
  | Readonly<{ status: "error"; message: string }>
  | Readonly<{ status: "ready"; artifact: OutputArtifact }>;

export default function EditorShell() {
  const toaster = Toast.toaster;
  const store = createEditorStore();
  const isDev = import.meta.env.DEV;
  const [isLoaded, setIsLoaded] = createSignal(false);
  const [settingsLoaded, setSettingsLoaded] = createSignal(false);
  const [libraryQuery, setLibraryQuery] = createSignal("");
  const [quickAddOpen, setQuickAddOpen] = createSignal(false);
  const [quickAddQuery, setQuickAddQuery] = createSignal("");
  let quickAddInput: HTMLInputElement | undefined;

  const selectedNode = createMemo(() => {
    const graph = store.graph();
    const iterator = store.selectedNodes().values();
    const first = iterator.next().value;
    if (!first) {
      return null;
    }
    return graph.nodes.get(first) ?? null;
  });

  const selectedEntry = createMemo(() => {
    const node = selectedNode();
    if (!node) {
      return null;
    }
    return getNodeCatalogEntry(node.type) ?? null;
  });

  const selectedOutputNode = createMemo(() => {
    const node = selectedNode();
    if (!node || !isOutputNodeType(node.type)) {
      return null;
    }
    return node;
  });

  const inspectorRows = createMemo(() => {
    const node = selectedNode();
    if (!node) {
      return [
        { label: "Node", value: "None selected" },
        { label: "Inputs", value: "0" },
        { label: "Outputs", value: "0" },
        { label: "Status", value: "Idle" },
      ];
    }
    const status = isDirty(store.dirtyState(), node.id) ? "Dirty" : "Clean";
    return [
      { label: "Node", value: selectedEntry()?.label ?? node.type },
      { label: "Inputs", value: String(node.inputs.length) },
      { label: "Outputs", value: String(node.outputs.length) },
      { label: "Status", value: status },
    ];
  });

  const inspectorSockets = createMemo(() => {
    const node = selectedNode();
    if (!node) {
      return [];
    }
    const graph = store.graph();
    const state = store.dirtyState();

    const getCachedOutputValue = (
      socket: GraphSocket,
    ): JsonValue | null | undefined => {
      const outputs = state.outputCache.get(socket.nodeId);
      if (
        !outputs ||
        !Object.prototype.hasOwnProperty.call(outputs, socket.name)
      ) {
        return undefined;
      }
      return outputs[socket.name] ?? null;
    };

    const findInputWire = (socketId: SocketId): WireId | null => {
      for (const wire of graph.wires.values()) {
        if (wire.toSocketId === socketId) {
          return wire.id;
        }
      }
      return null;
    };

    const getSocketValueLabel = (socket: GraphSocket): string => {
      if (socket.direction === "output") {
        const cached = getCachedOutputValue(socket);
        return cached === undefined
          ? "No cached value"
          : formatPreviewValue(cached);
      }
      const wireId = findInputWire(socket.id);
      if (!wireId) {
        return "Unconnected";
      }
      const wire = graph.wires.get(wireId);
      const fromSocket = wire ? graph.sockets.get(wire.fromSocketId) : null;
      if (!fromSocket) {
        return "Unconnected";
      }
      const cached = getCachedOutputValue(fromSocket);
      return cached === undefined
        ? "No cached value"
        : formatPreviewValue(cached);
    };

    const sockets: GraphSocket[] = [];
    for (const socketId of [...node.inputs, ...node.outputs]) {
      const socket = graph.sockets.get(socketId);
      if (socket) {
        sockets.push(socket);
      }
    }
    return sockets.map((socket) => ({
      id: socket.id,
      name: socket.name,
      direction: socket.direction,
      dataType: socket.dataType,
      valueLabel: getSocketValueLabel(socket),
    }));
  });

  const outputPanelState = createMemo<OutputPanelState>(() => {
    const node = selectedOutputNode();
    if (!node) {
      return {
        status: "idle",
        message: "Select an output node to compile an artifact.",
      };
    }
    const outputSocketId = node.outputs[0];
    if (!outputSocketId) {
      return { status: "idle", message: "Output node has no output socket." };
    }
    if (store.activeOutputSocketId() !== outputSocketId) {
      return { status: "idle", message: "Compile to generate output." };
    }
    const error = store.outputError();
    if (error) {
      return { status: "error", message: `Error: ${formatExecError(error)}` };
    }
    const result = compileOutputArtifact(node.type, store.outputValue());
    if (result.error) {
      return { status: "error", message: result.error };
    }
    if (!result.artifact) {
      return { status: "idle", message: "No output value yet." };
    }
    return { status: "ready", artifact: result.artifact };
  });

  const selectQuickAddEntry = (nodeType: string): void => {
    const pointer = store.pointerPosition();
    const worldPoint = pointer?.world ?? store.canvasCenter();
    store.addNodeAt(nodeType, worldPoint);
    setQuickAddOpen(false);
    setQuickAddQuery("");
  };

  const isEditableTarget = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT");

  createEffect(() => {
    if (!quickAddOpen() || typeof window === "undefined") {
      return;
    }
    setQuickAddQuery("");
    window.requestAnimationFrame(() => {
      quickAddInput?.focus();
    });
  });

  const filteredCatalog = createMemo(() => {
    const query = libraryQuery().trim().toLowerCase();
    if (!query) {
      return NODE_CATALOG;
    }
    const ranked = NODE_CATALOG.map((entry) => ({
      entry,
      score: scoreFuzzy(
        `${entry.label} ${entry.type} ${entry.description}`,
        query,
      ),
    }))
      .filter((result) => result.score >= 0)
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        return a.entry.label.localeCompare(b.entry.label);
      });
    return ranked.map((result) => result.entry);
  });

  const filteredQuickAdd = createMemo(() => {
    const query = quickAddQuery().trim().toLowerCase();
    if (!query) {
      return NODE_CATALOG;
    }
    const ranked = NODE_CATALOG.map((entry) => ({
      entry,
      score: scoreFuzzy(
        `${entry.label} ${entry.type} ${entry.description}`,
        query,
      ),
    }))
      .filter((result) => result.score >= 0)
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        return a.entry.label.localeCompare(b.entry.label);
      });
    return ranked.map((result) => result.entry);
  });

  const quickAddPosition = createMemo(() => {
    const pointer = store.pointerPosition();
    if (!pointer) {
      return {
        left: "50%",
        top: "30%",
        transform: "translate(-50%, 0)",
      };
    }
    const x = Math.round(pointer.screen.x);
    const y = Math.round(pointer.screen.y);
    return {
      left: `clamp(16px, ${x}px, calc(100vw - 360px))`,
      top: `clamp(16px, ${y}px, calc(100vh - 280px))`,
      transform: "translate(12px, 12px)",
    };
  });

  const updateSetting = <Key extends keyof EditorSettings>(
    key: Key,
    value: EditorSettings[Key],
  ): void => {
    store.updateSettings({ [key]: value } as Partial<EditorSettings>);
  };

  const updateNumericSetting = (
    key: "zoomSensitivity" | "panSensitivity",
    min: number,
    max: number,
  ) => {
    return (event: InputEvent): void => {
      const next = Number(event.currentTarget.value);
      if (!Number.isFinite(next)) {
        return;
      }
      updateSetting(key, clamp(next, min, max));
    };
  };

  const ghostButtonBase =
    "cursor-pointer rounded-full border border-[rgba(130,160,200,0.35)] bg-[rgba(12,16,28,0.7)] px-[0.85rem] py-[0.4rem] text-[0.75rem] uppercase tracking-[0.08em] text-[#d5def2] transition disabled:cursor-not-allowed disabled:opacity-50";
  const ghostButtonPrimary = `${ghostButtonBase} border-[rgba(91,228,255,0.6)] text-[#e6fbff] shadow-[0_0_12px_rgba(91,228,255,0.18)]`;
  const statusPillBase =
    "rounded-full border border-[rgba(130,160,200,0.35)] bg-[rgba(12,16,28,0.9)] px-[0.65rem] py-[0.3rem] text-[0.75rem] uppercase tracking-[0.08em] text-[#cdd7ef]";
  const statusPillOk = `${statusPillBase} border-[rgba(91,228,255,0.5)] text-[#e4fbff] shadow-[0_0_16px_rgba(91,228,255,0.2)]`;
  const panelBase =
    "flex min-h-0 flex-col gap-[0.85rem] rounded-[1rem] border border-[rgba(120,150,190,0.24)] bg-[rgba(10,14,24,0.88)] p-4 shadow-[inset_0_0_24px_rgba(91,228,255,0.05)]";
  const panelTag =
    "self-start rounded-full border border-[rgba(91,228,255,0.3)] bg-[rgba(91,228,255,0.12)] px-[0.6rem] py-[0.25rem] text-[0.7rem] uppercase tracking-[0.08em] text-[#d9f8ff]";
  const panelInput =
    "w-full rounded-xl border border-[rgba(120,150,190,0.3)] bg-[rgba(10,13,22,0.9)] px-[0.75rem] py-[0.55rem] text-[0.9rem] text-[#d9e3fb] placeholder:text-[rgba(154,168,199,0.7)]";
  const panelItem =
    "flex items-center justify-between rounded-xl border border-[rgba(120,150,190,0.2)] bg-[rgba(9,13,21,0.9)] px-[0.75rem] py-[0.6rem] text-left text-[#dce6fb]";
  const panelItemMeta =
    "text-[0.7rem] uppercase tracking-[0.08em] text-[#9aa8c7]";
  const panelRow =
    "flex items-center justify-between border-b border-[rgba(120,150,190,0.15)] px-[0.2rem] py-[0.45rem] text-[0.85rem] last:border-b-0";
  const panelRowLabel = "text-[#9aa8c7]";
  const panelRowValue = "font-semibold";
  const panelPlaceholder =
    "mt-auto rounded-xl border border-dashed border-[rgba(120,150,190,0.35)] bg-[rgba(10,13,22,0.6)] p-3 text-[0.85rem] text-[#9aa8c7]";
  const panelSection =
    "mt-auto flex flex-col gap-[0.65rem] border-t border-[rgba(120,150,190,0.2)] pt-2";
  const panelSocketList = "flex flex-col gap-2";
  const panelSocketRow =
    "flex items-start justify-between gap-3 rounded-xl border border-[rgba(120,150,190,0.2)] bg-[rgba(9,13,21,0.9)] px-[0.75rem] py-[0.6rem]";
  const panelSocketMeta =
    "text-[0.7rem] uppercase tracking-[0.08em] text-[#9aa8c7]";
  const panelSocketValue =
    "text-right text-[0.8rem] font-semibold text-[#dce6fb]";
  const panelSocketEmpty =
    "rounded-xl border border-dashed border-[rgba(120,150,190,0.35)] bg-[rgba(10,13,22,0.6)] p-3 text-[0.85rem] text-[#9aa8c7]";
  const panelPreviewBase =
    "flex min-h-[2.2rem] items-center rounded-xl border border-[rgba(120,150,190,0.25)] bg-[rgba(9,13,21,0.85)] px-[0.75rem] py-[0.6rem] text-[0.85rem] text-[#dce6fb]";
  const panelPreviewError =
    "border-[rgba(255,107,107,0.55)] bg-[rgba(60,15,20,0.6)] text-[#ff9b9b]";
  const panelPreviewBody = "flex flex-1 flex-col gap-3";
  const panelPreviewText =
    "whitespace-pre-wrap break-words font-mono text-[0.82rem] text-[#dce6fb]";
  const panelPreviewImage =
    "w-full rounded-xl border border-[rgba(120,150,190,0.25)] bg-[rgba(4,6,12,0.6)] object-contain";
  const panelSettingRow = "flex items-center justify-between gap-3";
  const panelSettingLabel = "text-[0.85rem] text-[#d5def2]";
  const panelSettingValue = "w-12 text-right text-[0.75rem] text-[#9aa8c7]";
  const panelRange =
    "h-2 w-full appearance-none rounded-full bg-[rgba(120,150,190,0.18)]";
  const panelRangeThumb = "accent-[#7bf1ff] focus:accent-[#7bf1ff]";
  const panelCheckbox = "h-4 w-4 accent-[#7bf1ff] focus:accent-[#7bf1ff]";
  const toastRegion = "fixed right-6 top-6 z-30 w-[min(320px,90vw)]";
  const toastList = "flex flex-col gap-3";
  const toastRoot =
    "flex items-start justify-between gap-3 rounded-[0.9rem] border border-[rgba(91,228,255,0.35)] bg-[rgba(10,14,24,0.96)] px-[0.9rem] py-[0.8rem] shadow-[0_16px_36px_rgba(3,6,15,0.55)]";
  const toastTitle = "text-[0.9rem] font-semibold";
  const toastDescription = "mt-1 text-[0.8rem] text-[#9aa8c7]";
  const toastClose =
    "cursor-pointer rounded-full border border-[rgba(120,150,190,0.35)] bg-transparent px-[0.6rem] py-[0.2rem] text-[0.65rem] uppercase tracking-[0.1em] text-[#d8e2f7]";
  const quickAddOverlay =
    "fixed inset-0 z-40 bg-[rgba(4,6,12,0.35)] backdrop-blur-[2px]";
  const quickAddPanel =
    "fixed z-50 w-[min(360px,90vw)] rounded-[1rem] border border-[rgba(120,150,190,0.45)] bg-[rgba(8,12,20,0.98)] p-4 shadow-[0_20px_40px_rgba(3,6,15,0.55)]";
  const quickAddTitle =
    "text-[0.85rem] uppercase tracking-[0.12em] text-[#a8b6d8]";
  const quickAddKbd =
    "rounded-full border border-[rgba(120,150,190,0.35)] bg-[rgba(9,13,21,0.7)] px-[0.5rem] py-[0.15rem] text-[0.65rem] uppercase tracking-[0.1em] text-[#9aa8c7]";
  const quickAddInputField =
    "mt-3 w-full rounded-xl border border-[rgba(120,150,190,0.3)] bg-[rgba(7,10,18,0.95)] px-[0.75rem] py-[0.55rem] text-[0.95rem] text-[#d9e3fb] placeholder:text-[rgba(154,168,199,0.7)]";
  const quickAddList =
    "mt-3 flex max-h-[260px] flex-col gap-2 overflow-auto pr-1";
  const quickAddItem =
    "flex w-full items-start justify-between gap-3 rounded-xl border border-[rgba(120,150,190,0.2)] bg-[rgba(9,13,21,0.85)] px-[0.75rem] py-[0.6rem] text-left text-[#e2ecff] transition hover:border-[rgba(91,228,255,0.5)] hover:text-[#f5fbff]";
  const quickAddItemMeta =
    "text-[0.7rem] uppercase tracking-[0.08em] text-[#9aa8c7]";
  const quickAddEmpty =
    "rounded-xl border border-dashed border-[rgba(120,150,190,0.35)] bg-[rgba(10,13,22,0.6)] p-3 text-[0.85rem] text-[#9aa8c7]";

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

  createEffect(() => {
    const node = selectedOutputNode();
    if (!node) {
      return;
    }
    const outputSocketId = node.outputs[0];
    if (outputSocketId && store.activeOutputSocketId() !== outputSocketId) {
      store.requestOutput(outputSocketId);
    }
  });

  onMount(() => {
    const graphId = store.graph().graphId;
    void runAppEffectEither(loadGraphDocumentEffect(graphId), appLayer).then(
      (result) => {
        if (Either.isLeft(result)) {
          console.warn("Failed to load graph document", result.left);
          notifyToast("Storage error", "Starting with a new graph session.");
          setIsLoaded(true);
          return;
        }
        const document = result.right;
        if (document) {
          const loaded = store.loadGraphDocument(document);
          if (!loaded) {
            notifyToast(
              "Load failed",
              "Stored graph was invalid and was discarded.",
            );
          }
        }
        setIsLoaded(true);
      },
    );

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
        void runAppEffectEither(
          saveGraphDocumentEffect(document),
          appLayer,
        ).then((saveResult) => {
          if (Either.isLeft(saveResult)) {
            console.warn("Autosave failed", saveResult.left);
            notifyToast(
              "Autosave failed",
              "Changes are still local to this session.",
            );
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
    });

    notifyToast(
      "Workspace ready",
      "Graph session loaded. Double-click to add nodes.",
    );
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
              notifyToast(
                "Settings not saved",
                "Preferences will reset after reload.",
              );
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

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key === "Escape" && quickAddOpen()) {
        event.preventDefault();
        setQuickAddOpen(false);
        return;
      }
      const isQuickAddKey = event.key === "Tab" || event.code === "Space";
      if (isQuickAddKey) {
        event.preventDefault();
        setQuickAddOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown);
    });
  });

  return (
    <main class="grid min-h-screen grid-rows-[auto_1fr] gap-4 p-3 md:p-4">
      <header class="grid grid-cols-1 items-center gap-4 rounded-[1.1rem] border border-[rgba(120,150,190,0.24)] bg-[rgba(10,14,24,0.88)] px-[1.1rem] py-[0.85rem] shadow-[0_20px_40px_rgba(3,6,15,0.45)] backdrop-blur-[14px] md:grid-cols-[minmax(180px,1.2fr)_minmax(200px,1fr)_auto]">
        <div class="flex flex-col gap-1">
          <h1 class="text-[1.1rem] font-bold uppercase tracking-[0.08em]">
            Shadr
          </h1>
          <p class="text-[0.8rem] tracking-[0.02em] text-[#9aa8c7]">
            Deterministic node studio
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class={statusPillBase}>Untitled.graph</span>
          <span class={statusPillOk}>Saved</span>
          <span class={statusPillBase}>Offline</span>
        </div>
        <div class="flex justify-start gap-2 md:justify-end">
          <button class={ghostButtonBase} type="button">
            Open
          </button>
          <button class={ghostButtonPrimary} type="button">
            Save
          </button>
        </div>
      </header>

      <div class="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside class={`${panelBase} order-2 md:order-none`}>
          <div class="flex justify-between gap-3">
            <div>
              <h2 class="text-[1rem] uppercase tracking-[0.08em]">
                Node Library
              </h2>
              <p class="mt-1 text-[0.85rem] text-[#9aa8c7]">
                Drag to add or tap to preview.
              </p>
            </div>
            <span class={panelTag}>{NODE_CATALOG.length} presets</span>
          </div>
          <div class="flex">
            <input
              class={panelInput}
              type="text"
              placeholder="Search nodes"
              aria-label="Search node library"
              value={libraryQuery()}
              onInput={(event) => setLibraryQuery(event.currentTarget.value)}
            />
          </div>
          <div class="flex flex-1 flex-col gap-2 overflow-auto pr-1">
            <For each={filteredCatalog()}>
              {(item) => (
                <button
                  class={panelItem}
                  type="button"
                  draggable={true}
                  onClick={() => {
                    store.addNodeAt(item.type);
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer?.setData(NODE_DRAG_TYPE, item.type);
                    event.dataTransfer?.setData("text/plain", item.label);
                    event.dataTransfer?.setDragImage(
                      event.currentTarget,
                      12,
                      12,
                    );
                  }}
                >
                  <span>{item.label}</span>
                  <span class={panelItemMeta}>Params</span>
                </button>
              )}
            </For>
            {filteredCatalog().length === 0 ? (
              <div class={panelPlaceholder}>No matching nodes found.</div>
            ) : null}
          </div>
        </aside>

        <section class="order-1 grid min-h-0 grid-rows-[auto_1fr] overflow-hidden rounded-[1.2rem] border border-[rgba(120,150,190,0.35)] bg-[linear-gradient(180deg,rgba(14,20,34,0.92)_0%,rgba(7,10,16,0.98)_100%)] shadow-[0_24px_40px_rgba(3,6,15,0.55)] md:order-none">
          <div class="flex items-center justify-between border-b border-[rgba(120,150,190,0.2)] bg-[rgba(9,12,20,0.92)] px-4 py-3 text-[0.75rem] uppercase tracking-[0.08em] text-[#cbd6ee]">
            <span>Canvas</span>
            <span class="text-[#9aa8c7]">Zoom 100%</span>
          </div>
          <div class="relative min-h-[320px]">
            <EditorCanvas store={store} onViewportEmpty={notifyViewportEmpty} />
          </div>
        </section>

        <aside class={`${panelBase} hidden lg:flex`}>
          <div class="flex justify-between gap-3">
            <div>
              <h2 class="text-[1rem] uppercase tracking-[0.08em]">Inspector</h2>
              <p class="mt-1 text-[0.85rem] text-[#9aa8c7]">
                {selectedNode()
                  ? "Adjust parameters for the selected node."
                  : "Select a node to edit parameters."}
              </p>
            </div>
            <span class={panelTag}>
              {selectedNode() ? "Editable" : "Read-only"}
            </span>
          </div>
          <div class="flex flex-col gap-2">
            <For each={inspectorRows()}>
              {(row) => (
                <div class={panelRow}>
                  <span class={panelRowLabel}>{row.label}</span>
                  <span class={panelRowValue}>{row.value}</span>
                </div>
              )}
            </For>
          </div>
          {selectedNode() && selectedEntry()?.paramSchema ? (
            <ParamEditor
              node={selectedNode()!}
              schema={selectedEntry()!.paramSchema!}
              onParamChange={(key, value) =>
                store.updateNodeParam(selectedNode()!.id, key, value)
              }
            />
          ) : (
            <div class={panelPlaceholder}>
              Parameter editing will appear here when nodes are selected.
            </div>
          )}
          <div class={panelSection}>
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-[0.85rem] uppercase tracking-[0.08em] text-[#9aa8c7]">
                Sockets
              </h3>
              <span class={panelTag}>{inspectorSockets().length}</span>
            </div>
            <div class={panelSocketList}>
              <For each={inspectorSockets()}>
                {(socket) => (
                  <div class={panelSocketRow}>
                    <div class="flex flex-col gap-1">
                      <span class="text-[0.85rem] font-semibold text-[#e2ecff]">
                        {socket.name}
                      </span>
                      <span class={panelSocketMeta}>
                        {socket.direction === "input" ? "Input" : "Output"} ·{" "}
                        {socket.dataType}
                      </span>
                    </div>
                    <span class={panelSocketValue}>{socket.valueLabel}</span>
                  </div>
                )}
              </For>
              {selectedNode() && inspectorSockets().length === 0 ? (
                <div class={panelSocketEmpty}>No sockets defined.</div>
              ) : null}
              {!selectedNode() ? (
                <div class={panelSocketEmpty}>
                  Select a node to inspect socket values.
                </div>
              ) : null}
            </div>
          </div>
          <div class={panelSection}>
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-[0.85rem] uppercase tracking-[0.08em] text-[#9aa8c7]">
                Output Preview
              </h3>
              <div class="flex items-center gap-2">
                <button
                  class={ghostButtonPrimary}
                  type="button"
                  disabled={
                    !selectedOutputNode() ||
                    selectedOutputNode()!.outputs.length === 0
                  }
                  onClick={() => {
                    const node = selectedOutputNode();
                    if (!node || node.outputs.length === 0) {
                      return;
                    }
                    store.requestOutput(node.outputs[0]);
                  }}
                >
                  Compile
                </button>
                <button
                  class={ghostButtonBase}
                  type="button"
                  disabled={outputPanelState().status !== "ready"}
                  onClick={() => {
                    const state = outputPanelState();
                    if (state.status !== "ready") {
                      return;
                    }
                    const error = downloadOutputArtifact(state.artifact);
                    if (error) {
                      notifyToast("Export failed", error);
                      return;
                    }
                    notifyToast(
                      "Export ready",
                      `Downloaded ${state.artifact.filename}.`,
                    );
                  }}
                >
                  Download
                </button>
              </div>
            </div>
            {outputPanelState().status === "ready" ? (
              <div class={panelPreviewBody}>
                {outputPanelState().artifact.kind === "image" ? (
                  <img
                    class={panelPreviewImage}
                    src={outputPanelState().artifact.dataUrl}
                    alt="Output preview"
                    width={outputPanelState().artifact.width}
                    height={outputPanelState().artifact.height}
                  />
                ) : (
                  <div class={panelPreviewBase}>
                    <pre class={panelPreviewText}>
                      {outputPanelState().artifact.text}
                    </pre>
                  </div>
                )}
                <div class={panelTag}>{outputPanelState().artifact.label}</div>
              </div>
            ) : (
              <div
                class={`${panelPreviewBase} ${
                  outputPanelState().status === "error" ? panelPreviewError : ""
                }`}
              >
                {outputPanelState().message}
              </div>
            )}
          </div>
          <div class={panelSection}>
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-[0.85rem] uppercase tracking-[0.08em] text-[#9aa8c7]">
                Canvas Settings
              </h3>
              <span class={panelTag}>Local</span>
            </div>
            <div class="flex flex-col gap-3">
              <label class={panelSettingRow}>
                <span class={panelSettingLabel}>Show grid</span>
                <input
                  class={panelCheckbox}
                  type="checkbox"
                  checked={store.settings().gridVisible}
                  onChange={(event) =>
                    updateSetting("gridVisible", event.currentTarget.checked)
                  }
                />
              </label>
              <label class={panelSettingRow}>
                <span class={panelSettingLabel}>Snap to grid</span>
                <input
                  class={panelCheckbox}
                  type="checkbox"
                  checked={store.settings().snapToGrid}
                  onChange={(event) =>
                    updateSetting("snapToGrid", event.currentTarget.checked)
                  }
                />
              </label>
              <div class="flex flex-col gap-2">
                <div class={panelSettingRow}>
                  <span class={panelSettingLabel}>Zoom sensitivity</span>
                  <span class={panelSettingValue}>
                    {store.settings().zoomSensitivity.toFixed(2)}
                  </span>
                </div>
                <input
                  class={`${panelRange} ${panelRangeThumb}`}
                  type="range"
                  min={MIN_ZOOM_SENSITIVITY}
                  max={MAX_ZOOM_SENSITIVITY}
                  step={0.05}
                  value={store.settings().zoomSensitivity}
                  onInput={updateNumericSetting(
                    "zoomSensitivity",
                    MIN_ZOOM_SENSITIVITY,
                    MAX_ZOOM_SENSITIVITY,
                  )}
                />
              </div>
              <div class="flex flex-col gap-2">
                <div class={panelSettingRow}>
                  <span class={panelSettingLabel}>Pan sensitivity</span>
                  <span class={panelSettingValue}>
                    {store.settings().panSensitivity.toFixed(2)}
                  </span>
                </div>
                <input
                  class={`${panelRange} ${panelRangeThumb}`}
                  type="range"
                  min={MIN_PAN_SENSITIVITY}
                  max={MAX_PAN_SENSITIVITY}
                  step={0.05}
                  value={store.settings().panSensitivity}
                  onInput={updateNumericSetting(
                    "panSensitivity",
                    MIN_PAN_SENSITIVITY,
                    MAX_PAN_SENSITIVITY,
                  )}
                />
              </div>
            </div>
          </div>
          {isDev ? (
            <div class={panelSection}>
              <GraphDiagnostics
                graph={store.graph()}
                dirtyState={store.dirtyState()}
                execHistory={store.execHistory()}
              />
            </div>
          ) : null}
          {isDev ? (
            <div class={panelSection}>
              <ExecDebugConsole
                entries={store.execHistory()}
                onClear={store.clearExecHistory}
              />
            </div>
          ) : null}
        </aside>
      </div>

      <Toast.Region class={toastRegion} duration={4200} limit={3}>
        <Toast.List class={toastList} />
      </Toast.Region>

      <Dialog.Root open={quickAddOpen()} onOpenChange={setQuickAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class={quickAddOverlay} />
          <Dialog.Content class={quickAddPanel} style={quickAddPosition()}>
            <div class="flex items-center justify-between">
              <Dialog.Title class={quickAddTitle}>Quick add</Dialog.Title>
              <span class={quickAddKbd}>Space / Tab</span>
            </div>
            <input
              ref={quickAddInput}
              class={quickAddInputField}
              type="text"
              placeholder="Type to search nodes"
              value={quickAddQuery()}
              onInput={(event) => setQuickAddQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setQuickAddOpen(false);
                  return;
                }
                if (event.key === "Enter") {
                  const first = filteredQuickAdd()[0];
                  if (first) {
                    event.preventDefault();
                    selectQuickAddEntry(first.type);
                  }
                }
              }}
            />
            <div class={quickAddList}>
              <For each={filteredQuickAdd()}>
                {(item) => (
                  <button
                    class={quickAddItem}
                    type="button"
                    onClick={() => selectQuickAddEntry(item.type)}
                  >
                    <div class="flex flex-col gap-1">
                      <span class="text-[0.9rem] font-semibold">
                        {item.label}
                      </span>
                      <span class="text-[0.75rem] text-[#9aa8c7]">
                        {item.description}
                      </span>
                    </div>
                    <span class={quickAddItemMeta}>{item.type}</span>
                  </button>
                )}
              </For>
              {filteredQuickAdd().length === 0 ? (
                <div class={quickAddEmpty}>No matching nodes found.</div>
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
