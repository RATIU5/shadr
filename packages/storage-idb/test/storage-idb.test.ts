import { Either, Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { StorageError } from "../src/index.js";
import {
  loadGraphDocument,
  loadSettings,
  loadUiState,
} from "../src/index.js";
import {
  GRAPH_DOCUMENT_V1_SCHEMA_VERSION,
  makeGraphId,
} from "@shadr/shared";

type StoreDefinition = {
  keyPath?: string;
  records: Map<IDBValidKey, unknown>;
};

class FakeIDBRequest<T> {
  result!: T;
  error: DOMException | null = null;
  onsuccess: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
}

class FakeIDBOpenDBRequest extends FakeIDBRequest<IDBDatabase> {
  onupgradeneeded: ((event: Event) => void) | null = null;
}

class FakeTransaction {
  oncomplete: ((event: Event) => void) | null = null;
  onabort: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(
    private readonly storeName: string,
    private readonly store: StoreDefinition,
    private readonly indexedDb: FakeIndexedDB,
  ) {}

  objectStore(name: string): IDBObjectStore {
    if (name !== this.storeName) {
      throw new Error(`Unexpected store requested: ${name}`);
    }
    return new FakeObjectStore(
      this.store,
      this,
      this.indexedDb,
    ) as unknown as IDBObjectStore;
  }

  scheduleComplete(): void {
    setTimeout(() => {
      this.oncomplete?.(null as unknown as Event);
    }, 0);
  }
}

class FakeObjectStore {
  constructor(
    private readonly store: StoreDefinition,
    private readonly transaction: FakeTransaction,
    private readonly indexedDb: FakeIndexedDB,
  ) {}

  get(key: IDBValidKey): IDBRequest<unknown> {
    const request = this.indexedDb.createRequest(() =>
      this.store.records.get(key),
    );
    this.transaction.scheduleComplete();
    return request as unknown as IDBRequest<unknown>;
  }

  put(value: unknown, key?: IDBValidKey): IDBRequest<IDBValidKey> {
    const resolvedKey = key ?? this.resolveKey(value);
    this.store.records.set(resolvedKey, value);
    const request = this.indexedDb.createRequest(() => resolvedKey);
    this.transaction.scheduleComplete();
    return request as unknown as IDBRequest<IDBValidKey>;
  }

  private resolveKey(value: unknown): IDBValidKey {
    if (!this.store.keyPath) {
      throw new Error("Missing keyPath for object store");
    }
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid value for keyPath resolution");
    }
    const record = value as Record<string, unknown>;
    const rawKey = record[this.store.keyPath];
    if (rawKey === undefined) {
      throw new Error("Missing key for object store");
    }
    return rawKey as IDBValidKey;
  }
}

class FakeDatabase {
  private readonly stores = new Map<string, StoreDefinition>();
  readonly objectStoreNames: DOMStringList;

  constructor(private readonly indexedDb: FakeIndexedDB) {
    this.objectStoreNames = {
      contains: (name: string) => this.stores.has(name),
    } as DOMStringList;
  }

  createObjectStore(
    name: string,
    options?: IDBObjectStoreParameters,
  ): IDBObjectStore {
    this.ensureStore(name, options);
    return {} as IDBObjectStore;
  }

  transaction(name: string, _mode: IDBTransactionMode): IDBTransaction {
    const store = this.stores.get(name);
    if (!store) {
      throw new Error(`Missing store: ${name}`);
    }
    return new FakeTransaction(
      name,
      store,
      this.indexedDb,
    ) as unknown as IDBTransaction;
  }

  close(): void {}

  ensureStore(name: string, options?: IDBObjectStoreParameters): void {
    if (this.stores.has(name)) {
      return;
    }
    const keyPath =
      typeof options?.keyPath === "string" ? options.keyPath : undefined;
    this.stores.set(name, { keyPath, records: new Map() });
  }

  seedStore(name: string, key: IDBValidKey, value: unknown): void {
    const store = this.stores.get(name);
    if (!store) {
      throw new Error(`Missing store: ${name}`);
    }
    store.records.set(key, value);
  }
}

