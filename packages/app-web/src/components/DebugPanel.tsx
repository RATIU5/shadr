import type { DirtyState } from "@shadr/exec-engine";
import type { Graph, NodeId, SocketId } from "@shadr/graph-core";
import type { JsonValue } from "@shadr/shared";
import { Eye, Plus, Trash2, X } from "lucide-solid";
import { createEffect, createMemo, createSignal, For } from "solid-js";

import ExecDebugConsole from "~/components/ExecDebugConsole";
import type { DebugEvent } from "~/editor/debug-events";
import type { ExecDebugEntry } from "~/editor/exec-debug";

const formatTimestamp = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString();

const formatValue = (value: JsonValue | undefined): string => {
  if (value === undefined) {
    return "n/a";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
};

/* eslint-disable no-unused-vars */
type DebugPanelProps = Readonly<{
  embedded?: boolean;
  graph: Graph;
  dirtyState: DirtyState;
  execHistory: ReadonlyArray<ExecDebugEntry>;
  debugEvents: ReadonlyArray<DebugEvent>;
  watchedSockets: ReadonlyArray<SocketId>;
  selectedNodeId: NodeId | null;
  onAddWatchedSocket: (socketId: SocketId) => void;
  onRemoveWatchedSocket: (socketId: SocketId) => void;
  onClearWatchedSockets: () => void;
  onClearExecHistory: () => void;
  onClearDebugEvents: () => void;
  onClose?: () => void;
}>;
/* eslint-enable no-unused-vars */

type SocketOption = Readonly<{ id: SocketId; label: string }>;

type SocketValueRow = Readonly<{
  socketId: SocketId;
  label: string;
  value: JsonValue | undefined;
}>;

type WatchedRow = Readonly<{
  socketId: SocketId;
  label: string;
  value: JsonValue | undefined;
  missing: boolean;
}>;

export default function DebugPanel(props: DebugPanelProps) {
  const [selectedSocketId, setSelectedSocketId] = createSignal<SocketId | null>(
    null,
  );

  const outputSocketOptions = createMemo<ReadonlyArray<SocketOption>>(() => {
    const options: SocketOption[] = [];
    for (const socket of props.graph.sockets.values()) {
      if (socket.direction !== "output") {
        continue;
      }
      const node = props.graph.nodes.get(socket.nodeId);
      const nodeLabel = node ? node.type : socket.nodeId;
      const socketLabel = socket.label ?? socket.name;
      options.push({
        id: socket.id,
        label: `${nodeLabel} - ${socketLabel}`,
      });
    }
    options.sort((left, right) => left.label.localeCompare(right.label));
    return options;
  });

  createEffect(() => {
    if (selectedSocketId() || outputSocketOptions().length === 0) {
      return;
    }
    setSelectedSocketId(outputSocketOptions()[0]?.id ?? null);
  });

  const watchedRows = createMemo<ReadonlyArray<WatchedRow>>(() => {
    const rows: WatchedRow[] = [];
    for (const socketId of props.watchedSockets) {
      const socket = props.graph.sockets.get(socketId);
      if (!socket) {
        rows.push({
          socketId,
          label: socketId,
          value: undefined,
          missing: true,
        });
        continue;
      }
      const node = props.graph.nodes.get(socket.nodeId);
      const nodeLabel = node ? node.type : socket.nodeId;
      const socketLabel = socket.label ?? socket.name;
      const cached = props.dirtyState.outputCache.get(socket.nodeId);
      const value = cached ? cached[socket.name] : undefined;
      rows.push({
        socketId,
        label: `${nodeLabel} - ${socketLabel}`,
        value,
        missing: false,
      });
    }
    return rows;
  });

  const selectedNodeOutputs = createMemo<ReadonlyArray<SocketValueRow>>(() => {
    if (!props.selectedNodeId) {
      return [];
    }
    const node = props.graph.nodes.get(props.selectedNodeId);
    if (!node) {
      return [];
    }
    const outputs: SocketValueRow[] = [];
    const cache = props.dirtyState.outputCache.get(node.id);
    for (const socketId of node.outputs) {
      const socket = props.graph.sockets.get(socketId);
      if (!socket) {
        continue;
      }
      const socketLabel = socket.label ?? socket.name;
      outputs.push({
        socketId,
        label: socketLabel,
        value: cache ? cache[socket.name] : undefined,
      });
    }
    return outputs;
  });

  const panelRoot = props.embedded
    ? "flex flex-col gap-4 text-[color:var(--app-text)]"
    : "pointer-events-auto z-[var(--layer-panel)] flex w-[min(92vw,420px)] flex-col gap-4 rounded-[1.1rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-panel-strong)] px-3 py-3 text-[color:var(--app-text)] shadow-[var(--shadow-panel)] backdrop-blur max-h-[75vh] overflow-y-auto";
  const panelTitle =
    "text-[0.7rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]";
  const panelSubtitle = "text-[0.75rem] text-[color:var(--text-muted)]";
  const sectionCard =
    "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-panel)] px-3 py-3";
  const sectionTitle =
    "text-[0.65rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]";
  const rowLabel = "text-[0.75rem] text-[color:var(--text-muted)]";
  const rowValue = "text-[0.8rem] text-[color:var(--text-strong)]";
  const badge =
    "rounded-full border border-[color:var(--border-muted)] px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.16em]";
  const badgeWarn =
    "border-[color:var(--status-warn-border)] bg-[color:var(--status-warn-bg)] text-[color:var(--status-warn-text)]";
  const badgeInfo =
    "border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)]";
  const buttonBase =
    "inline-flex items-center justify-center rounded-full border border-[color:var(--border-muted)] bg-transparent px-2 py-1 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--text-soft)] transition hover:border-[color:var(--border-strong)]";
  const buttonDanger =
    "border-[color:var(--status-danger-border)] text-[color:var(--status-danger-text)]";
  const inputSelect =
    "w-full rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-muted)] px-2 py-1 text-[0.7rem] text-[color:var(--text-strong)] focus:border-[color:var(--border-strong)] focus:outline-none";
  const emptyState =
    "rounded-lg border border-dashed border-[color:var(--border-muted)] bg-[color:var(--surface-panel-muted)] px-3 py-2 text-[0.75rem] text-[color:var(--text-muted)]";

  return (
    <div class={panelRoot} role="region" aria-label="Debug panel">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class={panelTitle}>Debug Panel</h3>
          <p class={panelSubtitle}>Dev-only output and event streams.</p>
        </div>
        {!props.embedded && props.onClose ? (
          <button
            class={buttonBase}
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            title="Close"
          >
            <X class="h-3 w-3" />
            <span class="sr-only">Close</span>
          </button>
        ) : null}
      </div>

      <div class={sectionCard}>
        <div class="flex items-center justify-between gap-2">
          <span class={sectionTitle}>Node outputs</span>
          {props.selectedNodeId ? (
            <span class={`${badge} ${badgeInfo}`}>Selected</span>
          ) : (
            <span class={`${badge} ${badgeWarn}`}>None</span>
          )}
        </div>
        {selectedNodeOutputs().length > 0 ? (
          <div class="mt-2 flex flex-col gap-2">
            <For each={selectedNodeOutputs()}>
              {(row) => (
                <div class="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-muted)] p-2">
                  <div class="flex items-center justify-between gap-2">
                    <span class={rowLabel}>{row.label}</span>
                    <button
                      class={buttonBase}
                      type="button"
                      onClick={() => props.onAddWatchedSocket(row.socketId)}
                      aria-label="Watch socket"
                      title="Watch socket"
                    >
                      <Eye class="h-3 w-3" />
                      <span class="sr-only">Watch</span>
                    </button>
                  </div>
                  <pre class="mt-2 max-h-32 overflow-auto text-[0.7rem] text-[color:var(--text-strong)]">
                    {formatValue(row.value)}
                  </pre>
                </div>
              )}
            </For>
          </div>
        ) : (
          <div class={`mt-2 ${emptyState}`}>
            Select a node and run an evaluation to see cached outputs.
          </div>
        )}
      </div>

      <div class={sectionCard}>
        <div class="flex items-center justify-between gap-2">
          <span class={sectionTitle}>Watch sockets</span>
          <button
            class={`${buttonBase} ${buttonDanger}`}
            type="button"
            onClick={props.onClearWatchedSockets}
            aria-label="Clear watched sockets"
            title="Clear watched sockets"
          >
            <Trash2 class="h-3 w-3" />
            <span class="sr-only">Clear</span>
          </button>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <select
            class={inputSelect}
            value={selectedSocketId() ?? ""}
            onChange={(event) =>
              setSelectedSocketId(
                ((event.currentTarget as HTMLSelectElement).value ||
                  null) as SocketId | null,
              )
            }
          >
            <option value="">Select output socket</option>
            <For each={outputSocketOptions()}>
              {(option) => <option value={option.id}>{option.label}</option>}
            </For>
          </select>
          <button
            class={buttonBase}
            type="button"
            onClick={() => {
              const socketId = selectedSocketId();
              if (socketId) {
                props.onAddWatchedSocket(socketId);
              }
            }}
            aria-label="Add socket"
            title="Add socket"
          >
            <Plus class="h-3 w-3" />
            <span class="sr-only">Add</span>
          </button>
        </div>
        {watchedRows().length > 0 ? (
          <div class="mt-3 flex flex-col gap-2">
            <For each={watchedRows()}>
              {(row) => (
                <div class="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-muted)] p-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex flex-col">
                      <span class={rowValue}>{row.label}</span>
                      <span class={rowLabel}>{row.socketId}</span>
                    </div>
                    <button
                      class={`${buttonBase} ${buttonDanger}`}
                      type="button"
                      onClick={() => props.onRemoveWatchedSocket(row.socketId)}
                      aria-label="Remove socket"
                      title="Remove socket"
                    >
                      <X class="h-3 w-3" />
                      <span class="sr-only">Remove</span>
                    </button>
                  </div>
                  {row.missing ? (
                    <div class={`mt-2 ${emptyState}`}>
                      Socket no longer exists.
                    </div>
                  ) : (
                    <pre class="mt-2 max-h-32 overflow-auto text-[0.7rem] text-[color:var(--text-strong)]">
                      {formatValue(row.value)}
                    </pre>
                  )}
                </div>
              )}
            </For>
          </div>
        ) : (
          <div class={`mt-3 ${emptyState}`}>No sockets watched yet.</div>
        )}
      </div>

      <div class={sectionCard}>
        <ExecDebugConsole
          entries={props.execHistory}
          onClear={props.onClearExecHistory}
        />
      </div>

      <div class={sectionCard}>
        <div class="flex items-center justify-between gap-2">
          <span class={sectionTitle}>Event stream</span>
          <button
            class={`${buttonBase} ${buttonDanger}`}
            type="button"
            onClick={props.onClearDebugEvents}
            aria-label="Clear events"
            title="Clear events"
          >
            <Trash2 class="h-3 w-3" />
            <span class="sr-only">Clear</span>
          </button>
        </div>
        {props.debugEvents.length > 0 ? (
          <div class="mt-2 flex max-h-[220px] flex-col gap-2 overflow-auto pr-1">
            <For each={props.debugEvents}>
              {(event) => (
                <div class="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-muted)] px-2 py-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex flex-col">
                      <span class={rowValue}>
                        {formatTimestamp(event.timestamp)} - {event.label}
                      </span>
                      {event.detail ? (
                        <span class={rowLabel}>{event.detail}</span>
                      ) : null}
                    </div>
                    <span class={`${badge} ${badgeInfo}`}>{event.kind}</span>
                  </div>
                </div>
              )}
            </For>
          </div>
        ) : (
          <div class={`mt-2 ${emptyState}`}>No events captured yet.</div>
        )}
      </div>
    </div>
  );
}
