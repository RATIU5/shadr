import type { DirtyState } from "@shadr/exec-engine";
import type { Graph } from "@shadr/graph-core";
import { graphToDocumentV1 } from "@shadr/graph-core";
import { createMemo, For } from "solid-js";

import type { ExecDebugEntry } from "~/editor/exec-debug";

type GraphDiagnosticsProps = Readonly<{
  graph: Graph;
  dirtyState: DirtyState;
  execHistory: ReadonlyArray<ExecDebugEntry>;
}>;

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${
    units[unitIndex]
  }`;
};

const formatNumber = (value: number): string => value.toLocaleString();

const estimateJsonBytes = (value: unknown): number => {
  try {
    const json = JSON.stringify(value);
    if (!json) {
      return 0;
    }
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(json).length;
    }
    return json.length;
  } catch {
    return 0;
  }
};

const formatTimestamp = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString();

export default function GraphDiagnostics(props: GraphDiagnosticsProps) {
  const card =
    "rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-[0.75rem] py-[0.7rem]";
  const cardTitle =
    "text-[0.7rem] uppercase tracking-[0.08em] text-[color:var(--text-muted)]";
  const itemRow = "flex items-center justify-between gap-2";
  const itemLabel = "text-[0.8rem] text-[color:var(--text-muted)]";
  const itemValue =
    "text-[0.85rem] font-semibold text-[color:var(--text-soft)]";
  const emptyState =
    "rounded-xl border border-dashed border-[color:var(--border-muted)] bg-[color:var(--surface-panel-muted)] p-3 text-[0.85rem] text-[color:var(--text-muted)]";
  const devTag =
    "rounded-full border border-[color:var(--status-warn-border)] bg-[color:var(--status-warn-bg)] px-[0.55rem] py-[0.2rem] text-[0.7rem] uppercase tracking-[0.08em] text-[color:var(--status-warn-text)]";

  const counts = createMemo(() => {
    let inputSockets = 0;
    let outputSockets = 0;
    for (const socket of props.graph.sockets.values()) {
      if (socket.direction === "input") {
        inputSockets += 1;
      } else {
        outputSockets += 1;
      }
    }
    return {
      nodes: props.graph.nodes.size,
      sockets: props.graph.sockets.size,
      inputs: inputSockets,
      outputs: outputSockets,
      wires: props.graph.wires.size,
    };
  });

  const execStateStats = createMemo(() => ({
    dirtyNodes: props.dirtyState.dirty.size,
    cachedNodes: props.dirtyState.outputCache.size,
    nodeErrors: props.dirtyState.nodeErrors.size,
  }));

  const memoryStats = createMemo(() => {
    const graphDoc = graphToDocumentV1(props.graph);
    const graphBytes = estimateJsonBytes(graphDoc);
    const cacheEntries: Record<string, unknown> = {};
    for (const [nodeId, outputs] of props.dirtyState.outputCache.entries()) {
      cacheEntries[nodeId] = outputs;
    }
    const cacheBytes = estimateJsonBytes(cacheEntries);
    return { graphBytes, cacheBytes };
  });

  const lastSuccess = createMemo(() =>
    props.execHistory.find((entry) => entry.status === "success"),
  );

  const perfStats = createMemo(() => {
    const entry = lastSuccess();
    if (!entry || entry.status !== "success") {
      return null;
    }
    const totalEvaluated = entry.stats.nodeTimings.length;
    const totalCalls = entry.stats.cacheHits + entry.stats.cacheMisses;
    const hitRate =
      totalCalls > 0
        ? `${((entry.stats.cacheHits / totalCalls) * 100).toFixed(1)}%`
        : "n/a";
    const slowest = [...entry.stats.nodeTimings]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 3);
    return {
      timestamp: entry.timestamp,
      totalMs: entry.stats.totalMs,
      cacheHits: entry.stats.cacheHits,
      cacheMisses: entry.stats.cacheMisses,
      hitRate,
      totalEvaluated,
      slowest,
    };
  });

  const summaryRows = createMemo(() => [
    { label: "Nodes", value: formatNumber(counts().nodes) },
    { label: "Sockets", value: formatNumber(counts().sockets) },
    { label: "Inputs", value: formatNumber(counts().inputs) },
    { label: "Outputs", value: formatNumber(counts().outputs) },
    { label: "Wires", value: formatNumber(counts().wires) },
  ]);

  const stateRows = createMemo(() => [
    { label: "Dirty nodes", value: formatNumber(execStateStats().dirtyNodes) },
    {
      label: "Cached nodes",
      value: formatNumber(execStateStats().cachedNodes),
    },
    { label: "Node errors", value: formatNumber(execStateStats().nodeErrors) },
  ]);

  const memoryRows = createMemo(() => [
    { label: "Graph JSON", value: formatBytes(memoryStats().graphBytes) },
    { label: "Cache JSON", value: formatBytes(memoryStats().cacheBytes) },
  ]);

  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h3 class="text-[0.85rem] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            Graph Diagnostics
          </h3>
          <p class="mt-1 text-[0.8rem] text-[color:var(--text-muted)]">
            Dev-only snapshot of graph and execution state.
          </p>
        </div>
        <span class={devTag}>Dev</span>
      </div>

      <div class="grid gap-3">
        <div class={card}>
          <div class={cardTitle}>Graph summary</div>
          <div class="mt-2 flex flex-col gap-2">
            <For each={summaryRows()}>
              {(row) => (
                <div class={itemRow}>
                  <span class={itemLabel}>{row.label}</span>
                  <span class={itemValue}>{row.value}</span>
                </div>
              )}
            </For>
          </div>
        </div>

        <div class={card}>
          <div class={cardTitle}>Execution state</div>
          <div class="mt-2 flex flex-col gap-2">
            <For each={stateRows()}>
              {(row) => (
                <div class={itemRow}>
                  <span class={itemLabel}>{row.label}</span>
                  <span class={itemValue}>{row.value}</span>
                </div>
              )}
            </For>
          </div>
        </div>

        <div class={card}>
          <div class={cardTitle}>Memory estimate</div>
          <div class="mt-2 flex flex-col gap-2">
            <For each={memoryRows()}>
              {(row) => (
                <div class={itemRow}>
                  <span class={itemLabel}>{row.label}</span>
                  <span class={itemValue}>{row.value}</span>
                </div>
              )}
            </For>
          </div>
        </div>

        <div class={card}>
          <div class={cardTitle}>Last evaluation</div>
          {perfStats() ? (
            <div class="mt-2 flex flex-col gap-2">
              <div class={itemRow}>
                <span class={itemLabel}>Timestamp</span>
                <span class={itemValue}>
                  {formatTimestamp(perfStats()!.timestamp)}
                </span>
              </div>
              <div class={itemRow}>
                <span class={itemLabel}>Total time</span>
                <span class={itemValue}>
                  {perfStats()!.totalMs.toFixed(2)}ms
                </span>
              </div>
              <div class={itemRow}>
                <span class={itemLabel}>Nodes evaluated</span>
                <span class={itemValue}>
                  {formatNumber(perfStats()!.totalEvaluated)}
                </span>
              </div>
              <div class={itemRow}>
                <span class={itemLabel}>Cache hit rate</span>
                <span class={itemValue}>{perfStats()!.hitRate}</span>
              </div>
              <div class={itemRow}>
                <span class={itemLabel}>Hits / Misses</span>
                <span class={itemValue}>
                  {formatNumber(perfStats()!.cacheHits)} /{" "}
                  {formatNumber(perfStats()!.cacheMisses)}
                </span>
              </div>
              {perfStats()!.slowest.length > 0 ? (
                <div class="mt-2 flex flex-col gap-2">
                  <span class={cardTitle}>Slowest nodes</span>
                  <For each={perfStats()!.slowest}>
                    {(timing) => (
                      <div class={itemRow}>
                        <span class={itemLabel}>
                          {timing.nodeType} ({timing.nodeId})
                        </span>
                        <span class={itemValue}>
                          {timing.durationMs.toFixed(2)}ms
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              ) : null}
            </div>
          ) : (
            <div class={`mt-2 ${emptyState}`}>No evaluations captured yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
