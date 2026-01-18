import type { GraphId, NodeId, SocketId, WireId } from "./identity.js";

export const GRAPH_DOCUMENT_V1_SCHEMA_VERSION = 1 as const;

export type GraphDocumentSchemaVersion =
  typeof GRAPH_DOCUMENT_V1_SCHEMA_VERSION;

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = Readonly<Record<string, JsonValue>>;
export type JsonArray = ReadonlyArray<JsonValue>;

export type GraphSocketDirectionV1 = "input" | "output";

export type GraphSocketV1 = Readonly<{
  id: SocketId;
  nodeId: NodeId;
  name: string;
  direction: GraphSocketDirectionV1;
  dataType: string;
  required: boolean;
  defaultValue?: JsonValue;
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

export type GraphDocumentV1 = Readonly<{
  schemaVersion: typeof GRAPH_DOCUMENT_V1_SCHEMA_VERSION;
  graphId: GraphId;
  nodes: ReadonlyArray<GraphNodeV1>;
  sockets: ReadonlyArray<GraphSocketV1>;
  wires: ReadonlyArray<GraphWireV1>;
  metadata?: JsonObject;
}>;

export type GraphDocument = GraphDocumentV1;

export type GraphDocumentByVersion<
  Version extends GraphDocumentSchemaVersion,
> = Version extends typeof GRAPH_DOCUMENT_V1_SCHEMA_VERSION
  ? GraphDocumentV1
  : never;

export type GraphDocumentMigration<
  From extends GraphDocumentSchemaVersion,
  To extends GraphDocumentSchemaVersion,
> = Readonly<{
  from: From;
  to: To;
  migrate: (
    _document: GraphDocumentByVersion<From>,
  ) => GraphDocumentByVersion<To>;
}>;

export type GraphDocumentMigrator = Readonly<{
  latestVersion: GraphDocumentSchemaVersion;
  migrate: (_document: GraphDocument) => GraphDocument;
}>;

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
