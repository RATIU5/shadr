import type { GraphDocumentV1, GraphId, JsonObject } from "@shadr/shared";
import type { StorageError } from "@shadr/storage-idb";
import {
  loadGraphDocument as loadGraphDocumentStorage,
  loadSettings as loadSettingsStorage,
  saveGraphDocument as saveGraphDocumentStorage,
  saveSettings as saveSettingsStorage,
} from "@shadr/storage-idb";
import { Context, Effect, Layer } from "effect";

/* eslint-disable no-unused-vars */
export type StorageServiceApi = Readonly<{
  loadGraphDocument: (
    _graphId: GraphId,
  ) => Effect.Effect<GraphDocumentV1 | null, StorageError>;
  saveGraphDocument: (
    _document: GraphDocumentV1,
  ) => Effect.Effect<void, StorageError>;
  loadSettings: () => Effect.Effect<JsonObject | null, StorageError>;
  saveSettings: (_settings: JsonObject) => Effect.Effect<void, StorageError>;
}>;
/* eslint-enable no-unused-vars */

export class StorageService extends Context.Tag("StorageService")<
  StorageService,
  StorageServiceApi
>() {}

export const StorageServiceLive = Layer.succeed(StorageService, {
  loadGraphDocument: loadGraphDocumentStorage,
  saveGraphDocument: saveGraphDocumentStorage,
  loadSettings: loadSettingsStorage,
  saveSettings: saveSettingsStorage,
});

export const loadGraphDocument = (
  graphId: GraphId,
): Effect.Effect<GraphDocumentV1 | null, StorageError> =>
  Effect.flatMap(StorageService, (service) =>
    service.loadGraphDocument(graphId),
  );

export const saveGraphDocument = (
  document: GraphDocumentV1,
): Effect.Effect<void, StorageError> =>
  Effect.flatMap(StorageService, (service) =>
    service.saveGraphDocument(document),
  );

export const loadSettings = (): Effect.Effect<
  JsonObject | null,
  StorageError
> => Effect.flatMap(StorageService, (service) => service.loadSettings());

export const saveSettings = (
  settings: JsonObject,
): Effect.Effect<void, StorageError> =>
  Effect.flatMap(StorageService, (service) => service.saveSettings(settings));
