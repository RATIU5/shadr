import type { JsonObject } from "@shadr/shared";

export type EditorSettings = Readonly<{
  zoomSensitivity: number;
  panSensitivity: number;
  gridVisible: boolean;
  snapToGrid: boolean;
}>;

export type PointLike = Readonly<{ x: number; y: number }>;

export const SETTINGS_VERSION = 1;
export const GRID_SIZE = 32;
export const MIN_ZOOM_SENSITIVITY = 0.2;
export const MAX_ZOOM_SENSITIVITY = 3;
export const MIN_PAN_SENSITIVITY = 0.2;
export const MAX_PAN_SENSITIVITY = 3;

export const DEFAULT_SETTINGS: EditorSettings = {
  zoomSensitivity: 1,
  panSensitivity: 1,
  gridVisible: true,
  snapToGrid: false,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const isNumber = (value: unknown): value is number => typeof value === "number";

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

const readNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number =>
  isNumber(value) && Number.isFinite(value) ? clamp(value, min, max) : fallback;

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
    gridVisible: isBoolean(value.gridVisible)
      ? value.gridVisible
      : DEFAULT_SETTINGS.gridVisible,
    snapToGrid: isBoolean(value.snapToGrid)
      ? value.snapToGrid
      : DEFAULT_SETTINGS.snapToGrid,
  };
};

export const settingsToJson = (settings: EditorSettings): JsonObject => ({
  version: SETTINGS_VERSION,
  zoomSensitivity: settings.zoomSensitivity,
  panSensitivity: settings.panSensitivity,
  gridVisible: settings.gridVisible,
  snapToGrid: settings.snapToGrid,
});

export const snapPointToGrid = <T extends PointLike>(point: T): T => ({
  ...point,
  x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
  y: Math.round(point.y / GRID_SIZE) * GRID_SIZE,
});
