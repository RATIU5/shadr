import type {
  GraphDocumentV1,
  JsonObject,
  JsonValue,
  SubgraphInputMapping,
  SubgraphNodeParams,
  SubgraphOutputMapping,
  SubgraphParamOverrides,
  SubgraphPromotedParam,
} from "@shadr/shared";

type RecordValue = Record<string, JsonValue>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: JsonValue | undefined): value is string =>
  typeof value === "string";

export const parseSubgraphParams = (
  params: JsonObject,
): SubgraphNodeParams | null => {
  const graphValue = params["graph"];
  if (!isJsonObject(graphValue)) {
    return null;
  }
  const graphRecord = graphValue as RecordValue;
  const schemaVersion = graphRecord["schemaVersion"];
  const graphId = graphRecord["graphId"];
  const nodes = graphRecord["nodes"];
  const sockets = graphRecord["sockets"];
  const wires = graphRecord["wires"];
  if (
    typeof schemaVersion !== "number" ||
    !isString(graphId) ||
    !Array.isArray(nodes) ||
    !Array.isArray(sockets) ||
    !Array.isArray(wires)
  ) {
    return null;
  }

  const inputsValue = params["inputs"];
  const outputsValue = params["outputs"];
  if (!Array.isArray(inputsValue) || !Array.isArray(outputsValue)) {
    return null;
  }

  const overridesValue = params["overrides"];
  let overrides: SubgraphParamOverrides | undefined;
  if (overridesValue === null || overridesValue === undefined) {
    overrides = undefined;
  } else if (isJsonObject(overridesValue)) {
    const overrideEntries = Object.entries(overridesValue).flatMap(
      ([nodeId, overrideValue]) => {
        if (!isJsonObject(overrideValue)) {
          return [];
        }
        return [[nodeId, overrideValue] as const];
      },
    );
    if (overrideEntries.length !== Object.keys(overridesValue).length) {
      return null;
    }
    overrides = Object.fromEntries(overrideEntries);
  } else {
    return null;
  }

  const inputs = inputsValue.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const key = entry["key"];
    const nodeId = entry["nodeId"];
    if (!isString(key) || !isString(nodeId)) {
      return [];
    }
    return [{ key, nodeId: nodeId as SubgraphInputMapping["nodeId"] }];
  });

  const outputs = outputsValue.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }
    const key = entry["key"];
    const socketId = entry["socketId"];
    if (!isString(key) || !isString(socketId)) {
      return [];
    }
    return [{ key, socketId: socketId as SubgraphOutputMapping["socketId"] }];
  });

  const promotedValue = params["promotedParams"];
  let promotedParams: ReadonlyArray<SubgraphPromotedParam> | undefined;
  if (promotedValue === null || promotedValue === undefined) {
    promotedParams = undefined;
  } else if (Array.isArray(promotedValue)) {
    const entries = promotedValue.flatMap((entry) => {
      if (!isRecord(entry)) {
        return [];
      }
      const key = entry["key"];
      const nodeId = entry["nodeId"];
      const fieldId = entry["fieldId"];
      if (!isString(key) || !isString(nodeId) || !isString(fieldId)) {
        return [];
      }
      return [
        {
          key,
          nodeId: nodeId as SubgraphPromotedParam["nodeId"],
          fieldId,
        },
      ];
    });
    if (entries.length !== promotedValue.length) {
      return null;
    }
    promotedParams = entries;
  } else {
    return null;
  }

  if (inputs.length !== inputsValue.length) {
    return null;
  }
  if (outputs.length !== outputsValue.length) {
    return null;
  }

  return {
    graph: graphValue as GraphDocumentV1,
    inputs,
    outputs,
    ...(promotedParams ? { promotedParams } : {}),
    ...(overrides ? { overrides } : {}),
  };
};

export const serializeSubgraphParams = (
  params: SubgraphNodeParams,
): JsonObject => ({
  graph: params.graph as unknown as JsonValue,
  inputs: params.inputs as unknown as JsonValue,
  outputs: params.outputs as unknown as JsonValue,
  ...(params.promotedParams
    ? { promotedParams: params.promotedParams as JsonValue }
    : {}),
  ...(params.overrides ? { overrides: params.overrides as JsonValue } : {}),
});
