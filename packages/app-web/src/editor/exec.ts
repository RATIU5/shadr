import type { NodeDefinition, NodeOutputValues } from "@shadr/plugin-system";
import type { JsonValue } from "@shadr/shared";

const coerceNumber = (value: JsonValue | null, fallback: number): number =>
  typeof value === "number" ? value : fallback;

const BASIC_NODE_DEFINITION: NodeDefinition = {
  typeId: "basic",
  label: "Basic Params",
  description: "Demo node with float/int/bool/vec params.",
  inputs: [
    {
      key: "in",
      label: "In",
      direction: "input",
      dataType: "float",
    },
  ],
  outputs: [
    {
      key: "out",
      label: "Out",
      direction: "output",
      dataType: "float",
    },
  ],
  paramSchemaId: "basic-params",
  compute: (inputs, params): NodeOutputValues => {
    const input = inputs.in;
    if (typeof input !== "number") {
      return { out: null };
    }
    const gain = coerceNumber(params.gain ?? null, 1);
    const enabled =
      params.enabled === undefined ? true : params.enabled === true;
    return { out: enabled ? input * gain : input };
  },
};

const NODE_DEFINITIONS = new Map<string, NodeDefinition>([
  [BASIC_NODE_DEFINITION.typeId, BASIC_NODE_DEFINITION],
]);

export const resolveNodeDefinition = (
  nodeType: string,
): NodeDefinition | undefined => NODE_DEFINITIONS.get(nodeType);
