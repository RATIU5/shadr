import type {
  KeybindingActionId,
  KeybindingChord,
  KeybindingSequence,
} from "~/editor/keybindings";

export type KeybindingEvent = Readonly<{
  actionId: KeybindingActionId;
  binding: KeybindingChord;
  sequence: KeybindingSequence;
}>;

/* eslint-disable no-unused-vars */
type KeybindingListener = (event: KeybindingEvent) => void;
/* eslint-enable no-unused-vars */

const listeners = new Set<KeybindingListener>();

export const subscribeKeybindingEvents = (
  listener: KeybindingListener,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const publishKeybindingEvent = (event: KeybindingEvent): void => {
  for (const listener of listeners) {
    listener(event);
  }
};
