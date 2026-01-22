import type { JsonObject } from "@shadr/shared";

export type KeybindingChord = string;
export type KeybindingSequence = ReadonlyArray<KeybindingChord>;
export type KeybindingActionDefinition = Readonly<{
  id: string;
  label: string;
  description: string;
  category: string;
  defaultBindings: ReadonlyArray<KeybindingChord>;
}>;

export const KEYBINDING_ACTIONS = [
  {
    id: "commandPalette.open",
    label: "Open command palette",
    description: "Search commands and nodes.",
    category: "General",
    defaultBindings: ["Space"],
  },
  {
    id: "menu.context",
    label: "Open context menu",
    description: "Open the canvas context menu.",
    category: "General",
    defaultBindings: ["ContextMenu", "Shift+F10"],
  },
  {
    id: "history.undo",
    label: "Undo",
    description: "Revert the last change.",
    category: "History",
    defaultBindings: ["Mod+Z"],
  },
  {
    id: "history.redo",
    label: "Redo",
    description: "Reapply the last change.",
    category: "History",
    defaultBindings: ["Mod+Shift+Z", "Mod+Y"],
  },
  {
    id: "selection.delete",
    label: "Delete selection",
    description: "Remove selected nodes, frames, or wires.",
    category: "Selection",
    defaultBindings: ["Backspace", "Delete"],
  },
  {
    id: "selection.toggleBypass",
    label: "Toggle bypass",
    description: "Bypass selected nodes.",
    category: "Selection",
    defaultBindings: ["B"],
  },
  {
    id: "view.frameSelection",
    label: "Frame selection",
    description: "Frame the current selection.",
    category: "View",
    defaultBindings: ["F"],
  },
  {
    id: "view.frameAll",
    label: "Frame all",
    description: "Frame all nodes in view.",
    category: "View",
    defaultBindings: ["Shift+F"],
  },
  {
    id: "group.create",
    label: "Group selection",
    description: "Create a frame from selected nodes.",
    category: "Selection",
    defaultBindings: ["Mod+G"],
  },
  {
    id: "group.ungroup",
    label: "Ungroup selection",
    description: "Ungroup the selected frame.",
    category: "Selection",
    defaultBindings: ["Mod+Shift+G"],
  },
  {
    id: "navigation.focusNext",
    label: "Focus next",
    description: "Move keyboard focus forward.",
    category: "Navigation",
    defaultBindings: ["Tab"],
  },
  {
    id: "navigation.focusPrev",
    label: "Focus previous",
    description: "Move keyboard focus backward.",
    category: "Navigation",
    defaultBindings: ["Shift+Tab"],
  },
  {
    id: "navigation.activate",
    label: "Activate focus",
    description: "Enter the focused element.",
    category: "Navigation",
    defaultBindings: ["Enter"],
  },
  {
    id: "navigation.activateReverse",
    label: "Reverse activate",
    description: "Reverse the focused navigation.",
    category: "Navigation",
    defaultBindings: ["Shift+Enter"],
  },
  {
    id: "navigation.socketInput",
    label: "Focus input sockets",
    description: "Jump to the input socket column.",
    category: "Navigation",
    defaultBindings: ["Mod+Shift+ArrowLeft"],
  },
  {
    id: "navigation.socketOutput",
    label: "Focus output sockets",
    description: "Jump to the output socket column.",
    category: "Navigation",
    defaultBindings: ["Mod+Shift+ArrowRight"],
  },
  {
    id: "navigation.socketUp",
    label: "Focus socket up",
    description: "Move to the previous socket.",
    category: "Navigation",
    defaultBindings: ["Mod+Shift+ArrowUp"],
  },
  {
    id: "navigation.socketDown",
    label: "Focus socket down",
    description: "Move to the next socket.",
    category: "Navigation",
    defaultBindings: ["Mod+Shift+ArrowDown"],
  },
  {
    id: "navigation.nodeLeft",
    label: "Focus node left",
    description: "Focus the nearest node to the left.",
    category: "Navigation",
    defaultBindings: ["Mod+ArrowLeft"],
  },
  {
    id: "navigation.nodeRight",
    label: "Focus node right",
    description: "Focus the nearest node to the right.",
    category: "Navigation",
    defaultBindings: ["Mod+ArrowRight"],
  },
  {
    id: "navigation.nodeUp",
    label: "Focus node up",
    description: "Focus the nearest node above.",
    category: "Navigation",
    defaultBindings: ["Mod+ArrowUp"],
  },
  {
    id: "navigation.nodeDown",
    label: "Focus node down",
    description: "Focus the nearest node below.",
    category: "Navigation",
    defaultBindings: ["Mod+ArrowDown"],
  },
  {
    id: "view.panUp",
    label: "Pan up",
    description: "Pan the canvas upward.",
    category: "View",
    defaultBindings: ["ArrowUp", "Shift+ArrowUp"],
  },
  {
    id: "view.panDown",
    label: "Pan down",
    description: "Pan the canvas downward.",
    category: "View",
    defaultBindings: ["ArrowDown", "Shift+ArrowDown"],
  },
  {
    id: "view.panLeft",
    label: "Pan left",
    description: "Pan the canvas left.",
    category: "View",
    defaultBindings: ["ArrowLeft", "Shift+ArrowLeft"],
  },
  {
    id: "view.panRight",
    label: "Pan right",
    description: "Pan the canvas right.",
    category: "View",
    defaultBindings: ["ArrowRight", "Shift+ArrowRight"],
  },
  {
    id: "view.zoomIn",
    label: "Zoom in",
    description: "Zoom the canvas in.",
    category: "View",
    defaultBindings: ["]"],
  },
  {
    id: "view.zoomOut",
    label: "Zoom out",
    description: "Zoom the canvas out.",
    category: "View",
    defaultBindings: ["["],
  },
  {
    id: "clipboard.copy",
    label: "Copy",
    description: "Copy the selection.",
    category: "Clipboard",
    defaultBindings: ["Mod+C"],
  },
  {
    id: "clipboard.duplicate",
    label: "Duplicate",
    description: "Duplicate the selection.",
    category: "Clipboard",
    defaultBindings: ["Mod+D"],
  },
  {
    id: "clipboard.paste",
    label: "Paste",
    description: "Paste from the clipboard.",
    category: "Clipboard",
    defaultBindings: ["Mod+V"],
  },
] as const satisfies ReadonlyArray<KeybindingActionDefinition>;

