import { describe, expect, it } from "vitest";

import type {
  KeybindingActionId,
  KeybindingProfile,
  KeybindingState,
} from "../src/editor/keybindings";
import {
  DEFAULT_KEYBINDING_PROFILE_ID,
  DEFAULT_KEYBINDING_PROFILE_NAME,
  DEFAULT_KEYBINDING_STATE,
  getKeybindingConflicts,
  normalizeKeybindingChord,
  resolveKeybindingAction,
  coerceKeybindingState,
} from "../src/editor/keybindings";

describe("keybinding utilities", () => {
  it("normalizes chord aliases and modifier ordering", () => {
    expect(normalizeKeybindingChord("shift+mod+z")).toBe("Mod+Shift+Z");
    expect(normalizeKeybindingChord("ctrl+shift+z")).toBe("Ctrl+Shift+Z");
  });

  it("resolves actions from keyboard events", () => {
    const profile: KeybindingProfile = {
      id: "profile-1",
      name: "Test",
      bindings: {
        ...DEFAULT_KEYBINDING_STATE.profiles[0].bindings,
        "history.undo": ["Mod+Z"],
      },
    };
    const event = {
      key: "z",
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent;

    expect(resolveKeybindingAction(event, profile)).toBe(
      "history.undo" satisfies KeybindingActionId,
    );
  });

  it("detects conflicting bindings", () => {
    const bindings = {
      ...DEFAULT_KEYBINDING_STATE.profiles[0].bindings,
      "history.undo": ["Mod+Z"],
      "history.redo": ["Mod+Z"],
    } as const satisfies Record<KeybindingActionId, ReadonlyArray<string>>;
    const profile: KeybindingProfile = {
      id: "profile-2",
      name: "Conflicts",
      bindings,
    };
    const conflicts = getKeybindingConflicts(profile);
    expect(conflicts.get("Mod+Z")).toEqual(
      expect.arrayContaining(["history.undo", "history.redo"]),
    );
  });

  it("coerces keybinding state with invalid active profile ids", () => {
    const raw: KeybindingState = {
      activeProfileId: "missing",
      profiles: [
        {
          id: DEFAULT_KEYBINDING_PROFILE_ID,
          name: DEFAULT_KEYBINDING_PROFILE_NAME,
          bindings: DEFAULT_KEYBINDING_STATE.profiles[0].bindings,
        },
      ],
    };
    const coerced = coerceKeybindingState(raw);
    expect(coerced.activeProfileId).toBe(DEFAULT_KEYBINDING_PROFILE_ID);
  });
});
