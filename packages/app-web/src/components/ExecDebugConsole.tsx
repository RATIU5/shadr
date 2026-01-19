import { For } from "solid-js";

import type { ExecDebugEntry } from "~/editor/exec-debug";

const formatExecError = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "_tag" in error) {
    const tagValue = (error as { _tag: string })._tag;
    return typeof tagValue === "string" ? tagValue : "UnknownError";
  }
  return "UnknownError";
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

type ExecDebugConsoleProps = Readonly<{
  entries: ReadonlyArray<ExecDebugEntry>;
  onClear: () => void;
}>;

export default function ExecDebugConsole(props: ExecDebugConsoleProps) {
  const consoleTag =
    "rounded-full border border-[color:var(--status-warn-border)] bg-[color:var(--status-warn-bg)] px-[0.55rem] py-[0.2rem] text-[0.7rem] uppercase tracking-[0.08em] text-[color:var(--status-warn-text)]";
  const consoleList = "flex max-h-[220px] flex-col gap-2 overflow-auto pr-1";
  const consoleRow =
    "flex flex-col gap-2 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel)] px-[0.75rem] py-[0.6rem] text-[color:var(--text-soft)]";
  const consoleRowError =
    "border-[color:var(--status-danger-border)] bg-[color:var(--status-danger-bg)]";
  const consoleMeta =
    "text-[0.7rem] uppercase tracking-[0.08em] text-[color:var(--text-muted)]";
  const consoleBadge =
    "rounded-full border border-[color:var(--border-muted)] px-[0.45rem] py-[0.15rem] text-[0.65rem] uppercase tracking-[0.08em]";
  const consoleBadgeOk =
    "border-[color:var(--status-info-border)] text-[color:var(--status-info-text)]";
  const consoleBadgeError =
    "border-[color:var(--status-danger-border)] text-[color:var(--status-danger-text)]";
  const consoleEmpty =
    "rounded-xl border border-dashed border-[color:var(--border-muted)] bg-[color:var(--surface-panel-muted)] p-3 text-[0.85rem] text-[color:var(--text-muted)]";
  const clearButton =
    "rounded-full border border-[color:var(--border-muted)] bg-transparent px-[0.6rem] py-[0.2rem] text-[0.65rem] uppercase tracking-[0.1em] text-[color:var(--text-soft)]";

  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h3 class="text-[0.85rem] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            Exec Debug Console
          </h3>
          <p class="mt-1 text-[0.8rem] text-[color:var(--text-muted)]">
            Dev-only evaluation log.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class={consoleTag}>Dev</span>
          <button class={clearButton} type="button" onClick={props.onClear}>
            Clear
          </button>
        </div>
      </div>
      <div class={consoleList}>
        <For each={props.entries}>
          {(entry) => (
            <div
              class={`${consoleRow} ${
                entry.status === "error" ? consoleRowError : ""
              }`}
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex flex-col gap-1">
                  <span class="text-[0.85rem] font-semibold">
                    {formatTimestamp(entry.timestamp)} - {entry.outputSocketId}
                  </span>
                  {entry.status === "success" ? (
                    <span class={consoleMeta}>
                      Total {entry.stats.totalMs.toFixed(2)}ms - Hits{" "}
                      {entry.stats.cacheHits} - Misses {entry.stats.cacheMisses}
                    </span>
                  ) : (
                    <span class={consoleMeta}>
                      Error {formatExecError(entry.error)}
                    </span>
                  )}
                </div>
                <span
                  class={`${consoleBadge} ${
                    entry.status === "error"
                      ? consoleBadgeError
                      : consoleBadgeOk
                  }`}
                >
                  {entry.status === "error" ? "Error" : "OK"}
                </span>
              </div>
              {entry.status === "success" && entry.nodeErrors.length > 0 ? (
                <div class="text-[0.75rem] text-[color:var(--status-danger-text)]">
                  {entry.nodeErrors
                    .map(
                      (error) =>
                        `${error.nodeId}: ${error.tags.join(", ") || "Unknown"}`,
                    )
                    .join(" | ")}
                </div>
              ) : null}
            </div>
          )}
        </For>
        {props.entries.length === 0 ? (
          <div class={consoleEmpty}>No evaluations logged yet.</div>
        ) : null}
      </div>
    </div>
  );
}
