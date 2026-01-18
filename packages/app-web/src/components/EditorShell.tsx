import { createToaster, Toast } from "@kobalte/core/toast";
import { isDirty } from "@shadr/exec-engine";
import { graphToDocumentV1 } from "@shadr/graph-core";
import { loadGraphDocument, saveGraphDocument } from "@shadr/storage-idb";
import { Effect, Either } from "effect";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
} from "solid-js";

import EditorCanvas from "~/components/EditorCanvas";
import ParamEditor from "~/components/ParamEditor";
import { getNodeCatalogEntry, NODE_CATALOG } from "~/editor/node-catalog";
import { createEditorStore } from "~/editor/store";

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

export default function EditorShell() {
  const [toasts, toaster] = createToaster({ duration: 4200, limit: 3 });
  const store = createEditorStore();
  const [isLoaded, setIsLoaded] = createSignal(false);

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

  const previewMessage = createMemo(() => {
    if (!store.activeOutputSocketId()) {
      return "No output requested yet.";
    }
    const error = store.outputError();
    if (error) {
      return `Error: ${formatExecError(error)}`;
    }
    return formatPreviewValue(store.outputValue());
  });

  createEffect(() => {
    const node = selectedNode();
    if (!node || node.type !== "output") {
      return;
    }
    const outputSocketId = node.outputs[0];
    if (outputSocketId && store.activeOutputSocketId() !== outputSocketId) {
      store.requestOutput(outputSocketId);
    }
  });

  onMount(() => {
    const graphId = store.graph().graphId;
    void Effect.runPromise(Effect.either(loadGraphDocument(graphId))).then(
      (result) => {
        if (Either.isLeft(result)) {
          console.warn("Failed to load graph document", result.left);
          toaster.add({
            title: "Storage error",
            description: "Starting with a new graph session.",
          });
          setIsLoaded(true);
          return;
        }
        const document = result.right;
        if (document) {
          const loaded = store.loadGraphDocument(document);
          if (!loaded) {
            toaster.add({
              title: "Load failed",
              description: "Stored graph was invalid and was discarded.",
            });
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
        void Effect.runPromise(Effect.either(saveGraphDocument(document))).then(
          (saveResult) => {
            if (Either.isLeft(saveResult)) {
              console.warn("Autosave failed", saveResult.left);
              toaster.add({
                title: "Autosave failed",
                description: "Changes are still local to this session.",
              });
            }
          },
        );
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

    toaster.add({
      title: "Workspace ready",
      description: "Graph session loaded. Double-click to add nodes.",
    });
  });

  return (
    <main class="app-shell">
      <header class="app-topbar">
        <div class="brand-block">
          <div class="brand-title">Shadr</div>
          <div class="brand-subtitle">Deterministic node studio</div>
        </div>
        <div class="status-row">
          <span class="status-pill">Untitled.graph</span>
          <span class="status-pill status-pill-ok">Saved</span>
          <span class="status-pill">Offline</span>
        </div>
        <div class="status-actions">
          <button class="ghost-button" type="button">
            Open
          </button>
          <button class="ghost-button ghost-button-primary" type="button">
            Save
          </button>
        </div>
      </header>

      <div class="app-body">
        <aside class="panel panel-left">
          <div class="panel-header">
            <div>
              <h2>Node Library</h2>
              <p>Drag to add or tap to preview.</p>
            </div>
            <span class="panel-tag">{NODE_CATALOG.length} presets</span>
          </div>
          <div class="panel-search">
            <input
              class="panel-input"
              type="text"
              placeholder="Search nodes"
              aria-label="Search node library"
            />
          </div>
          <div class="panel-list">
            <For each={NODE_CATALOG}>
              {(item) => (
                <button class="panel-item" type="button">
                  <span>{item.label}</span>
                  <span class="panel-item-meta">Params</span>
                </button>
              )}
            </For>
          </div>
        </aside>

        <section class="canvas-frame">
          <div class="canvas-toolbar">
            <span>Canvas</span>
            <span class="canvas-toolbar-meta">Zoom 100%</span>
          </div>
          <div class="canvas-surface">
            <EditorCanvas store={store} />
          </div>
        </section>

        <aside class="panel panel-right">
          <div class="panel-header">
            <div>
              <h2>Inspector</h2>
              <p>
                {selectedNode()
                  ? "Adjust parameters for the selected node."
                  : "Select a node to edit parameters."}
              </p>
            </div>
            <span class="panel-tag">
              {selectedNode() ? "Editable" : "Read-only"}
            </span>
          </div>
          <div class="panel-list">
            <For each={inspectorRows()}>
              {(row) => (
                <div class="panel-row">
                  <span class="panel-row-label">{row.label}</span>
                  <span class="panel-row-value">{row.value}</span>
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
            <div class="panel-placeholder">
              Parameter editing will appear here when nodes are selected.
            </div>
          )}
          <div class="panel-section">
            <div class="panel-section-header">
              <h3>Output Preview</h3>
              <button
                class="ghost-button ghost-button-primary"
                type="button"
                disabled={
                  !selectedNode() || selectedNode()!.outputs.length === 0
                }
                onClick={() => {
                  const node = selectedNode();
                  if (!node || node.outputs.length === 0) {
                    return;
                  }
                  store.requestOutput(node.outputs[0]);
                }}
              >
                Preview
              </button>
            </div>
            <div
              class={`panel-preview ${
                store.outputError() ? "panel-preview-error" : ""
              }`}
            >
              {previewMessage()}
            </div>
          </div>
        </aside>
      </div>

      <Toast.Region>
        <Toast.Portal>
          <Toast.Viewport class="toast-viewport">
            <For each={toasts()}>
              {(toast) => (
                <Toast.Root
                  class="toast"
                  toastId={toast.id}
                  duration={toast.duration}
                  onClose={toaster.remove}
                >
                  <div class="toast-content">
                    <Toast.Title class="toast-title">{toast.title}</Toast.Title>
                    {toast.description ? (
                      <Toast.Description class="toast-description">
                        {toast.description}
                      </Toast.Description>
                    ) : null}
                  </div>
                  <Toast.CloseButton
                    class="toast-close"
                    onClick={() => toaster.remove(toast.id)}
                  >
                    Dismiss
                  </Toast.CloseButton>
                </Toast.Root>
              )}
            </For>
          </Toast.Viewport>
        </Toast.Portal>
      </Toast.Region>
    </main>
  );
}
