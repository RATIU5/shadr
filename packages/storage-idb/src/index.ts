import type { GraphDocumentV1, GraphId, JsonObject } from "@shadr/shared";
import { GRAPH_DOCUMENT_V1_SCHEMA_VERSION } from "@shadr/shared";
import { Effect } from "effect";

export type StorageError =
  | { _tag: "StorageUnavailable" }
  | { _tag: "RequestFailed"; operation: string; cause: unknown }
  | { _tag: "InvalidDocument"; reason: string };

const DB_NAME = "shadr";
const DB_VERSION = 1;
const STORE_GRAPHS = "graphs";
const STORE_SETTINGS = "settings";
const STORE_UI_STATE = "ui_state";
const SETTINGS_KEY = "settings";
const UI_STATE_KEY = "ui_state";

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Request failed"));
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Transaction aborted"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Transaction failed"));
  });

const openDatabase = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_GRAPHS)) {
        db.createObjectStore(STORE_GRAPHS, { keyPath: "graphId" });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
      if (!db.objectStoreNames.contains(STORE_UI_STATE)) {
        db.createObjectStore(STORE_UI_STATE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open database"));
  });
};

const withStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  // eslint-disable-next-line no-unused-vars
  operation: (store: IDBObjectStore) => IDBRequest<T>,
  waitForCommit: boolean,
): Promise<T> => {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, mode);
  try {
    const store = transaction.objectStore(storeName);
    const result = await requestToPromise(operation(store));
    if (waitForCommit) {
      await transactionDone(transaction);
    }
    return result;
  } finally {
    db.close();
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

const isNumber = (value: unknown): value is number => typeof value === "number";

const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every(isString);

const isJsonObject = (value: unknown): value is JsonObject =>
  isRecord(value) && !Array.isArray(value);

const isGraphDocumentV1 = (value: unknown): value is GraphDocumentV1 => {
  if (!isRecord(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record["schemaVersion"] !== GRAPH_DOCUMENT_V1_SCHEMA_VERSION) {
    return false;
  }
  if (!isString(record["graphId"])) {
    return false;
  }
  const nodes = record["nodes"];
  const sockets = record["sockets"];
  const wires = record["wires"];
  if (!Array.isArray(nodes) || !Array.isArray(sockets)) {
    return false;
  }
  if (!Array.isArray(wires)) {
    return false;
  }
  for (const node of nodes) {
    if (!isRecord(node)) {
      return false;
    }
    const nodeRecord = node as Record<string, unknown>;
    if (!isString(nodeRecord["id"]) || !isString(nodeRecord["type"])) {
      return false;
    }
    const position = nodeRecord["position"];
    if (!isRecord(position)) {
      return false;
    }
    const positionRecord = position as Record<string, unknown>;
    if (!isNumber(positionRecord["x"]) || !isNumber(positionRecord["y"])) {
      return false;
    }
    if (!isJsonObject(nodeRecord["params"])) {
      return false;
    }
    if (
      !isStringArray(nodeRecord["inputs"]) ||
      !isStringArray(nodeRecord["outputs"])
    ) {
      return false;
    }
  }
  for (const socket of sockets) {
    if (!isRecord(socket)) {
      return false;
    }
    const socketRecord = socket as Record<string, unknown>;
    if (!isString(socketRecord["id"]) || !isString(socketRecord["nodeId"])) {
      return false;
    }
    if (
      !isString(socketRecord["name"]) ||
      !isString(socketRecord["dataType"])
    ) {
      return false;
    }
    const direction = socketRecord["direction"];
    if (direction !== "input" && direction !== "output") {
      return false;
    }
    if (!isBoolean(socketRecord["required"])) {
      return false;
    }
  }
  for (const wire of wires) {
    if (!isRecord(wire)) {
      return false;
    }
    const wireRecord = wire as Record<string, unknown>;
    if (
      !isString(wireRecord["id"]) ||
      !isString(wireRecord["fromSocketId"]) ||
      !isString(wireRecord["toSocketId"])
    ) {
      return false;
    }
  }
  if ("metadata" in record && record["metadata"] !== undefined) {
    if (!isJsonObject(record["metadata"])) {
      return false;
    }
  }
  return true;
};

const storageUnavailable = (): StorageError => ({ _tag: "StorageUnavailable" });

export const loadGraphDocument = (
  graphId: GraphId,
): Effect.Effect<GraphDocumentV1 | null, StorageError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await withStore(
        STORE_GRAPHS,
        "readonly",
        (store) => store.get(graphId),
        false,
      );
      if (result === undefined) {
        return null;
      }
      if (!isGraphDocumentV1(result)) {
        throw new Error("Invalid graph document shape");
      }
      return result;
    },
    catch: (cause) =>
      typeof indexedDB === "undefined"
        ? storageUnavailable()
        : cause instanceof Error &&
            cause.message === "Invalid graph document shape"
          ? { _tag: "InvalidDocument", reason: cause.message }
          : {
              _tag: "RequestFailed",
              operation: "loadGraphDocument",
              cause,
            },
  });