export type KeybindingAction = (typeof KEYBINDING_ACTIONS)[number];
export type KeybindingActionId = KeybindingAction["id"];

export type KeybindingProfile = Readonly<{
  id: string;
  name: string;
  bindings: Record<KeybindingActionId, ReadonlyArray<KeybindingChord>>;
}>;

export type KeybindingState = Readonly<{
  activeProfileId: string;
  profiles: ReadonlyArray<KeybindingProfile>;
}>;

export const KEYBINDING_EXPORT_VERSION = 1;

export const DEFAULT_KEYBINDING_PROFILE_ID = "default";
export const DEFAULT_KEYBINDING_PROFILE_NAME = "Default";

const MODIFIER_ORDER = ["Mod", "Ctrl", "Meta", "Alt", "Shift"] as const;

const MODIFIER_ALIASES: Record<string, (typeof MODIFIER_ORDER)[number]> = {
  mod: "Mod",
  ctrl: "Ctrl",
  control: "Ctrl",
  meta: "Meta",
  cmd: "Meta",
  command: "Meta",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
};

const KEY_ALIASES: Record<string, string> = {
  esc: "Escape",
  escape: "Escape",
  space: "Space",
  spacebar: "Space",
  del: "Delete",
  delete: "Delete",
  backspace: "Backspace",
  enter: "Enter",
  return: "Enter",
  tab: "Tab",
  contextmenu: "ContextMenu",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  pageup: "PageUp",
  pagedown: "PageDown",
  home: "Home",
  end: "End",
  insert: "Insert",
};

const SEQUENCE_DELIMITER = /\s+/;

const buildDefaultBindings = (): Record<
  KeybindingActionId,
  ReadonlyArray<KeybindingChord>
