import type { JsonObject } from "@shadr/shared";

import {
  coerceKeybindingState,
  DEFAULT_KEYBINDING_STATE,
  type KeybindingState,
  keybindingStateToJson,
} from "~/editor/keybindings";

export type EditorSettings = Readonly<{
  zoomSensitivity: number;
  panSensitivity: number;
  zoomCurve: number;
  panCurve: number;
  autosaveDelayMs: number;
  undoStackDepth: number;
  gridVisible: boolean;
  snapToGrid: boolean;
  wireHoverLabels: boolean;
  executionVizEnabled: boolean;
  keybindings: KeybindingState;
}>;

export type PointLike = Readonly<{ x: number; y: number }>;

export const SETTINGS_VERSION = 3;
export const GRID_SIZE = 32;
export const MIN_ZOOM_SENSITIVITY = 0.2;
export const MAX_ZOOM_SENSITIVITY = 3;
export const MIN_PAN_SENSITIVITY = 0.2;
export const MAX_PAN_SENSITIVITY = 3;
export const MIN_ZOOM_CURVE = 0.6;
export const MAX_ZOOM_CURVE = 1.6;
export const MIN_PAN_CURVE = 0.6;
export const MAX_PAN_CURVE = 1.6;
export const MIN_AUTOSAVE_DELAY_MS = 200;
export const MAX_AUTOSAVE_DELAY_MS = 5000;
export const MIN_UNDO_STACK_DEPTH = 10;
export const MAX_UNDO_STACK_DEPTH = 500;

export const DEFAULT_SETTINGS: EditorSettings = {
  zoomSensitivity: 1,
  panSensitivity: 1,
  zoomCurve: 1,
  panCurve: 1,
  autosaveDelayMs: 600,
  undoStackDepth: 120,
  gridVisible: true,
  snapToGrid: false,
  wireHoverLabels: false,
  executionVizEnabled: false,
  keybindings: DEFAULT_KEYBINDING_STATE,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const isNumber = (value: unknown): value is number => typeof value === "number";

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number =>
  isNumber(value) && Number.isFinite(value) ? clamp(value, min, max) : fallback;

const readInteger = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number =>
  isNumber(value) && Number.isFinite(value)
    ? Math.round(clamp(value, min, max))
    : fallback;

export const coerceSettings = (value: JsonObject | null): EditorSettings => {
  if (!value) {
    return DEFAULT_SETTINGS;
  }
  return {
    zoomSensitivity: readNumber(
      value.zoomSensitivity,
      DEFAULT_SETTINGS.zoomSensitivity,
      MIN_ZOOM_SENSITIVITY,
      MAX_ZOOM_SENSITIVITY,
    ),
    panSensitivity: readNumber(
      value.panSensitivity,
      DEFAULT_SETTINGS.panSensitivity,
      MIN_PAN_SENSITIVITY,
      MAX_PAN_SENSITIVITY,
    ),
    zoomCurve: readNumber(
      value.zoomCurve,
      DEFAULT_SETTINGS.zoomCurve,
      MIN_ZOOM_CURVE,
      MAX_ZOOM_CURVE,
    ),
    panCurve: readNumber(
      value.panCurve,
      DEFAULT_SETTINGS.panCurve,
      MIN_PAN_CURVE,
      MAX_PAN_CURVE,
    ),
    autosaveDelayMs: readInteger(
      value.autosaveDelayMs,
      DEFAULT_SETTINGS.autosaveDelayMs,
      MIN_AUTOSAVE_DELAY_MS,
      MAX_AUTOSAVE_DELAY_MS,
    ),
    undoStackDepth: readInteger(
      value.undoStackDepth,
      DEFAULT_SETTINGS.undoStackDepth,
      MIN_UNDO_STACK_DEPTH,
      MAX_UNDO_STACK_DEPTH,
    ),
    gridVisible: isBoolean(value.gridVisible)
      ? value.gridVisible
      : DEFAULT_SETTINGS.gridVisible,
    snapToGrid: isBoolean(value.snapToGrid)
      ? value.snapToGrid
      : DEFAULT_SETTINGS.snapToGrid,
    wireHoverLabels: isBoolean(value.wireHoverLabels)
      ? value.wireHoverLabels
      : DEFAULT_SETTINGS.wireHoverLabels,
    executionVizEnabled: isBoolean(value.executionVizEnabled)
      ? value.executionVizEnabled
      : DEFAULT_SETTINGS.executionVizEnabled,
    keybindings: coerceKeybindingState(
      isRecord(value.keybindings) ? value.keybindings : null,
    ),
  };
};

export const settingsToJson = (settings: EditorSettings): JsonObject => ({
  version: SETTINGS_VERSION,
  zoomSensitivity: settings.zoomSensitivity,
  panSensitivity: settings.panSensitivity,
  zoomCurve: settings.zoomCurve,
  panCurve: settings.panCurve,
  autosaveDelayMs: settings.autosaveDelayMs,
  undoStackDepth: settings.undoStackDepth,
  gridVisible: settings.gridVisible,
  snapToGrid: settings.snapToGrid,
  wireHoverLabels: settings.wireHoverLabels,
  executionVizEnabled: settings.executionVizEnabled,
  keybindings: keybindingStateToJson(settings.keybindings),
});

export const snapPointToGrid = <T extends PointLike>(point: T): T => ({
  ...point,
  x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
  y: Math.round(point.y / GRID_SIZE) * GRID_SIZE,
});
