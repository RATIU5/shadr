import type { JsonObject } from "@shadr/shared";
import { Copy, Download, Plus, Trash2, Upload, X } from "lucide-solid";
import {
  type Accessor,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import type {
  KeybindingAction,
  KeybindingActionId,
  KeybindingChord,
  KeybindingProfile,
  KeybindingSequence,
  KeybindingState,
} from "~/editor/keybindings";
import {
  coerceKeybindingState,
  createKeybindingProfileId,
  eventToKeybindingChord,
  formatKeybindingBinding,
  formatKeybindingChord,
  getActiveKeybindingProfile,
  getKeybindingConflicts,
  KEYBINDING_ACTIONS,
  keybindingStateToJson,
  serializeKeybindingSequence,
} from "~/editor/keybindings";

type KeybindingSettingsPanelProps = Readonly<{
  keybindings: Accessor<KeybindingState>;
  // eslint-disable-next-line no-unused-vars
  onChange: (value: KeybindingState) => void;
}>;

type CaptureState = Readonly<{
  actionId: KeybindingActionId;
  index: number;
}>;

const isMacPlatform = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /mac|iphone|ipad|ipod/i.test(navigator.platform);
};

const cloneBindings = (
  bindings: KeybindingProfile["bindings"],
): KeybindingProfile["bindings"] => {
  const next: KeybindingProfile["bindings"] =
    {} as KeybindingProfile["bindings"];
  for (const action of KEYBINDING_ACTIONS) {
    next[action.id] = [...(bindings[action.id] ?? action.defaultBindings)];
  }
  return next;
};

const replaceProfile = (
  state: KeybindingState,
  profileId: string,
  nextProfile: KeybindingProfile,
): KeybindingState => ({
  ...state,
  profiles: state.profiles.map((profile) =>
    profile.id === profileId ? nextProfile : profile,
  ),
});

