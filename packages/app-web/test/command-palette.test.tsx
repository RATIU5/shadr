/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";

import CommandPalette, {
  type CommandPaletteEntry,
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
      createComponent(CommandPalette, {
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
});