class FakeIndexedDB {
  private readonly databases = new Map<string, FakeDatabase>();
  private nextRequestError: Error | null = null;

  open(name: string): IDBOpenDBRequest {
    const existing = this.databases.get(name);
    const database = existing ?? new FakeDatabase(this);
    if (!existing) {
      this.databases.set(name, database);
    }
    const request = new FakeIDBOpenDBRequest();
    request.result = database as unknown as IDBDatabase;
    queueMicrotask(() => {
      if (!existing) {
        request.onupgradeneeded?.(null as unknown as Event);
      }
      request.onsuccess?.(null as unknown as Event);
    });
    return request as unknown as IDBOpenDBRequest;
  }

  createRequest<T>(execute: () => T): FakeIDBRequest<T> {
    const request = new FakeIDBRequest<T>();
    const pendingError = this.nextRequestError;
    this.nextRequestError = null;
    queueMicrotask(() => {
      if (pendingError) {
        request.error = pendingError as DOMException;
        request.onerror?.(null as unknown as Event);
        return;
      }
      try {
        request.result = execute();
        request.onsuccess?.(null as unknown as Event);
      } catch (caught) {
        request.error = caught as DOMException;
        request.onerror?.(null as unknown as Event);
      }
    });
    return request;
  }

  failNextRequest(error: Error): void {
    this.nextRequestError = error;
  }

  seed(
    dbName: string,
    storeName: string,
    key: IDBValidKey,
    value: unknown,
    keyPath?: string,
  ): void {
    const database =
      this.databases.get(dbName) ?? new FakeDatabase(this);
    if (!this.databases.has(dbName)) {
      this.databases.set(dbName, database);
    }
    database.ensureStore(storeName, keyPath ? { keyPath } : undefined);
    database.seedStore(storeName, key, value);
  }
}

const readStorageError = async <T>(
  effect: Effect.Effect<T, StorageError>,
): Promise<StorageError> => {
  const result = await Effect.runPromise(Effect.either(effect));
  if (Either.isRight(result)) {
    throw new Error("Expected storage error");
  }
  return result.left;
};

describe("storage-idb validation", () => {
  const graphId = makeGraphId("graph");
  const dbName = "shadr";
  const graphStore = "graphs";
  const settingsStore = "settings";
  const uiStateStore = "ui_state";

  let originalIndexedDB: IDBFactory | undefined;
  let fakeIndexedDB: FakeIndexedDB;

  beforeEach(() => {
    originalIndexedDB = globalThis.indexedDB;
    fakeIndexedDB = new FakeIndexedDB();
    globalThis.indexedDB = fakeIndexedDB as unknown as IDBFactory;
  });

  afterEach(() => {
    if (originalIndexedDB === undefined) {
      delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;
      return;
    }
    globalThis.indexedDB = originalIndexedDB;
  });

  it("maps invalid graph documents to InvalidDocument", async () => {
    fakeIndexedDB.seed(
      dbName,
      graphStore,
      graphId,
      { schemaVersion: GRAPH_DOCUMENT_V1_SCHEMA_VERSION + 1 },
      "graphId",
    );

    const error = await readStorageError(loadGraphDocument(graphId));

    expect(error._tag).toBe("InvalidDocument");
  });

  it("maps invalid settings payloads to InvalidDocument", async () => {
    fakeIndexedDB.seed(dbName, settingsStore, "settings", "bad");

    const error = await readStorageError(loadSettings());

    expect(error._tag).toBe("InvalidDocument");
  });

  it("maps invalid UI state payloads to InvalidDocument", async () => {
    fakeIndexedDB.seed(dbName, uiStateStore, "ui_state", 42);

    const error = await readStorageError(loadUiState());

    expect(error._tag).toBe("InvalidDocument");
  });

  it("maps request failures to RequestFailed", async () => {
    fakeIndexedDB.failNextRequest(new Error("boom"));

    const error = await readStorageError(loadGraphDocument(graphId));

    expect(error._tag).toBe("RequestFailed");
  });

  it("maps missing IndexedDB to StorageUnavailable", async () => {
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;

    const error = await readStorageError(loadGraphDocument(graphId));

    expect(error._tag).toBe("StorageUnavailable");
  });
});