> => {
  const entries = KEYBINDING_ACTIONS.map((action) => [
    action.id,
    action.defaultBindings,
  ]);
  return Object.fromEntries(entries) as Record<
    KeybindingActionId,
    ReadonlyArray<KeybindingChord>
  >;
};

export const DEFAULT_KEYBINDING_STATE: KeybindingState = {
  activeProfileId: DEFAULT_KEYBINDING_PROFILE_ID,
  profiles: [
    {
      id: DEFAULT_KEYBINDING_PROFILE_ID,
      name: DEFAULT_KEYBINDING_PROFILE_NAME,
      bindings: buildDefaultBindings(),
    },
  ],
};

const normalizeKeyLabel = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length === 1) {
    return trimmed.toUpperCase();
  }
  const lower = trimmed.toLowerCase();
  const alias = KEY_ALIASES[lower];
  if (alias) {
    return alias;
  }
  if (/^f\d{1,2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return trimmed;
};

const splitKeybindingSequence = (binding: string): ReadonlyArray<string> => {
  const trimmed = binding.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split(SEQUENCE_DELIMITER)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
};

const parseChordParts = (
  chord: string,
): { key: string; modifiers: Set<(typeof MODIFIER_ORDER)[number]> } | null => {
  const tokens = chord
    .split("+")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return null;
  }
  let key = "";
  const modifiers = new Set<(typeof MODIFIER_ORDER)[number]>();
  for (const token of tokens) {
    const normalized = MODIFIER_ALIASES[token.toLowerCase()];
    if (normalized) {
      modifiers.add(normalized);
      continue;
    }
    if (!key) {
      key = normalizeKeyLabel(token);
      continue;
    }
  }
  if (!key) {
    return null;
  }
  if (modifiers.has("Mod")) {
    modifiers.delete("Ctrl");
    modifiers.delete("Meta");
  }
  return { key, modifiers };
};

export const normalizeKeybindingChord = (
  chord: string,
): KeybindingChord | null => {
  const parsed = parseChordParts(chord);
  if (!parsed) {
    return null;
  }
  const parts: string[] = MODIFIER_ORDER.filter((mod) =>
    parsed.modifiers.has(mod),
  );
  parts.push(parsed.key);
  return parts.join("+");
};

const parseBindingSequence = (binding: string): KeybindingSequence | null => {
  const parts = splitKeybindingSequence(binding);
  if (parts.length === 0) {
    return null;
  }
  const normalized = parts
    .map((part) => normalizeKeybindingChord(part))
    .filter((entry): entry is KeybindingChord => entry !== null);
  if (normalized.length !== parts.length) {
    return null;
  }
  return normalized;
};

export const normalizeKeybindingBinding = (
  binding: string,
): KeybindingChord | null => {
  const sequence = parseBindingSequence(binding);
  if (!sequence) {
    return null;
  }
  return sequence.join(" ");
};

const parseChord = (
  chord: string,
): {
  key: string;
  modifiers: Record<(typeof MODIFIER_ORDER)[number], boolean>;
} | null => {
  const normalized = normalizeKeybindingChord(chord);
  if (!normalized) {
    return null;
  }
  const parts = normalized.split("+");
  const key = parts[parts.length - 1];
  if (!key) {
    return null;
  }
  const modifiers = {
    Mod: false,
    Ctrl: false,
    Meta: false,
    Alt: false,
    Shift: false,
  };
  for (const part of parts.slice(0, -1)) {
    if (part in modifiers) {
      modifiers[part as keyof typeof modifiers] = true;
    }
  }
  return { key, modifiers };
};

const isModifierKey = (key: string): boolean =>
  key === "Shift" || key === "Control" || key === "Meta" || key === "Alt";

export const eventToKeybindingChord = (
  event: KeyboardEvent,
): KeybindingChord | null => {
  const key = normalizeKeyLabel(event.key);
  if (!key || isModifierKey(event.key)) {
    return null;
  }
  const modifiers = new Set<(typeof MODIFIER_ORDER)[number]>();
  if (event.ctrlKey || event.metaKey) {
    modifiers.add("Mod");
  }
  if (event.altKey) {
    modifiers.add("Alt");
  }
  if (event.shiftKey) {
    modifiers.add("Shift");
  }
  const parts: string[] = MODIFIER_ORDER.filter((mod) => modifiers.has(mod));
  parts.push(key);
  return parts.join("+");
};

