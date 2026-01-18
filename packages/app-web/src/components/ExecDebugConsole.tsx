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
    "rounded-full border border-[rgba(255,200,120,0.4)] bg-[rgba(255,200,120,0.12)] px-[0.55rem] py-[0.2rem] text-[0.7rem] uppercase tracking-[0.08em] text-[#ffe6c7]";
  const consoleList = "flex max-h-[220px] flex-col gap-2 overflow-auto pr-1";
  const consoleRow =
    "flex flex-col gap-2 rounded-xl border border-[rgba(120,150,190,0.2)] bg-[rgba(9,13,21,0.9)] px-[0.75rem] py-[0.6rem] text-[#dce6fb]";
  const consoleRowError =
    "border-[rgba(255,122,122,0.5)] bg-[rgba(60,15,20,0.55)]";
  const consoleMeta =
    "text-[0.7rem] uppercase tracking-[0.08em] text-[#9aa8c7]";
  const consoleBadge =
    "rounded-full border border-[rgba(120,150,190,0.35)] px-[0.45rem] py-[0.15rem] text-[0.65rem] uppercase tracking-[0.08em]";
  const consoleBadgeOk = "border-[rgba(91,228,255,0.5)] text-[#dffbff]";
  const consoleBadgeError = "border-[rgba(255,122,122,0.6)] text-[#ffb9b9]";
  const consoleEmpty =
    "rounded-xl border border-dashed border-[rgba(120,150,190,0.35)] bg-[rgba(10,13,22,0.6)] p-3 text-[0.85rem] text-[#9aa8c7]";
  const clearButton =
    "rounded-full border border-[rgba(120,150,190,0.35)] bg-transparent px-[0.6rem] py-[0.2rem] text-[0.65rem] uppercase tracking-[0.1em] text-[#d8e2f7]";

  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h3 class="text-[0.85rem] uppercase tracking-[0.08em] text-[#9aa8c7]">
            Exec Debug Console
          </h3>
          <p class="mt-1 text-[0.8rem] text-[#9aa8c7]">
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
                <div class="text-[0.75rem] text-[#ffb9b9]">
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
