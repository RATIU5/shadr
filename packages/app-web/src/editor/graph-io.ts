import type {
  GraphDocument,
  GraphDocumentV1,
  GraphFrameV1,
  GraphNodeV1,
  GraphSocketLabelPosition,
  GraphSocketNumberFormat,
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

const isGraphSocketLabelPosition = (
  value: unknown,
): value is GraphSocketLabelPosition =>
  value === "auto" ||
  value === "left" ||
  value === "right" ||
  value === "top" ||
  value === "bottom";

const isGraphSocketNumberFormat = (
  value: unknown,
): value is GraphSocketNumberFormat =>
  value === "auto" ||
  value === "integer" ||
  value === "fixed-2" ||
  value === "fixed-3" ||
  value === "percent";

const isGraphSocketLabelSettings = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.visible !== undefined && typeof value.visible !== "boolean") {
    return false;
  }
  if (
    value.position !== undefined &&
    !isGraphSocketLabelPosition(value.position)
  ) {
    return false;
  }
  if (value.offset !== undefined) {
    if (!isRecord(value.offset)) {
      return false;
    }
    if (!isNumber(value.offset.x) || !isNumber(value.offset.y)) {
      return false;
    }
  }
  return true;
};

const isGraphSocketMetadata = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.units !== undefined && !isString(value.units)) {
    return false;
  }
  if (value.min !== undefined && !isNumber(value.min)) {
    return false;
  }
  if (value.max !== undefined && !isNumber(value.max)) {
    return false;
  }
  if (value.step !== undefined && !isNumber(value.step)) {
    return false;
  }
  if (value.format !== undefined && !isGraphSocketNumberFormat(value.format)) {
    return false;
  }
  return true;
};

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
  if (value.label !== undefined && !isString(value.label)) {
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
  if (
    value.labelSettings !== undefined &&
    !isGraphSocketLabelSettings(value.labelSettings)
  ) {
    return false;
  }
  if (value.metadata !== undefined && !isGraphSocketMetadata(value.metadata)) {
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

const isGraphFrameV1 = (value: unknown): value is GraphFrameV1 => {
  if (!isRecord(value)) {
    return false;
  }
  if (!isString(value.id) || !isString(value.title)) {
    return false;
  }
  if (value.description !== undefined && !isString(value.description)) {
    return false;
  }
  if (value.color !== undefined && !isNumber(value.color)) {
    return false;
  }
  if (value.collapsed !== undefined && typeof value.collapsed !== "boolean") {
    return false;
  }
  if (
    value.exposedInputs !== undefined &&
    (!Array.isArray(value.exposedInputs) ||
      !value.exposedInputs.every(isString))
  ) {
    return false;
  }
  if (
    value.exposedOutputs !== undefined &&
    (!Array.isArray(value.exposedOutputs) ||
      !value.exposedOutputs.every(isString))
  ) {
    return false;
  }
  const position = value.position;
  const size = value.size;
  if (!isRecord(position) || !isRecord(size)) {
    return false;
  }
  if (!isNumber(position.x) || !isNumber(position.y)) {
    return false;
  }
  if (!isNumber(size.width) || !isNumber(size.height)) {
    return false;
  }
  return true;
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
  if (
    value.frames !== undefined &&
    (!Array.isArray(value.frames) || !value.frames.every(isGraphFrameV1))
  ) {
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