export const matchKeybinding = (
  event: KeyboardEvent,
  chord: KeybindingChord,
): boolean => {
  const parsed = parseChord(chord);
  if (!parsed) {
    return false;
  }
  const key = normalizeKeyLabel(event.key);
  if (!key || key !== parsed.key) {
    return false;
  }
  if (event.shiftKey !== parsed.modifiers.Shift) {
    return false;
  }
  if (event.altKey !== parsed.modifiers.Alt) {
    return false;
  }
  if (parsed.modifiers.Mod) {
    if (!event.ctrlKey && !event.metaKey) {
      return false;
    }
  } else {
    if (event.ctrlKey !== parsed.modifiers.Ctrl) {
      return false;
    }
    if (event.metaKey !== parsed.modifiers.Meta) {
      return false;
    }
  }
  return true;
};

export const resolveKeybindingAction = (
  event: KeyboardEvent,
  profile: KeybindingProfile,
): KeybindingActionId | null => {
  for (const action of KEYBINDING_ACTIONS) {
    const bindings = profile.bindings[action.id] ?? [];
    for (const binding of bindings) {
      if (matchKeybinding(event, binding)) {
        return action.id;
      }
    }
  }
  return null;
};

export const resolveKeybindingSequence = (
  sequence: KeybindingSequence,
  profile: KeybindingProfile,
): KeybindingActionId | null => {
  if (sequence.length === 0) {
    return null;
  }
  for (const action of KEYBINDING_ACTIONS) {
    const bindings = profile.bindings[action.id] ?? [];
    for (const binding of bindings) {
      const bindingSequence = parseBindingSequence(binding);
      if (!bindingSequence) {
        continue;
      }
      if (
        bindingSequence.length === sequence.length &&
        bindingSequence.every((value, index) => value === sequence[index])
      ) {
        return action.id;
      }
    }
  }
  return null;
};

export const isKeybindingSequencePrefix = (
  sequence: KeybindingSequence,
  profile: KeybindingProfile,
): boolean => {
  if (sequence.length === 0) {
    return false;
  }
  for (const action of KEYBINDING_ACTIONS) {
    const bindings = profile.bindings[action.id] ?? [];
    for (const binding of bindings) {
      const bindingSequence = parseBindingSequence(binding);
      if (!bindingSequence || bindingSequence.length < sequence.length) {
        continue;
      }
      const isPrefix = sequence.every(
        (value, index) => value === bindingSequence[index],
      );
      if (isPrefix) {
        return true;
      }
    }
  }
  return false;
};

export const serializeKeybindingSequence = (
  sequence: KeybindingSequence,
): KeybindingChord | null => {
  if (sequence.length === 0) {
    return null;
  }
  const normalized = sequence
    .map((entry) => normalizeKeybindingChord(entry))
    .filter((entry): entry is KeybindingChord => entry !== null);
  if (normalized.length !== sequence.length) {
    return null;
  }
  return normalized.join(" ");
};

export const getKeybindingConflicts = (
  profile: KeybindingProfile,
): ReadonlyMap<KeybindingChord, ReadonlyArray<KeybindingActionId>> => {
  const usage = new Map<KeybindingChord, KeybindingActionId[]>();
  for (const action of KEYBINDING_ACTIONS) {
    const bindings = profile.bindings[action.id] ?? [];
    for (const binding of bindings) {
      const normalized = normalizeKeybindingBinding(binding);
      if (!normalized) {
        continue;
      }
      const entries = usage.get(normalized) ?? [];
      entries.push(action.id);
      usage.set(normalized, entries);
    }
  }
  const conflicts = new Map<
    KeybindingChord,
    ReadonlyArray<KeybindingActionId>
  >();
  for (const [binding, actions] of usage) {
    if (actions.length > 1) {
      conflicts.set(binding, actions);
    }
  }
  return conflicts;
};

