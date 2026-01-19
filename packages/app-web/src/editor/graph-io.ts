import type {
  GraphDocument,
  GraphDocumentV1,
  GraphNodeV1,
  GraphSocketV1,
  GraphWireV1,
  JsonObject,
  JsonValue,
} from "@shadr/shared";
import {
  GRAPH_DOCUMENT_V1_SCHEMA_VERSION,
  serializeGraphDocumentV1,
} from "@shadr/shared";

export type GraphImportError =
  | Readonly<{ type: "invalid-json"; message: string }>
  | Readonly<{ type: "unsupported-version"; version: number }>
  | Readonly<{ type: "invalid-shape"; message: string }>;

export type GraphImportResult =
  | Readonly<{ ok: true; document: GraphDocumentV1 }>
  | Readonly<{ ok: false; error: GraphImportError }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null) {
    return true;
  }
  const valueType = typeof value;
  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "boolean"
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
};

const isJsonObject = (value: unknown): value is JsonObject =>
  isRecord(value) && Object.values(value).every(isJsonValue);

const isGraphNodeV1 = (value: unknown): value is GraphNodeV1 => {
  if (!isRecord(value)) {
    return false;
  }
  const position = value.position;
  if (!isRecord(position)) {
    return false;
  }
  return (
    isString(value.id) &&
    isString(value.type) &&
    isNumber(position.x) &&
    isNumber(position.y) &&
    isJsonObject(value.params) &&
    isStringArray(value.inputs) &&
    isStringArray(value.outputs)
  );
};

const isGraphSocketV1 = (value: unknown): value is GraphSocketV1 => {
  if (!isRecord(value)) {
    return false;
  }
  if (!isString(value.id) || !isString(value.nodeId)) {
    return false;
  }
  if (!isString(value.name) || !isString(value.dataType)) {
    return false;
  }
  if (value.direction !== "input" && value.direction !== "output") {
    return false;
  }
  if (typeof value.required !== "boolean") {
    return false;
  }
  if (value.defaultValue !== undefined && !isJsonValue(value.defaultValue)) {
    return false;
  }
  if (value.minConnections !== undefined && !isNumber(value.minConnections)) {
    return false;
  }
  if (value.maxConnections !== undefined && !isNumber(value.maxConnections)) {
    return false;
  }
  return true;
};

const isGraphWireV1 = (value: unknown): value is GraphWireV1 => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isString(value.id) &&
    isString(value.fromSocketId) &&
    isString(value.toSocketId)
  );
};

const isGraphDocumentV1 = (value: unknown): value is GraphDocumentV1 => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.schemaVersion !== GRAPH_DOCUMENT_V1_SCHEMA_VERSION) {
    return false;
  }
  if (!isString(value.graphId)) {
    return false;
  }
  if (!Array.isArray(value.nodes) || !value.nodes.every(isGraphNodeV1)) {
    return false;
  }
  if (!Array.isArray(value.sockets) || !value.sockets.every(isGraphSocketV1)) {
    return false;
  }
  if (!Array.isArray(value.wires) || !value.wires.every(isGraphWireV1)) {
    return false;
  }
  if (value.metadata !== undefined && !isJsonObject(value.metadata)) {
    return false;
  }
  return true;
};

const migrateGraphDocument = (document: GraphDocument): GraphDocument =>
  document;

export const graphDocumentToJson = (document: GraphDocumentV1): string =>
  serializeGraphDocumentV1(document);

export const parseGraphDocumentJson = (raw: string): GraphImportResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    return { ok: false, error: { type: "invalid-json", message } };
  }
  if (!isRecord(parsed)) {
    return {
      ok: false,
      error: { type: "invalid-shape", message: "Expected a JSON object." },
    };
  }
  const schemaVersion = parsed.schemaVersion;
  if (!isNumber(schemaVersion)) {
    return {
      ok: false,
      error: { type: "invalid-shape", message: "Missing schema version." },
    };
  }
  if (schemaVersion !== GRAPH_DOCUMENT_V1_SCHEMA_VERSION) {
    return {
      ok: false,
      error: { type: "unsupported-version", version: schemaVersion },
    };
  }
  if (!isGraphDocumentV1(parsed)) {
    return {
      ok: false,
      error: { type: "invalid-shape", message: "Invalid graph document." },
    };
  }
  const migrated = migrateGraphDocument(parsed);
  return { ok: true, document: migrated };
};

export const formatGraphImportError = (error: GraphImportError): string => {
  switch (error.type) {
    case "invalid-json":
      return error.message;
    case "unsupported-version":
      return `Unsupported schema version ${error.version}.`;
    case "invalid-shape":
      return error.message;
    default:
      return "Import failed.";
  }
};