export default function KeybindingSettingsPanel(
  props: KeybindingSettingsPanelProps,
) {
  const [capture, setCapture] = createSignal<CaptureState | null>(null);
  const [captureSequence, setCaptureSequence] =
    createSignal<KeybindingSequence>([]);
  const [importStatus, setImportStatus] = createSignal<string | null>(null);
  let importInputRef: HTMLInputElement | undefined;
  let captureTimer: number | null = null;

  const isMac = createMemo(() => isMacPlatform());
  const activeProfile = createMemo(() =>
    getActiveKeybindingProfile(props.keybindings()),
  );
  const conflicts = createMemo(() => getKeybindingConflicts(activeProfile()));
  const groupedActions = createMemo(() => {
    const groups = new Map<string, KeybindingAction[]>();
    for (const action of KEYBINDING_ACTIONS) {
      const list = groups.get(action.category) ?? [];
      list.push(action);
      groups.set(action.category, list);
    }
    return Array.from(groups.entries());
  });

  const updateState = (
    // eslint-disable-next-line no-unused-vars
    updater: (value: KeybindingState) => KeybindingState,
  ): void => {
    props.onChange(updater(props.keybindings()));
  };

  const updateActiveProfile = (profileId: string): void => {
    updateState((state) => ({ ...state, activeProfileId: profileId }));
  };

  const updateProfile = (
    profileId: string,
    // eslint-disable-next-line no-unused-vars
    updater: (value: KeybindingProfile) => KeybindingProfile,
  ): void => {
    updateState((state) => {
      const current =
        state.profiles.find((profile) => profile.id === profileId) ??
        state.profiles[0];
      if (!current) {
        return state;
      }
      return replaceProfile(state, profileId, updater(current));
    });
  };

  const updateBinding = (
    actionId: KeybindingActionId,
    index: number,
    chord: KeybindingChord | null,
  ): void => {
    const profile = activeProfile();
    const current = profile.bindings[actionId] ?? [];
    const next = [...current];
    if (chord) {
      if (index >= next.length) {
        next.push(chord);
      } else {
        next[index] = chord;
      }
    } else if (index >= 0 && index < next.length) {
      next.splice(index, 1);
    }
    updateProfile(profile.id, (prev) => ({
      ...prev,
      bindings: {
        ...prev.bindings,
        [actionId]: next,
      },
    }));
  };

  const handleCapture = (actionId: KeybindingActionId, index: number): void => {
    setImportStatus(null);
    if (captureTimer) {
      window.clearTimeout(captureTimer);
      captureTimer = null;
    }
    setCaptureSequence([]);
    setCapture({ actionId, index });
  };

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const activeCapture = capture();
      if (!activeCapture) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        if (captureTimer) {
          window.clearTimeout(captureTimer);
          captureTimer = null;
        }
        setCapture(null);
        setCaptureSequence([]);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        updateBinding(activeCapture.actionId, activeCapture.index, null);
        if (captureTimer) {
          window.clearTimeout(captureTimer);
          captureTimer = null;
        }
        setCapture(null);
        setCaptureSequence([]);
        return;
      }
      const chord = eventToKeybindingChord(event);
      if (!chord) {
        return;
      }
      const nextSequence = [...captureSequence(), chord];
      setCaptureSequence(nextSequence);
      if (captureTimer) {
        window.clearTimeout(captureTimer);
      }
      captureTimer = window.setTimeout(() => {
        const serialized = serializeKeybindingSequence(nextSequence);
        if (serialized) {
          updateBinding(
            activeCapture.actionId,
            activeCapture.index,
            serialized,
          );
        }
        setCapture(null);
        setCaptureSequence([]);
        if (captureTimer) {
          window.clearTimeout(captureTimer);
          captureTimer = null;
        }
      }, 650);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      if (captureTimer) {
        window.clearTimeout(captureTimer);
        captureTimer = null;
      }
    });
  });

  const createProfile = (): void => {
    const id = createKeybindingProfileId();
    const newProfile: KeybindingProfile = {
      id,
      name: "New profile",
      bindings: cloneBindings(activeProfile().bindings),
    };
    updateState((state) => ({
      activeProfileId: id,
      profiles: [...state.profiles, newProfile],
    }));
  };

  const duplicateProfile = (): void => {
    const profile = activeProfile();
    const id = createKeybindingProfileId();
    const newProfile: KeybindingProfile = {
      id,
      name: `${profile.name} Copy`,
      bindings: cloneBindings(profile.bindings),
    };
    updateState((state) => ({
      activeProfileId: id,
      profiles: [...state.profiles, newProfile],
    }));
  };

  const deleteProfile = (): void => {
    const profile = activeProfile();
    updateState((state) => {
      if (state.profiles.length <= 1) {
        return state;
      }
      const nextProfiles = state.profiles.filter(
        (entry) => entry.id !== profile.id,
      );
      const nextActive =
        state.activeProfileId === profile.id
          ? (nextProfiles[0]?.id ?? state.activeProfileId)
          : state.activeProfileId;
      return {
        activeProfileId: nextActive,
        profiles: nextProfiles,
      };
    });
  };

  const exportKeybindings = (): void => {
    const payload = keybindingStateToJson(props.keybindings());
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "shadr-keybindings.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importKeybindings = async (file: File): Promise<void> => {
    setImportStatus(null);
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const parsedValue =
        parsed && typeof parsed === "object" ? (parsed as JsonObject) : null;
      const nextState = coerceKeybindingState(parsedValue ?? null);
      props.onChange(nextState);
      setImportStatus("Imported keybindings.");
    } catch (error) {
      console.warn("Failed to import keybindings", error);
      setImportStatus("Import failed. Check the JSON file.");
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <div class="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-muted)] p-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-[0.75rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
              Profile
            </span>
            <div class="flex flex-wrap items-center gap-2">
              <select
                class="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-panel-strong)] px-2 py-1 text-[0.8rem] text-[color:var(--text-strong)]"
                value={activeProfile().id}
                onChange={(event) =>
                  updateActiveProfile(event.currentTarget.value)
                }
              >
                <For each={props.keybindings().profiles}>
                  {(profile) => (
                    <option value={profile.id}>{profile.name}</option>
                  )}
                </For>
              </select>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-[color:var(--border-soft)] px-2 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]"
                onClick={createProfile}
                aria-label="New profile"
                title="New profile"
              >
                <Plus class="h-3.5 w-3.5" />
                <span class="sr-only">New</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-[color:var(--border-soft)] px-2 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]"
                onClick={duplicateProfile}
                aria-label="Duplicate profile"
                title="Duplicate profile"
              >
                <Copy class="h-3.5 w-3.5" />
                <span class="sr-only">Duplicate</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-[color:var(--border-soft)] px-2 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-[color:var(--status-error-text)]"
                onClick={deleteProfile}
                aria-label="Delete profile"
                title="Delete profile"
              >
                <Trash2 class="h-3.5 w-3.5" />
                <span class="sr-only">Delete</span>
              </button>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-[color:var(--border-soft)] px-2 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]"
                onClick={() => importInputRef?.click()}
                aria-label="Import keybindings"
                title="Import keybindings"
              >
                <Upload class="h-3.5 w-3.5" />
                <span class="sr-only">Import</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-[color:var(--border-soft)] px-2 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]"
                onClick={exportKeybindings}
                aria-label="Export keybindings"
                title="Export keybindings"
              >
                <Download class="h-3.5 w-3.5" />
                <span class="sr-only">Export</span>
              </button>
            </div>
            <span class="text-[0.6rem] text-[color:var(--text-muted)]">
              JSON profiles can be shared across devices.
            </span>
          </div>
        </div>
        <div class="mt-3 flex flex-col gap-2">
          <label class="text-[0.7rem] text-[color:var(--text-muted)]">
            Profile name
          </label>
          <input
            class="w-full rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-panel-strong)] px-3 py-2 text-[0.8rem] text-[color:var(--text-strong)]"
            value={activeProfile().name}
            onInput={(event) => {
              const name = event.currentTarget.value;
              updateProfile(activeProfile().id, (profile) => ({
                ...profile,
                name,
              }));
            }}
          />
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            class="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                void importKeybindings(file);
              }
              event.currentTarget.value = "";
            }}
          />
          <Show when={capture()}>
            <div class="flex flex-col gap-2">
              <div class="rounded-lg border border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] px-3 py-2 text-[0.7rem] text-[color:var(--status-info-text)]">
                Press keys to set the shortcut. Esc cancels, Delete clears.
              </div>
              <input
                class="w-full rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-panel-strong)] px-3 py-2 text-[0.75rem] text-[color:var(--text-strong)]"
                value={captureSequence()
                  .map((entry) => formatKeybindingChord(entry, isMac()))
                  .join(", ")}
                disabled
              />
            </div>
          </Show>
          <Show when={importStatus()}>
            {(message) => (
              <div class="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-strong)] px-3 py-2 text-[0.7rem] text-[color:var(--text-muted)]">
                {message()}
              </div>
            )}
          </Show>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <For each={groupedActions()}>
          {(group) => {
            const [category, actions] = group;
            return (
              <div class="flex flex-col gap-3">
                <div class="text-[0.7rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                  {category}
                </div>
                <div class="flex flex-col gap-2">
                  <For each={actions}>
                    {(action) => {
                      const bindings = () =>
                        activeProfile().bindings[action.id] ?? [];
                      return (
                        <div class="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-muted)] p-3">
                          <div class="flex flex-wrap items-start justify-between gap-3">
                            <div class="flex flex-col gap-1">
                              <span class="text-[0.8rem] text-[color:var(--text-strong)]">
                                {action.label}
                              </span>
                              <span class="text-[0.7rem] text-[color:var(--text-muted)]">
                                {action.description}
                              </span>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                              <For each={bindings()}>
                                {(binding, index) => {
                                  const conflictIds = () =>
                                    conflicts().get(binding) ?? [];
                                  const hasConflict = () =>
                                    conflictIds().length > 1;
                                  return (
                                    <div class="flex flex-col items-end gap-1">
                                      <button
                                        type="button"
                                        class={`rounded-lg border px-2 py-1 text-[0.7rem] uppercase tracking-[0.2em] ${
                                          capture() &&
                                          capture()?.actionId === action.id &&
                                          capture()?.index === index()
                                            ? "border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)]"
                                            : hasConflict()
                                              ? "border-[color:var(--status-warn-border)] bg-[color:var(--status-warn-bg)] text-[color:var(--status-warn-text)]"
                                              : "border-[color:var(--border-soft)] text-[color:var(--text-muted)]"
                                        }`}
                                        onClick={() =>
                                          handleCapture(action.id, index())
                                        }
                                      >
                                        {formatKeybindingBinding(
                                          binding,
                                          isMac(),
                                        )}
                                      </button>
                                      <Show when={hasConflict()}>
                                        <span class="text-[0.6rem] text-[color:var(--status-warn-text)]">
                                          Conflict
                                        </span>
                                      </Show>
                                      <button
                                        type="button"
                                        class="inline-flex items-center justify-center text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]"
                                        onClick={() =>
                                          updateBinding(
                                            action.id,
                                            index(),
                                            null,
                                          )
                                        }
                                        aria-label="Remove binding"
                                        title="Remove binding"
                                      >
                                        <X class="h-3 w-3" />
                                        <span class="sr-only">Remove</span>
                                      </button>
                                    </div>
                                  );
                                }}
                              </For>
                              <button
                                type="button"
                                class="inline-flex items-center justify-center rounded-lg border border-[color:var(--border-soft)] px-2 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]"
                                onClick={() =>
                                  handleCapture(action.id, bindings().length)
                                }
                                aria-label="Add binding"
                                title="Add binding"
                              >
                                <Plus class="h-3.5 w-3.5" />
                                <span class="sr-only">Add</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
