import type { FrameId, GraphId, NodeId, SocketId, WireId } from "./identity.js";
import type { SocketTypeId } from "./socket-types.js";

export const GRAPH_DOCUMENT_V1_SCHEMA_VERSION = 1 as const;

export type GraphDocumentSchemaVersion =
  typeof GRAPH_DOCUMENT_V1_SCHEMA_VERSION;

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type JsonArray = ReadonlyArray<JsonValue>;

export type GraphSocketDirectionV1 = "input" | "output";

export type GraphSocketLabelPosition =
  | "auto"
  | "left"
  | "right"
  | "top"
  | "bottom";

export type GraphSocketLabelSettings = Readonly<{
  visible?: boolean;
  position?: GraphSocketLabelPosition;
  offset?: Readonly<{ x: number; y: number }>;
}>;

export type GraphSocketNumberFormat =
  | "auto"
  | "integer"
  | "fixed-2"
  | "fixed-3"
  | "percent";

export type GraphSocketMetadata = Readonly<{
  units?: string;
  min?: number;
  max?: number;
  step?: number;
  format?: GraphSocketNumberFormat;
}>;

export type GraphSocketV1 = Readonly<{
  id: SocketId;
  nodeId: NodeId;
  name: string;
  label?: string;
  direction: GraphSocketDirectionV1;
  dataType: SocketTypeId;
  required: boolean;
  defaultValue?: JsonValue;
  minConnections?: number;
  maxConnections?: number;
  labelSettings?: GraphSocketLabelSettings;
  metadata?: GraphSocketMetadata;
}>;

export type GraphNodeV1 = Readonly<{
  id: NodeId;
  type: string;
  position: Readonly<{ x: number; y: number }>;
  params: JsonObject;
  inputs: ReadonlyArray<SocketId>;
  outputs: ReadonlyArray<SocketId>;
}>;

export type GraphWireV1 = Readonly<{
  id: WireId;
  fromSocketId: SocketId;
  toSocketId: SocketId;
}>;

export type GraphFrameV1 = Readonly<{
  id: FrameId;
  title: string;
  description?: string;
  color?: number;
  collapsed?: boolean;
  exposedInputs?: ReadonlyArray<SocketId>;
  exposedOutputs?: ReadonlyArray<SocketId>;
  position: Readonly<{ x: number; y: number }>;
  size: Readonly<{ width: number; height: number }>;
}>;

export type GraphDocumentV1 = Readonly<{
  schemaVersion: typeof GRAPH_DOCUMENT_V1_SCHEMA_VERSION;
  graphId: GraphId;
  nodes: ReadonlyArray<GraphNodeV1>;
  sockets: ReadonlyArray<GraphSocketV1>;
  wires: ReadonlyArray<GraphWireV1>;
  frames?: ReadonlyArray<GraphFrameV1>;
  metadata?: JsonObject;
}>;

export type GraphDocument = GraphDocumentV1;

export type GraphDocumentByVersion<Version extends GraphDocumentSchemaVersion> =
  Version extends typeof GRAPH_DOCUMENT_V1_SCHEMA_VERSION
    ? GraphDocumentV1
    : never;

/* eslint-disable no-unused-vars -- type signatures need named parameters */
export type GraphDocumentMigration<
  From extends GraphDocumentSchemaVersion,
  To extends GraphDocumentSchemaVersion,
> = Readonly<{
  from: From;
  to: To;
  migrate: (
    document: GraphDocumentByVersion<From>,
  ) => GraphDocumentByVersion<To>;
}>;

export type GraphDocumentMigrator = Readonly<{
  latestVersion: GraphDocumentSchemaVersion;
  migrate: (document: GraphDocument) => GraphDocument;
}>;
/* eslint-enable no-unused-vars */

const sortIds = <T extends string>(ids: ReadonlyArray<T>): T[] =>
  [...ids].sort((left, right) => left.localeCompare(right));

const sortById = <T extends { id: string }>(items: ReadonlyArray<T>): T[] =>
  [...items].sort((left, right) => left.id.localeCompare(right.id));

export const normalizeGraphDocumentV1 = (
  document: GraphDocumentV1,
): GraphDocumentV1 => ({
  ...document,
  nodes: sortById(document.nodes).map((node) => ({
    ...node,
    inputs: sortIds(node.inputs),
    outputs: sortIds(node.outputs),
  })),
  sockets: sortById(document.sockets),
  wires: sortById(document.wires),
  ...(document.frames ? { frames: sortById(document.frames) } : {}),
});

const sortJsonValue = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  const sorted: Record<string, JsonValue> = {};
  for (const [key, entry] of entries) {
    sorted[key] = sortJsonValue(entry);
  }
  return sorted;
};

export const serializeGraphDocumentV1 = (document: GraphDocumentV1): string =>
  JSON.stringify(sortJsonValue(normalizeGraphDocumentV1(document)));
