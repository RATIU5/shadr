import type { NodeDefinition } from "@shadr/plugin-system";
import type { JsonValue, SocketTypeId } from "@shadr/shared";
import { createConversionRegistry, Either } from "@shadr/shared";

type ConversionSpec = Readonly<{
  id: string;
  label: string;
  description: string;
  fromType: SocketTypeId;
  toType: SocketTypeId;
  // eslint-disable-next-line no-unused-vars -- type-only param name required by TS function syntax
  convert: (value: JsonValue | null) => JsonValue | null;
}>;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

const coerceNumber = (value: JsonValue | null): number | null =>
  isFiniteNumber(value) ? value : null;

const coerceInt = (value: JsonValue | null): number | null => {
  const numeric = coerceNumber(value);
  return numeric === null ? null : Math.trunc(numeric);
};

const coerceBoolean = (value: JsonValue | null): boolean | null =>
  isBoolean(value) ? value : null;

const CONVERSION_SPECS: ReadonlyArray<ConversionSpec> = [
  {
    id: "convert-float-to-int",
    label: "Float to Int",
    description: "Convert float to int (truncate).",
    fromType: "float",
    toType: "int",
    convert: (value) => {
      const numeric = coerceNumber(value);
      return numeric === null ? null : Math.trunc(numeric);
    },
  },
  {
    id: "convert-int-to-float",
    label: "Int to Float",
    description: "Convert int to float.",
    fromType: "int",
    toType: "float",
    convert: (value) => {
      const numeric = coerceInt(value);
      return numeric === null ? null : numeric;
    },
  },
  {
    id: "convert-bool-to-float",
    label: "Bool to Float",
    description: "Convert bool to float (0 or 1).",
    fromType: "bool",
    toType: "float",
    convert: (value) => {
      const flag = coerceBoolean(value);
      return flag === null ? null : flag ? 1 : 0;
    },
  },
  {
    id: "convert-float-to-bool",
    label: "Float to Bool",
    description: "Convert float to bool (non-zero).",
    fromType: "float",
    toType: "bool",
    convert: (value) => {
      const numeric = coerceNumber(value);
      return numeric === null ? null : numeric !== 0;
    },
  },
  {
    id: "convert-bool-to-int",
    label: "Bool to Int",
    description: "Convert bool to int (0 or 1).",
    fromType: "bool",
    toType: "int",
    convert: (value) => {
      const flag = coerceBoolean(value);
      return flag === null ? null : flag ? 1 : 0;
    },
  },
  {
    id: "convert-int-to-bool",
    label: "Int to Bool",
    description: "Convert int to bool (non-zero).",
    fromType: "int",
    toType: "bool",
    convert: (value) => {
      const numeric = coerceInt(value);
      return numeric === null ? null : numeric !== 0;
    },
  },
];

const createConversionNodeDefinition = (
  spec: ConversionSpec,
): NodeDefinition => ({
  typeId: spec.id,
  label: spec.label,
  description: spec.description,
  category: "Conversion",
  inputs: [
    {
      key: "in",
      label: "In",
      direction: "input",
      dataType: spec.fromType,
    },
  ],
  outputs: [
    {
      key: "out",
      label: "Out",
      direction: "output",
      dataType: spec.toType,
    },
  ],
  compute: (inputs): { out: JsonValue | null } => ({
    out: spec.convert(inputs.in ?? null),
  }),
});

const conversionRegistryResult = createConversionRegistry(
  CONVERSION_SPECS.map((spec) => ({
    id: spec.id,
    fromType: spec.fromType,
    toType: spec.toType,
    nodeType: spec.id,
    inputKey: "in",
    outputKey: "out",
  })),
);

if (Either.isLeft(conversionRegistryResult)) {
  const details = conversionRegistryResult.left
    .map((issue) =>
      issue._tag === "DuplicateConversionId"
        ? `duplicate id ${issue.id}`
        : `duplicate pair ${issue.fromType}->${issue.toType} (${issue.nodeType})`,
    )
    .join("; ");
  throw new Error(`Invalid conversion registry: ${details}`);
}

export const CONVERSION_REGISTRY = conversionRegistryResult.right;

export const CONVERSION_NODE_DEFINITIONS: ReadonlyArray<NodeDefinition> =
  CONVERSION_SPECS.map(createConversionNodeDefinition);
