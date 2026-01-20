import * as Dialog from "@kobalte/core/dialog";
import {
  Command,
  CornerDownLeft,
  Layers3,
  Search,
  Settings2,
} from "lucide-solid";
import { createEffect, createMemo, createSignal, For } from "solid-js";

export type CommandPaletteEntry = Readonly<{
  id: string;
  label: string;
  description?: string;
  kind: "command" | "node" | "control";
  keywords?: ReadonlyArray<string>;
  stateLabel?: string;
  enabled?: boolean;
  onSelect: () => void;
}>;

type CommandPaletteProps = Readonly<{
  open: boolean;
  onOpenChange: NonNullable<Dialog.DialogRootProps["onOpenChange"]>;
  entries: ReadonlyArray<CommandPaletteEntry>;
}>;

type KindStyle = Readonly<{
  icon: typeof Command;
  label: string;
  badge: string;
}>;

const KIND_STYLE: Record<CommandPaletteEntry["kind"], KindStyle> = {
  command: {
    icon: Command,
    label: "CMD",
    badge:
      "border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)]",
  },
  node: {
    icon: Layers3,
    label: "Node",
    badge:
      "border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]",
  },
  control: {
    icon: Settings2,
    label: "CTRL",
    badge:
      "border-[color:var(--status-warn-border)] bg-[color:var(--status-warn-bg)] text-[color:var(--status-warn-text)]",
  },
};

const KIND_ORDER: ReadonlyArray<CommandPaletteEntry["kind"]> = [
  "command",
  "control",
  "node",
];

const MAX_RESULTS = 18;

const normalize = (value: string): string => value.trim().toLowerCase();

const scoreMatch = (query: string, text: string): number | null => {
  if (query.length === 0) {
    return 0;
  }
  const haystack = normalize(text);
  let score = 0;
  let lastIndex = -1;
  let contiguous = 0;
  for (const char of query) {
    const index = haystack.indexOf(char, lastIndex + 1);
    if (index === -1) {
      return null;
    }
    const atWordStart =
      index === 0 ||
      haystack[index - 1] === " " ||
      haystack[index - 1] === "-" ||
      haystack[index - 1] === ":";
    score += atWordStart ? 6 : 2;
    if (index === lastIndex + 1) {
      contiguous += 1;
      score += 2 * contiguous;
    } else {
      contiguous = 0;
    }
    lastIndex = index;
  }
  if (haystack.startsWith(query)) {
    score += 6;
  }
  score += Math.max(0, 12 - (haystack.length - query.length) * 0.2);
  return score;
};

const scoreEntry = (
  query: string,
  entry: CommandPaletteEntry,
): number | null => {
  if (query.length === 0) {
    return 0;
  }
  const candidates = [entry.label, entry.description]
    .filter((value): value is string => typeof value === "string")
    .concat(entry.keywords ?? []);
  let best: number | null = null;
  for (const candidate of candidates) {
    const score = scoreMatch(query, candidate);
    if (score === null) {
      continue;
    }
    const weighted = candidate === entry.label ? score * 1.4 : score;
    if (best === null || weighted > best) {
      best = weighted;
    }
  }
  return best;
};

const sortEntries = (
  entries: ReadonlyArray<CommandPaletteEntry>,
  query: string,
): ReadonlyArray<CommandPaletteEntry> => {
  if (query.length === 0) {
    return [...entries].sort((left, right) => {
      const kindOrder =
        KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind);
      if (kindOrder !== 0) {
        return kindOrder;
      }
      return left.label.localeCompare(right.label);
    });
  }
  const scored = entries
    .map((entry) => ({ entry, score: scoreEntry(query, entry) }))
    .filter(
      (value): value is { entry: CommandPaletteEntry; score: number } =>
        value.score !== null,
    );
  scored.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    return left.entry.label.localeCompare(right.entry.label);
  });
  return scored.map((value) => value.entry);
};

