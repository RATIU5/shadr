/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createComponent, createSignal } from "solid-js";
import { render } from "solid-js/web";

import KeybindingSettingsPanel from "../src/components/KeybindingSettingsPanel";
import {
  DEFAULT_KEYBINDING_STATE,
  KEYBINDING_ACTIONS,
  type KeybindingActionId,
  type KeybindingState,
} from "../src/editor/keybindings";

type MountedPanel = {
  dispose: () => void;
  container: HTMLDivElement;
  getState: () => KeybindingState;
};

const cloneKeybindingState = (): KeybindingState => ({
  activeProfileId: DEFAULT_KEYBINDING_STATE.activeProfileId,
  profiles: DEFAULT_KEYBINDING_STATE.profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    bindings: KEYBINDING_ACTIONS.reduce<
      KeybindingState["profiles"][number]["bindings"]
    >((next, action) => {
      next[action.id] = [...(profile.bindings[action.id] ?? [])];
      return next;
    }, {} as KeybindingState["profiles"][number]["bindings"]),
  })),
});

const mountSettingsPanel = (): MountedPanel => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let latestState = cloneKeybindingState();
  const dispose = render(() => {
    const [keybindings, setKeybindings] = createSignal(latestState);
    const handleChange = (next: KeybindingState): void => {
      latestState = next;
      setKeybindings(next);
    };
    return createComponent(KeybindingSettingsPanel, {
      keybindings,
      onChange: handleChange,
    });
  }, container);
  return { dispose, container, getState: () => latestState };
};

const findActionCard = (label: string): HTMLElement => {
  const labelNode = Array.from(document.querySelectorAll("span")).find(
    (node) => node.textContent?.trim() === label,
  );
  if (!labelNode) {
    throw new Error(`Action label not found: ${label}`);
  }
  const card = labelNode.closest("div.rounded-xl");
  if (!card || !(card instanceof HTMLElement)) {
    throw new Error(`Action card not found for label: ${label}`);
  }
  return card;
};

const getBindings = (
  state: KeybindingState,
  actionId: KeybindingActionId,
): ReadonlyArray<string> =>
  state.profiles.find((profile) => profile.id === state.activeProfileId)
    ?.bindings[actionId] ?? [];

describe("KeybindingSettingsPanel keyboard capture", () => {
  let mounted: MountedPanel | null = null;

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

  it("adds a new binding when capturing a shortcut", () => {
    mounted = mountSettingsPanel();
    const card = findActionCard("Zoom in");
    const addButton = Array.from(card.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add",
    );
    if (!addButton) {
      throw new Error("Add button not found");
    }
    addButton.click();

    expect(document.body.textContent).toContain(
      "Press keys to set the shortcut",
    );

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "z",
        shiftKey: true,
        bubbles: true,
      }),
    );

    expect(document.body.textContent).not.toContain(
      "Press keys to set the shortcut",
    );
    expect(getBindings(mounted.getState(), "view.zoomIn")).toContain("Shift+Z");
  });

  it("removes a binding when Backspace is pressed during capture", () => {
    mounted = mountSettingsPanel();
    const card = findActionCard("Undo");
    const bindingButton = Array.from(card.querySelectorAll("button")).find(
      (button) => {
        const text = button.textContent?.trim();
        return text !== "Add" && text !== "Remove";
      },
    );
    if (!bindingButton) {
      throw new Error("Binding button not found");
    }
    bindingButton.click();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }),
    );

    expect(getBindings(mounted.getState(), "history.undo")).toHaveLength(0);
  });
});
