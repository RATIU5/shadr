/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";

import CommandPalette, {
  type CommandPaletteEntry,
  parseCommandPaletteQuery,
  sortCommandPaletteEntries,
} from "../src/components/CommandPalette";

type MountedPalette = {
  dispose: () => void;
  container: HTMLDivElement;
};

const mountCommandPalette = (
  entries: ReadonlyArray<CommandPaletteEntry>,
  onOpenChange: (open: boolean) => void,
): MountedPalette => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispose = render(
    () =>
      CommandPalette({
        open: true,
        onOpenChange,
        entries,
      }),
    container,
  );
  return { dispose, container };
};

const getSearchInput = (): HTMLInputElement => {
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="Search commands, nodes, and controls"]',
  );
  if (!input) {
    throw new Error("Command palette input not found");
  }
  return input;
};

describe("CommandPalette keyboard navigation", () => {
  let mounted: MountedPalette | null = null;

  beforeEach(() => {
    if (!globalThis.requestAnimationFrame) {
      globalThis.requestAnimationFrame = (callback) =>
        window.setTimeout(callback, 0);
    }
  });

  afterEach(() => {
    mounted?.dispose();
    mounted?.container.remove();
    mounted = null;
    document.body.innerHTML = "";
  });

  it("selects the next entry with ArrowDown and runs it on Enter", () => {
    const firstSelect = vi.fn();
    const secondSelect = vi.fn();
    const onOpenChange = vi.fn();
    const entries: CommandPaletteEntry[] = [
      { id: "alpha", label: "Alpha", kind: "command", onSelect: firstSelect },
      { id: "beta", label: "Beta", kind: "command", onSelect: secondSelect },
    ];

    mounted = mountCommandPalette(entries, onOpenChange);
    const input = getSearchInput();

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(firstSelect).not.toHaveBeenCalled();
    expect(secondSelect).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the first entry active when ArrowUp is pressed at the top", () => {
    const firstSelect = vi.fn();
    const secondSelect = vi.fn();
    const onOpenChange = vi.fn();
    const entries: CommandPaletteEntry[] = [
      { id: "alpha", label: "Alpha", kind: "command", onSelect: firstSelect },
      { id: "beta", label: "Beta", kind: "command", onSelect: secondSelect },
    ];

    mounted = mountCommandPalette(entries, onOpenChange);
    const input = getSearchInput();

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(firstSelect).toHaveBeenCalledTimes(1);
    expect(secondSelect).not.toHaveBeenCalled();
  });

  it("filters by kind tags in the query", () => {
    const entries: CommandPaletteEntry[] = [
      { id: "alpha", label: "Alpha", kind: "command", onSelect: vi.fn() },
      { id: "beta", label: "Beta", kind: "control", onSelect: vi.fn() },
      { id: "gamma", label: "Gamma", kind: "node", onSelect: vi.fn() },
    ];
    const cmdQuery = parseCommandPaletteQuery("cmd");
    const cmdResults = sortCommandPaletteEntries(
      entries,
      cmdQuery.query,
      cmdQuery.kinds,
    );
    expect(cmdResults).toHaveLength(1);
    expect(cmdResults[0]?.label).toBe("Alpha");

    const ctrlQuery = parseCommandPaletteQuery("ctrl");
    const ctrlResults = sortCommandPaletteEntries(
      entries,
      ctrlQuery.query,
      ctrlQuery.kinds,
    );
    expect(ctrlResults).toHaveLength(1);
    expect(ctrlResults[0]?.label).toBe("Beta");

    const nodeQuery = parseCommandPaletteQuery("node");
    const nodeResults = sortCommandPaletteEntries(
      entries,
      nodeQuery.query,
      nodeQuery.kinds,
    );
    expect(nodeResults).toHaveLength(1);
    expect(nodeResults[0]?.label).toBe("Gamma");
  });
});
