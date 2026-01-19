import type {
  FrameId,
  GraphId,
  JsonObject,
  NodeId,
  WireId,
} from "@shadr/shared";
import {
  makeFrameId,
  makeGraphId,
  makeNodeId,
  makeWireId,
} from "@shadr/shared";

type Point = Readonly<{ x: number; y: number }>;

export type GraphBreadcrumb = Readonly<{
  id: GraphId;
  label: string;
}>;

export type EditorUiState = Readonly<{
  lastGraphId: GraphId;
  recentGraphIds: ReadonlyArray<GraphId>;
  graphPath: ReadonlyArray<GraphBreadcrumb>;
  canvasCenter: Point;
  selectedNodes: ReadonlyArray<NodeId>;
  selectedFrames: ReadonlyArray<FrameId>;
  selectedWires: ReadonlyArray<WireId>;
  bypassedNodes: ReadonlyArray<NodeId>;
  collapsedNodes: ReadonlyArray<NodeId>;
}>;

const DEFAULT_GRAPH_ID = makeGraphId("main");
const DEFAULT_CENTER: Point = { x: 0, y: 0 };

export const DEFAULT_UI_STATE: EditorUiState = {
  lastGraphId: DEFAULT_GRAPH_ID,
  recentGraphIds: [DEFAULT_GRAPH_ID],
  graphPath: [{ id: DEFAULT_GRAPH_ID, label: "Main" }],
  canvasCenter: DEFAULT_CENTER,
  selectedNodes: [],
  selectedFrames: [],
  selectedWires: [],
  bypassedNodes: [],
  collapsedNodes: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number";

const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every(isString);

const parseGraphPath = (value: unknown): GraphBreadcrumb[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: GraphBreadcrumb[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const idValue = item["id"];
    const labelValue = item["label"];
    if (!isString(idValue) || !isString(labelValue)) {
      continue;
    }
    entries.push({ id: makeGraphId(idValue), label: labelValue });
  }
  return entries;
};

const normalizeGraphPath = (
  path: ReadonlyArray<GraphBreadcrumb>,
  graphId: GraphId,
): GraphBreadcrumb[] => {
  if (path.length === 0 || path[0].id !== graphId) {
    return [{ id: graphId, label: "Main" }];
  }
  return [...path];
};

const parsePoint = (value: unknown): Point | null => {
  if (!isRecord(value)) {
    return null;
  }
  const x = value["x"];
  const y = value["y"];
  if (!isNumber(x) || !isNumber(y)) {
    return null;
  }
  return { x, y };
};

const coerceIdArray = <T extends string>(
  value: unknown,
  // eslint-disable-next-line no-unused-vars
  maker: (value: string) => T,
): T[] => {
  if (!isStringArray(value)) {
    return [];
  }
  return value.map((entry) => maker(entry));
};

const dedupeIds = <T extends string>(values: ReadonlyArray<T>): T[] => {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
};

export const coerceUiState = (value: JsonObject | null): EditorUiState => {
  if (!value || !isRecord(value)) {
    return DEFAULT_UI_STATE;
  }
  const record = value as Record<string, unknown>;
  const lastGraphId = isString(record["lastGraphId"])
    ? makeGraphId(record["lastGraphId"])
    : DEFAULT_UI_STATE.lastGraphId;
  const recentGraphIds = dedupeIds([
    lastGraphId,
    ...coerceIdArray(record["recentGraphIds"], makeGraphId),
  ]);
  const graphPath = normalizeGraphPath(
    parseGraphPath(record["graphPath"]),
    lastGraphId,
  );
  const canvasCenter =
    parsePoint(record["canvasCenter"]) ?? DEFAULT_UI_STATE.canvasCenter;
  return {
    lastGraphId,
    recentGraphIds: recentGraphIds.length > 0 ? recentGraphIds : [lastGraphId],
    graphPath,
    canvasCenter,
    selectedNodes: coerceIdArray(record["selectedNodes"], makeNodeId),
    selectedFrames: coerceIdArray(record["selectedFrames"], makeFrameId),
    selectedWires: coerceIdArray(record["selectedWires"], makeWireId),
    bypassedNodes: coerceIdArray(record["bypassedNodes"], makeNodeId),
    collapsedNodes: coerceIdArray(record["collapsedNodes"], makeNodeId),
  };
};

export const uiStateToJson = (state: EditorUiState): JsonObject => ({
  lastGraphId: state.lastGraphId,
  recentGraphIds: [...state.recentGraphIds],
  graphPath: state.graphPath.map((entry) => ({
    id: entry.id,
    label: entry.label,
  })),
  canvasCenter: { x: state.canvasCenter.x, y: state.canvasCenter.y },
  selectedNodes: [...state.selectedNodes],
  selectedFrames: [...state.selectedFrames],
  selectedWires: [...state.selectedWires],
  bypassedNodes: [...state.bypassedNodes],
  collapsedNodes: [...state.collapsedNodes],
});
