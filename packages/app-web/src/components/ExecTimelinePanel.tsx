import { createMemo, For } from "solid-js";

import type { ExecVisualizationEntry } from "~/editor/store";

type ExecTimelinePanelProps = Readonly<{
  entries: ReadonlyArray<ExecVisualizationEntry>;
  totalMs: number;
  active: boolean;
}>;

const formatDuration = (value: number): string => `${value.toFixed(2)}ms`;

export default function ExecTimelinePanel(props: ExecTimelinePanelProps) {
  const maxDuration = createMemo(() => {
    let max = 1;
    for (const entry of props.entries) {
      max = Math.max(max, entry.durationMs);
    }
    return max;
  });

  const panelRoot =
    "pointer-events-auto z-[var(--layer-panel)] flex w-[min(92vw,320px)] flex-col gap-2 rounded-[1.1rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-panel)] px-3 py-3 text-[color:var(--app-text)] shadow-[var(--shadow-panel)] backdrop-blur max-h-[48vh] overflow-y-auto";
  const panelTitle =
    "text-[0.8rem] uppercase tracking-[0.12em] text-[color:var(--text-muted)]";
  const panelMeta =
    "text-[0.75rem] text-[color:var(--text-muted)] flex items-center gap-2";
  const liveBadge =
    "rounded-full border border-[color:var(--status-info-border)] px-2 py-[0.1rem] text-[0.55rem] uppercase tracking-[0.18em] text-[color:var(--status-info-text)]";
  const row =
    "flex flex-col gap-1 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-muted)] px-2 py-2 text-[0.75rem]";
  const rowHeader = "flex items-center justify-between gap-2";
  const rowTitle = "flex items-center gap-2 text-[color:var(--text-strong)]";
  const orderBadge =
    "inline-flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--border-muted)] text-[0.6rem] text-[color:var(--text-soft)]";
  const cacheBadge =
    "rounded-full border border-[color:var(--border-muted)] px-1.5 py-[0.1rem] text-[0.55rem] uppercase tracking-[0.12em] text-[color:var(--text-muted)]";
  const barTrack = "h-1.5 w-full rounded-full bg-[color:var(--border-subtle)]";
  const barFill = "h-full rounded-full bg-[color:var(--status-info-border)]";
  const barFillCached =
    "h-full rounded-full bg-[color:var(--status-warn-border)]";

  return (
    <div class={panelRoot} role="region" aria-label="Execution timeline">
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class={panelTitle}>Execution Timeline</div>
          <div class={panelMeta}>
            <span>Total {formatDuration(props.totalMs)}</span>
            {props.active ? <span class={liveBadge}>Live</span> : null}
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <For each={props.entries}>
          {(entry) => {
            const width = () =>
              `${Math.min(100, (entry.durationMs / maxDuration()) * 100)}%`;
            return (
              <div class={row}>
                <div class={rowHeader}>
                  <div class={rowTitle}>
                    <span class={orderBadge}>{entry.order}</span>
                    <span class="truncate">{entry.nodeType}</span>
                    {entry.cacheHit ? (
                      <span class={cacheBadge}>Cache</span>
                    ) : null}
                  </div>
                  <span class="text-[color:var(--text-muted)]">
                    {formatDuration(entry.durationMs)}
                  </span>
                </div>
                <div class={barTrack}>
                  <div
                    class={entry.cacheHit ? barFillCached : barFill}
                    style={{ width: width() }}
                  />
                </div>
              </div>
            );
          }}
        </For>
        {props.entries.length === 0 ? (
          <div class="rounded-lg border border-dashed border-[color:var(--border-muted)] bg-[color:var(--surface-panel-muted)] px-2 py-2 text-[0.75rem] text-[color:var(--text-muted)]">
            No execution data yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