export const getActiveKeybindingProfile = (
  state: KeybindingState,
): KeybindingProfile => {
  const active =
    state.profiles.find((profile) => profile.id === state.activeProfileId) ??
    state.profiles[0];
  return active ?? DEFAULT_KEYBINDING_STATE.profiles[0];
};

export const createKeybindingProfileId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `profile-${Date.now().toString(36)}-${Math.round(
    Math.random() * 9999,
  ).toString(36)}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const coerceBindingList = (
  value: unknown,
  fallback: ReadonlyArray<KeybindingChord>,
): ReadonlyArray<KeybindingChord> => {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : null;
  if (rawList === null) {
    return fallback;
  }
  const normalized = rawList
    .map((entry) =>
      typeof entry === "string" ? normalizeKeybindingBinding(entry) : null,
    )
    .filter((entry): entry is KeybindingChord => entry !== null);
  return normalized;
};

const coerceProfile = (value: unknown): KeybindingProfile | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id = typeof value.id === "string" ? value.id : null;
  const name = typeof value.name === "string" ? value.name : null;
  if (!id || !name) {
    return null;
  }
  const bindingsSource = isRecord(value.bindings) ? value.bindings : {};
  const bindings: Record<
    KeybindingActionId,
    ReadonlyArray<KeybindingChord>
  > = {} as Record<KeybindingActionId, ReadonlyArray<KeybindingChord>>;
  for (const action of KEYBINDING_ACTIONS) {
    const raw = bindingsSource[action.id];
    const fallback = action.defaultBindings;
    bindings[action.id] =
      raw === undefined ? fallback : coerceBindingList(raw, fallback);
  }
  return { id, name, bindings };
};

export const coerceKeybindingState = (
  value: JsonObject | null | undefined,
): KeybindingState => {
  if (!value || typeof value !== "object") {
    return DEFAULT_KEYBINDING_STATE;
  }
  const profilesValue = Array.isArray(value.profiles) ? value.profiles : [];
  const profiles = profilesValue
    .map(coerceProfile)
    .filter((profile): profile is KeybindingProfile => profile !== null);
  if (profiles.length === 0) {
    return DEFAULT_KEYBINDING_STATE;
  }
  const activeProfileId =
    typeof value.activeProfileId === "string" ? value.activeProfileId : null;
  const resolvedActive = profiles.find(
    (profile) => profile.id === activeProfileId,
  )
    ? (activeProfileId ?? profiles[0].id)
    : profiles[0].id;
  return {
    activeProfileId: resolvedActive,
    profiles,
  };
};

export const keybindingStateToJson = (state: KeybindingState): JsonObject => ({
  version: KEYBINDING_EXPORT_VERSION,
  activeProfileId: state.activeProfileId,
  profiles: state.profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    bindings: profile.bindings,
  })),
});

export const formatKeybindingChord = (
  chord: KeybindingChord,
  isMac: boolean,
): string => {
  const parsed = parseChord(chord);
  if (!parsed) {
    return chord;
  }
  const parts: string[] = [];
  if (parsed.modifiers.Mod) {
    parts.push(isMac ? "CMD" : "CTRL");
  } else {
    if (parsed.modifiers.Ctrl) {
      parts.push("CTRL");
    }
    if (parsed.modifiers.Meta) {
      parts.push("CMD");
    }
  }
  if (parsed.modifiers.Alt) {
    parts.push(isMac ? "OPT" : "ALT");
  }
  if (parsed.modifiers.Shift) {
    parts.push("SHIFT");
  }
  const keyLabel =
    parsed.key === "ArrowUp"
      ? "UP"
      : parsed.key === "ArrowDown"
        ? "DOWN"
        : parsed.key === "ArrowLeft"
          ? "LEFT"
          : parsed.key === "ArrowRight"
            ? "RIGHT"
            : parsed.key === "Space"
              ? "SPACE"
              : parsed.key.toUpperCase();
  parts.push(keyLabel);
  return parts.join("+");
};

export const formatKeybindingBinding = (
  binding: KeybindingChord,
  isMac: boolean,
): string => {
  const sequence = parseBindingSequence(binding);
  if (!sequence) {
    return binding;
  }
  return sequence
    .map((chord) => formatKeybindingChord(chord, isMac))
    .join(", ");
};
