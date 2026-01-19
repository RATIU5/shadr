import { err, ok, type Result } from "./result.js";
import type { SocketTypeId } from "./socket-types.js";

export type ConversionEntry = Readonly<{
  id: string;
  fromType: SocketTypeId;
  toType: SocketTypeId;
  nodeType: string;
  inputKey: string;
  outputKey: string;
}>;

export type ConversionRegistryIssue =
  | Readonly<{
      _tag: "DuplicateConversionId";
      id: string;
    }>
  | Readonly<{
      _tag: "DuplicateConversionPair";
      fromType: SocketTypeId;
      toType: SocketTypeId;
      nodeType: string;
      existingNodeType: string;
    }>;

export type ConversionRegistry = Readonly<{
  entries: ReadonlyArray<ConversionEntry>;
  byFromType: ReadonlyMap<SocketTypeId, ReadonlyArray<ConversionEntry>>;
  byPair: ReadonlyMap<string, ConversionEntry>;
  compatibilityTable: ReadonlyMap<SocketTypeId, ReadonlySet<SocketTypeId>>;
}>;

const makeConversionPairKey = (
  fromType: SocketTypeId,
  toType: SocketTypeId,
): string => `${fromType}->${toType}`;

export const createConversionRegistry = (
  entries: ReadonlyArray<ConversionEntry>,
): Result<ConversionRegistry, ReadonlyArray<ConversionRegistryIssue>> => {
  const issues: ConversionRegistryIssue[] = [];
  const seenIds = new Set<string>();
  const byPair = new Map<string, ConversionEntry>();
  const byFromType = new Map<SocketTypeId, ConversionEntry[]>();
  const compatibilityTable = new Map<SocketTypeId, Set<SocketTypeId>>();

  for (const entry of entries) {
    if (seenIds.has(entry.id)) {
      issues.push({ _tag: "DuplicateConversionId", id: entry.id });
    } else {
      seenIds.add(entry.id);
    }

    const pairKey = makeConversionPairKey(entry.fromType, entry.toType);
    const existing = byPair.get(pairKey);
    if (existing) {
      issues.push({
        _tag: "DuplicateConversionPair",
        fromType: entry.fromType,
        toType: entry.toType,
        nodeType: entry.nodeType,
        existingNodeType: existing.nodeType,
      });
    } else {
      byPair.set(pairKey, entry);
    }

    const list = byFromType.get(entry.fromType);
    if (list) {
      list.push(entry);
    } else {
      byFromType.set(entry.fromType, [entry]);
    }

    const targets = compatibilityTable.get(entry.fromType);
    if (targets) {
      targets.add(entry.toType);
    } else {
      compatibilityTable.set(entry.fromType, new Set([entry.toType]));
    }
  }

  if (issues.length > 0) {
    return err(issues);
  }

  const readonlyByFromType = new Map<
    SocketTypeId,
    ReadonlyArray<ConversionEntry>
  >(Array.from(byFromType.entries()));
  const readonlyCompatibility = new Map<
    SocketTypeId,
    ReadonlySet<SocketTypeId>
  >(Array.from(compatibilityTable.entries()));

  return ok({
    entries,
    byFromType: readonlyByFromType,
    byPair,
    compatibilityTable: readonlyCompatibility,
  });
};

export const getConversionEntry = (
  registry: ConversionRegistry,
  fromType: SocketTypeId,
  toType: SocketTypeId,
): ConversionEntry | undefined =>
  registry.byPair.get(makeConversionPairKey(fromType, toType));

export const listConversionsFrom = (
  registry: ConversionRegistry,
  fromType: SocketTypeId,
): ReadonlyArray<ConversionEntry> => registry.byFromType.get(fromType) ?? [];

export const listConversionTargets = (
  registry: ConversionRegistry,
  fromType: SocketTypeId,
): ReadonlyArray<SocketTypeId> =>
  Array.from(registry.compatibilityTable.get(fromType) ?? []);