export default function CommandPalette(props: CommandPaletteProps) {
  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  const results = createMemo(() => {
    const currentQuery = normalize(query());
    const sorted = sortEntries(props.entries, currentQuery);
    return sorted.slice(0, MAX_RESULTS);
  });

  const activeEntry = createMemo(() => {
    const list = results();
    if (list.length === 0) {
      return null;
    }
    const index = Math.min(Math.max(activeIndex(), 0), list.length - 1);
    return list[index] ?? null;
  });

  const selectEntry = (entry: CommandPaletteEntry | null): void => {
    if (!entry || entry.enabled === false) {
      return;
    }
    entry.onSelect();
    props.onOpenChange(false);
    setQuery("");
  };

  createEffect(() => {
    if (!props.open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    if (inputRef) {
      requestAnimationFrame(() => {
        inputRef?.focus();
        inputRef?.select();
      });
    }
  });

  createEffect(() => {
    query();
    setActiveIndex(0);
  });

  createEffect(() => {
    const list = results();
    if (list.length === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((index) => Math.min(index, list.length - 1));
  });

  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={props.onOpenChange}
      modal={true}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-[var(--layer-modal-overlay)] bg-[color:var(--overlay-bg)] backdrop-blur-sm" />
        <Dialog.Content class="fixed left-1/2 top-[18vh] z-[var(--layer-modal)] w-[min(92vw,720px)] -translate-x-1/2 rounded-[1.2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-panel-strong)] p-4 text-[color:var(--app-text)] shadow-[var(--shadow-popup)]">
          <Dialog.Title class="sr-only">Command palette</Dialog.Title>
          <Dialog.Description class="sr-only">
            Search commands, nodes, and controls.
          </Dialog.Description>
          <div class="flex items-center gap-3 rounded-[0.9rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-panel-muted)] px-3 py-2">
            <Search class="h-4 w-4 text-[color:var(--text-muted)]" />
            <input
              ref={inputRef}
              class="w-full bg-transparent text-[0.9rem] text-[color:var(--text-strong)] placeholder:text-[color:var(--text-muted)] focus:outline-none"
              placeholder="Search commands, nodes, controls"
              aria-label="Search commands, nodes, and controls"
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index) =>
                    Math.min(index + 1, results().length - 1),
                  );
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((index) => Math.max(index - 1, 0));
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  selectEntry(activeEntry());
                }
              }}
            />
          </div>

          <div class="mt-3 max-h-[52vh] overflow-y-auto pr-1">
            {results().length === 0 ? (
              <div class="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-muted)] px-3 py-4 text-center text-[0.8rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                No matches
              </div>
            ) : (
              <div class="flex flex-col gap-2">
                <For each={results()}>
                  {(entry, index) => {
                    const style = KIND_STYLE[entry.kind];
                    const Icon = style.icon;
                    const isActive = () => index() === activeIndex();
                    const isDisabled = () => entry.enabled === false;
                    return (
                      <button
                        class={`flex w-full items-center justify-between gap-4 rounded-xl border px-3 py-2 text-left transition ${
                          isActive()
                            ? "border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)]"
                            : "border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-muted)] hover:border-[color:var(--border-strong)]"
                        } ${isDisabled() ? "opacity-50" : "opacity-100"}`}
                        onMouseEnter={() => setActiveIndex(index())}
                        onClick={() => selectEntry(entry)}
                        disabled={isDisabled()}
                      >
                        <div class="flex min-w-0 flex-1 items-center gap-3">
                          <span
                            class={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[0.55rem] uppercase tracking-[0.2em] ${style.badge}`}
                          >
                            <Icon class="h-3 w-3" />
                            {style.label}
                          </span>
                          <div class="min-w-0">
                            <div class="truncate text-[0.9rem]">
                              {entry.label}
                            </div>
                            {entry.description ? (
                              <div class="truncate text-[0.75rem] text-[color:var(--text-muted)]">
                                {entry.description}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          {entry.stateLabel ? (
                            <span class="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-chip)] px-2 py-1 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                              {entry.stateLabel}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            )}
          </div>

          <div class="mt-3 flex items-center justify-between text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
            <span class="inline-flex items-center gap-2">
              <CornerDownLeft class="h-3 w-3" />
              Run
            </span>
            <span class="inline-flex items-center gap-2">
              <Command class="h-3 w-3" />
              Cmd/Ctrl+K
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
