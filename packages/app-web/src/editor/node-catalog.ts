import type { ParamSchemaDefinition } from "@shadr/plugin-system";
import type { JsonObject, JsonValue } from "@shadr/shared";

export type NodeCatalogEntry = Readonly<{
  type: string;
  label: string;
  description: string;
  paramSchema?: ParamSchemaDefinition;
}>;

const BASIC_PARAM_SCHEMA: ParamSchemaDefinition = {
  id: "basic-params",
  label: "Basic Params",
  fields: [
    {
      id: "gain",
      label: "Gain",
      kind: "float",
      defaultValue: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      id: "steps",
      label: "Steps",
      kind: "int",
      defaultValue: 4,
      min: 1,
      max: 16,
      step: 1,
    },
    {
      id: "enabled",
      label: "Enabled",
      kind: "bool",
      defaultValue: true,
    },
    {
      id: "offset2",
      label: "Offset",
      kind: "vec2",
      defaultValue: [0, 0],
      min: -2,
      max: 2,
      step: 0.1,
    },
    {
      id: "tint3",
      label: "Tint",
      kind: "vec3",
      defaultValue: [1, 0.45, 0.25],
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      id: "pivot4",
      label: "Pivot",
      kind: "vec4",
      defaultValue: [0, 0.5, 1, 1],
      step: 0.1,
    },
  ],
};

export const NODE_CATALOG: ReadonlyArray<NodeCatalogEntry> = [
  {
    type: "basic",
    label: "Basic Params",
    description: "Demo node with float/int/bool/vec params.",
    paramSchema: BASIC_PARAM_SCHEMA,
  },
];

const NODE_MAP = new Map<string, NodeCatalogEntry>(
  NODE_CATALOG.map((entry) => [entry.type, entry]),
);

export const getNodeCatalogEntry = (
  type: string,
): NodeCatalogEntry | undefined => NODE_MAP.get(type);

export const createDefaultParams = (
  schema: ParamSchemaDefinition | undefined,
): JsonObject => {
  if (!schema) {
    return {};
  }
  const params: Record<string, JsonValue> = {};
  for (const field of schema.fields) {
    params[field.id] = field.defaultValue;
  }
  return params;
};