export const saveGraphDocument = (
  document: GraphDocumentV1,
): Effect.Effect<void, StorageError> =>
  Effect.tryPromise({
    try: async () => {
      await withStore(
        STORE_GRAPHS,
        "readwrite",
        (store) => store.put(document),
        true,
      );
    },
    catch: (cause) =>
      typeof indexedDB === "undefined"
        ? storageUnavailable()
        : {
            _tag: "RequestFailed",
            operation: "saveGraphDocument",
            cause,
          },
  });

export const loadSettings = (): Effect.Effect<
  JsonObject | null,
  StorageError
> =>
  Effect.tryPromise({
    try: async () => {
      const result = await withStore(
        STORE_SETTINGS,
        "readonly",
        (store) => store.get(SETTINGS_KEY),
        false,
      );
      if (result === undefined) {
        return null;
      }
      if (!isJsonObject(result)) {
        throw new Error("Invalid settings payload");
      }
      return result;
    },
    catch: (cause) =>
      typeof indexedDB === "undefined"
        ? storageUnavailable()
        : cause instanceof Error && cause.message === "Invalid settings payload"
          ? { _tag: "InvalidDocument", reason: cause.message }
          : {
              _tag: "RequestFailed",
              operation: "loadSettings",
              cause,
            },
  });

export const saveSettings = (
  settings: JsonObject,
): Effect.Effect<void, StorageError> =>
  Effect.tryPromise({
    try: async () => {
      await withStore(
        STORE_SETTINGS,
        "readwrite",
        (store) => store.put(settings, SETTINGS_KEY),
        true,
      );
    },
    catch: (cause) =>
      typeof indexedDB === "undefined"
        ? storageUnavailable()
        : {
            _tag: "RequestFailed",
            operation: "saveSettings",
            cause,
          },
  });

export const loadUiState = (): Effect.Effect<JsonObject | null, StorageError> =>
  Effect.tryPromise({
    try: async () => {
      const result = await withStore(
        STORE_UI_STATE,
        "readonly",
        (store) => store.get(UI_STATE_KEY),
        false,
      );
      if (result === undefined) {
        return null;
      }
      if (!isJsonObject(result)) {
        throw new Error("Invalid UI state payload");
      }
      return result;
    },
    catch: (cause) =>
      typeof indexedDB === "undefined"
        ? storageUnavailable()
        : cause instanceof Error && cause.message === "Invalid UI state payload"
          ? { _tag: "InvalidDocument", reason: cause.message }
          : {
              _tag: "RequestFailed",
              operation: "loadUiState",
              cause,
            },
  });

export const saveUiState = (
  uiState: JsonObject,
): Effect.Effect<void, StorageError> =>
  Effect.tryPromise({
    try: async () => {
      await withStore(
        STORE_UI_STATE,
        "readwrite",
        (store) => store.put(uiState, UI_STATE_KEY),
        true,
      );
    },
    catch: (cause) =>
      typeof indexedDB === "undefined"
        ? storageUnavailable()
        : {
            _tag: "RequestFailed",
            operation: "saveUiState",
            cause,
          },
  });
