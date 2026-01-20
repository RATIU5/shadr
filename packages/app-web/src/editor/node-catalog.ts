import type {
  NodeDefinition,
  NodeOutputValues,
  NodeParamValues,
  ParamSchemaDefinition,
} from "@shadr/plugin-system";
import type { JsonObject, JsonValue } from "@shadr/shared";

import { CONVERSION_NODE_DEFINITIONS } from "./conversion-registry";

export const NODE_DRAG_TYPE = "application/x-shadr-node";

export type NodeCatalogEntry = Readonly<{
  type: string;
  label: string;
  description: string;
  category?: string;
  paramSchema?: ParamSchemaDefinition;
}>;

type PrimitiveSocketType =
  | "float"
  | "int"
  | "bool"
  | "vec2"
  | "vec3"
  | "vec4"
  | "mat3"
  | "mat4"
  | "sampler2D";

/* eslint-disable no-unused-vars */
type ResolveParamValue = (params: NodeParamValues) => JsonValue;
type BinaryMathOp = (a: number, b: number) => number | null;
/* eslint-enable no-unused-vars */

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

const isNumericArray = (
  value: unknown,
  length: number,
): value is readonly number[] =>
  Array.isArray(value) &&
  value.length === length &&
  value.every((entry) => isFiniteNumber(entry));

const coerceNumber = (value: JsonValue | null): number | null =>
  isFiniteNumber(value) ? value : null;

const coerceVec2 = (
  value: JsonValue | null,
): readonly [number, number] | null =>
  isNumericArray(value, 2) ? (value as readonly [number, number]) : null;

const coerceVec3 = (
  value: JsonValue | null,
): readonly [number, number, number] | null =>
  isNumericArray(value, 3)
    ? (value as readonly [number, number, number])
    : null;

const coerceVec4 = (
  value: JsonValue | null,
): readonly [number, number, number, number] | null =>
  isNumericArray(value, 4)
    ? (value as readonly [number, number, number, number])
    : null;

const getParamNumber = (
  params: NodeParamValues,
  key: string,
  fallback: number,
): number => {
  const value = params[key];
  return isFiniteNumber(value) ? value : fallback;
};

const getParamBoolean = (
  params: NodeParamValues,
  key: string,
  fallback: boolean,
): boolean => {
  const value = params[key];
  return isBoolean(value) ? value : fallback;
};

const getParamVec2 = (
  params: NodeParamValues,
  key: string,
  fallback: readonly [number, number],
): readonly [number, number] => {
  const value = params[key];
  return isNumericArray(value, 2)
    ? (value as readonly [number, number])
    : fallback;
};

const getParamVec3 = (
  params: NodeParamValues,
  key: string,
  fallback: readonly [number, number, number],
): readonly [number, number, number] => {
  const value = params[key];
  return isNumericArray(value, 3)
    ? (value as readonly [number, number, number])
    : fallback;
};

const getParamVec4 = (
  params: NodeParamValues,
  key: string,
  fallback: readonly [number, number, number, number],
): readonly [number, number, number, number] => {
  const value = params[key];
  return isNumericArray(value, 4)
    ? (value as readonly [number, number, number, number])
    : fallback;
};

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const resolveNumberInput = (
  inputValue: JsonValue | null,
  params: NodeParamValues,
  paramKey: string,
  fallback: number,
): number => {
  const input = coerceNumber(inputValue);
  if (input !== null) {
    return input;
  }
  return getParamNumber(params, paramKey, fallback);
};

const resolveIndex = (
  params: NodeParamValues,
  key: string,
  maxIndex: number,
  fallback: number,
): number => {
  const raw = getParamNumber(params, key, fallback);
  const rounded = Math.round(raw);
  return clampNumber(rounded, 0, maxIndex);
};

const createConstantNodeDefinition = (
  typeId: string,
  label: string,
  description: string,
  dataType: "float" | "int" | "bool" | "vec2" | "vec3" | "vec4",
  paramSchemaId: string,
  resolveValue: ResolveParamValue,
): NodeDefinition => ({
  typeId,
  label,
  description,
  category: "Constants",
  inputs: [],
  outputs: [
    {
      key: "out",
      label: "Value",
      direction: "output",
      dataType,
    },
  ],
  paramSchemaId,
  compute: (_inputs, params): NodeOutputValues => ({
    out: resolveValue(params),
  }),
});

const createBinaryMathNode = (
  typeId: string,
  label: string,
  description: string,
  computeValue: BinaryMathOp,
): NodeDefinition => ({
  typeId,
  label,
  description,
  category: "Math",
  inputs: [
    {
      key: "a",
      label: "A",
      direction: "input",
      dataType: "float",
    },
    {
      key: "b",
      label: "B",
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
  compute: (inputs): NodeOutputValues => {
    const a = coerceNumber(inputs.a ?? null);
    const b = coerceNumber(inputs.b ?? null);
    if (a === null || b === null) {
      return { out: null };
    }
    const result = computeValue(a, b);
    return {
      out: result !== null && Number.isFinite(result) ? result : null,
    };
  },
});

const createOutputNodeDefinition = (
  typeId: string,
  label: string,
  description: string,
  dataType: "float" | "int" | "bool" | "vec2" | "vec3" | "vec4",
): NodeDefinition => ({
  typeId,
  label,
  description,
  category: "Output",
  inputs: [
    {
      key: "value",
      label: "Value",
      direction: "input",
      dataType,
      isOptional: true,
    },
  ],
  outputs: [
    {
      key: "out",
      label: "Out",
      direction: "output",
      dataType,
    },
  ],
  compute: (inputs): NodeOutputValues => ({
    out: inputs.value ?? null,
  }),
});

const createRerouteNodeDefinition = (
  typeId: string,
  label: string,
  description: string,
  dataType: PrimitiveSocketType,
): NodeDefinition => ({
  typeId,
  label,
  description,
  category: "Utility",
  inputs: [
    {
      key: "in",
      label: "In",
      direction: "input",
      dataType,
    },
  ],
  outputs: [
    {
      key: "out",
      label: "Out",
      direction: "output",
      dataType,
    },
  ],
  compute: (inputs): NodeOutputValues => ({
    out: inputs.in ?? null,
  }),
});

const CONST_FLOAT_SCHEMA: ParamSchemaDefinition = {
  id: "const-float",
  label: "Float",
  fields: [
    {
      id: "value",
      label: "Value",
      kind: "float",
      defaultValue: 0,
      step: 0.01,
    },
  ],
};

const CONST_INT_SCHEMA: ParamSchemaDefinition = {
  id: "const-int",
  label: "Int",
  fields: [
    {
      id: "value",
      label: "Value",
      kind: "int",
      defaultValue: 0,
      step: 1,
    },
  ],
};

const CONST_BOOL_SCHEMA: ParamSchemaDefinition = {
  id: "const-bool",
  label: "Bool",
  fields: [
    {
      id: "value",
      label: "Value",
      kind: "bool",
      defaultValue: false,
    },
  ],
};

const CONST_VEC2_SCHEMA: ParamSchemaDefinition = {
  id: "const-vec2",
  label: "Vec2",
  fields: [
    {
      id: "value",
      label: "Value",
      kind: "vec2",
      defaultValue: [0, 0],
      step: 0.01,
    },
  ],
};

const CONST_VEC3_SCHEMA: ParamSchemaDefinition = {
  id: "const-vec3",
  label: "Vec3",
  fields: [
    {
      id: "value",
      label: "Value",
      kind: "vec3",
      defaultValue: [0, 0, 0],
      step: 0.01,
    },
  ],
};

const CONST_VEC4_SCHEMA: ParamSchemaDefinition = {
  id: "const-vec4",
  label: "Vec4",
  fields: [
    {
      id: "value",
      label: "Value",
      kind: "vec4",
      defaultValue: [0, 0, 0, 1],
      step: 0.01,
    },
  ],
};

const COMPOSE_VEC2_SCHEMA: ParamSchemaDefinition = {
  id: "compose-vec2",
  label: "Vec2",
  fields: [
    {
      id: "x",
      label: "X",
      kind: "float",
      defaultValue: 0,
      step: 0.01,
    },
    {
      id: "y",
      label: "Y",
      kind: "float",
      defaultValue: 0,
      step: 0.01,
    },
  ],
};

const COMPOSE_VEC3_SCHEMA: ParamSchemaDefinition = {
  id: "compose-vec3",
  label: "Vec3",
  fields: [
    {
      id: "x",
      label: "X",
      kind: "float",
      defaultValue: 0,
      step: 0.01,
    },
    {
      id: "y",
      label: "Y",
      kind: "float",
      defaultValue: 0,
      step: 0.01,
    },
    {
      id: "z",
      label: "Z",
      kind: "float",
      defaultValue: 0,
      step: 0.01,
    },
  ],
};

const COMPOSE_VEC4_SCHEMA: ParamSchemaDefinition = {
  id: "compose-vec4",
  label: "Vec4",
  fields: [
    {
      id: "x",
      label: "X",
      kind: "float",
      defaultValue: 0,
      step: 0.01,
    },
    {
      id: "y",
      label: "Y",
      kind: "float",
      defaultValue: 0,
      step: 0.01,
    },
    {
      id: "z",
      label: "Z",
      kind: "float",
      defaultValue: 0,
      step: 0.01,
    },
    {
      id: "w",
      label: "W",
      kind: "float",
      defaultValue: 1,
      step: 0.01,
    },
  ],
};

const SWIZZLE_VEC2_SCHEMA: ParamSchemaDefinition = {
  id: "swizzle-vec2",
  label: "Vec2",
  fields: [
    {
      id: "xIndex",
      label: "X Source",
      kind: "int",
      defaultValue: 0,
      min: 0,
      max: 1,
      step: 1,
    },
    {
      id: "yIndex",
      label: "Y Source",
      kind: "int",
      defaultValue: 1,
      min: 0,
      max: 1,
      step: 1,
    },
  ],
};

const SWIZZLE_VEC3_SCHEMA: ParamSchemaDefinition = {
  id: "swizzle-vec3",
  label: "Vec3",
  fields: [
    {
      id: "xIndex",
      label: "X Source",
      kind: "int",
      defaultValue: 0,
      min: 0,
      max: 2,
      step: 1,
    },
    {
      id: "yIndex",
      label: "Y Source",
      kind: "int",
      defaultValue: 1,
      min: 0,
      max: 2,
      step: 1,
    },
    {
      id: "zIndex",
      label: "Z Source",
      kind: "int",
      defaultValue: 2,
      min: 0,
      max: 2,
      step: 1,
    },
  ],
};

const SWIZZLE_VEC4_SCHEMA: ParamSchemaDefinition = {
  id: "swizzle-vec4",
  label: "Vec4",
  fields: [
    {
      id: "xIndex",
      label: "X Source",
      kind: "int",
      defaultValue: 0,
      min: 0,
      max: 3,
      step: 1,
    },
    {
      id: "yIndex",
      label: "Y Source",
      kind: "int",
      defaultValue: 1,
      min: 0,
      max: 3,
      step: 1,
    },
    {
      id: "zIndex",
      label: "Z Source",
      kind: "int",
      defaultValue: 2,
      min: 0,
      max: 3,
      step: 1,
    },
    {
      id: "wIndex",
      label: "W Source",
      kind: "int",
      defaultValue: 3,
      min: 0,
      max: 3,
      step: 1,
    },
  ],
};

const CLAMP_SCHEMA: ParamSchemaDefinition = {
  id: "clamp",
  label: "Clamp",
  fields: [
    {
      id: "min",
      label: "Min",
      kind: "float",
      defaultValue: 0,
      step: 0.01,
    },
    {
      id: "max",
      label: "Max",
      kind: "float",
      defaultValue: 1,
      step: 0.01,
    },
  ],
};

const LERP_SCHEMA: ParamSchemaDefinition = {
  id: "lerp",
  label: "Lerp",
  fields: [
    {
      id: "t",
      label: "T",
      kind: "float",
      defaultValue: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
    },
  ],
};

const COLOR_SCHEMA: ParamSchemaDefinition = {
  id: "color",
  label: "Color",
  fields: [
    {
      id: "color",
      label: "Color",
      kind: "vec3",
      defaultValue: [1, 0.6, 0.2],
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      id: "alpha",
      label: "Alpha",
      kind: "float",
      defaultValue: 1,
      min: 0,
      max: 1,
      step: 0.01,
    },
  ],
};

const CONSTANT_NODES: ReadonlyArray<NodeDefinition> = [
  createConstantNodeDefinition(
    "const-float",
    "Const Float",
    "Constant float value.",
    "float",
    CONST_FLOAT_SCHEMA.id,
    (params) => getParamNumber(params, "value", 0),
  ),
  createConstantNodeDefinition(
    "const-int",
    "Const Int",
    "Constant integer value.",
    "int",
    CONST_INT_SCHEMA.id,
    (params) => getParamNumber(params, "value", 0),
  ),
  createConstantNodeDefinition(
    "const-bool",
    "Const Bool",
    "Constant boolean value.",
    "bool",
    CONST_BOOL_SCHEMA.id,
    (params) => getParamBoolean(params, "value", false),
  ),
  createConstantNodeDefinition(
    "const-vec2",
    "Const Vec2",
    "Constant vec2 value.",
    "vec2",
    CONST_VEC2_SCHEMA.id,
    (params) => getParamVec2(params, "value", [0, 0]),
  ),
  createConstantNodeDefinition(
    "const-vec3",
    "Const Vec3",
    "Constant vec3 value.",
    "vec3",
    CONST_VEC3_SCHEMA.id,
    (params) => getParamVec3(params, "value", [0, 0, 0]),
  ),
  createConstantNodeDefinition(
    "const-vec4",
    "Const Vec4",
    "Constant vec4 value.",
    "vec4",
    CONST_VEC4_SCHEMA.id,
    (params) => getParamVec4(params, "value", [0, 0, 0, 1]),
  ),
];

const MATH_NODES: ReadonlyArray<NodeDefinition> = [
  createBinaryMathNode(
    "math-add",
    "Add",
    "Add two float values.",
    (a, b) => a + b,
  ),
  createBinaryMathNode(
    "math-subtract",
    "Subtract",
    "Subtract B from A.",
    (a, b) => a - b,
  ),
  createBinaryMathNode(
    "math-multiply",
    "Multiply",
    "Multiply two float values.",
    (a, b) => a * b,
  ),
  createBinaryMathNode("math-divide", "Divide", "Divide A by B.", (a, b) =>
    b === 0 ? null : a / b,
  ),
  {
    typeId: "clamp",
    label: "Clamp",
    description: "Clamp a float between min/max.",
    category: "Math",
    inputs: [
      {
        key: "value",
        label: "Value",
        direction: "input",
        dataType: "float",
      },
      {
        key: "min",
        label: "Min",
        direction: "input",
        dataType: "float",
        isOptional: true,
      },
      {
        key: "max",
        label: "Max",
        direction: "input",
        dataType: "float",
        isOptional: true,
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
    paramSchemaId: CLAMP_SCHEMA.id,
    compute: (inputs, params): NodeOutputValues => {
      const value = coerceNumber(inputs.value ?? null);
      if (value === null) {
        return { out: null };
      }
      const min = resolveNumberInput(inputs.min ?? null, params, "min", 0);
      const max = resolveNumberInput(inputs.max ?? null, params, "max", 1);
      const low = Math.min(min, max);
      const high = Math.max(min, max);
      return { out: clampNumber(value, low, high) };
    },
  },
  {
    typeId: "lerp",
    label: "Lerp",
    description: "Linearly interpolate between A and B.",
    category: "Math",
    inputs: [
      {
        key: "a",
        label: "A",
        direction: "input",
        dataType: "float",
      },
      {
        key: "b",
        label: "B",
        direction: "input",
        dataType: "float",
      },
      {
        key: "t",
        label: "T",
        direction: "input",
        dataType: "float",
        isOptional: true,
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
    paramSchemaId: LERP_SCHEMA.id,
    compute: (inputs, params): NodeOutputValues => {
      const a = coerceNumber(inputs.a ?? null);
      const b = coerceNumber(inputs.b ?? null);
      if (a === null || b === null) {
        return { out: null };
      }
      const t = resolveNumberInput(inputs.t ?? null, params, "t", 0.5);
      const clamped = clampNumber(t, 0, 1);
      return { out: a + (b - a) * clamped };
    },
  },
];

const VECTOR_NODES: ReadonlyArray<NodeDefinition> = [
  {
    typeId: "compose-vec2",
    label: "Compose Vec2",
    description: "Compose a vec2 from X/Y values.",
    category: "Vector",
    inputs: [
      {
        key: "x",
        label: "X",
        direction: "input",
        dataType: "float",
        isOptional: true,
      },
      {
        key: "y",
        label: "Y",
        direction: "input",
        dataType: "float",
        isOptional: true,
      },
    ],
    outputs: [
      {
        key: "out",
        label: "Out",
        direction: "output",
        dataType: "vec2",
      },
    ],
    paramSchemaId: COMPOSE_VEC2_SCHEMA.id,
    compute: (inputs, params): NodeOutputValues => {
      const x = resolveNumberInput(inputs.x ?? null, params, "x", 0);
      const y = resolveNumberInput(inputs.y ?? null, params, "y", 0);
      return { out: [x, y] };
    },
  },
  {
    typeId: "compose-vec3",
    label: "Compose Vec3",
    description: "Compose a vec3 from X/Y/Z values.",
    category: "Vector",
    inputs: [
      {
        key: "x",
        label: "X",
        direction: "input",
        dataType: "float",
        isOptional: true,
      },
      {
        key: "y",
        label: "Y",
        direction: "input",
        dataType: "float",
        isOptional: true,
      },
      {
        key: "z",
        label: "Z",
        direction: "input",
        dataType: "float",
        isOptional: true,
      },
    ],
    outputs: [
      {
        key: "out",
        label: "Out",
        direction: "output",
        dataType: "vec3",
      },
    ],
    paramSchemaId: COMPOSE_VEC3_SCHEMA.id,
    compute: (inputs, params): NodeOutputValues => {
      const x = resolveNumberInput(inputs.x ?? null, params, "x", 0);
      const y = resolveNumberInput(inputs.y ?? null, params, "y", 0);
      const z = resolveNumberInput(inputs.z ?? null, params, "z", 0);
      return { out: [x, y, z] };
    },
  },
  {
    typeId: "compose-vec4",
    label: "Compose Vec4",
    description: "Compose a vec4 from X/Y/Z/W values.",
    category: "Vector",
    inputs: [
      {
        key: "x",
        label: "X",
        direction: "input",
        dataType: "float",
        isOptional: true,
      },
      {
        key: "y",
        label: "Y",
        direction: "input",
        dataType: "float",
        isOptional: true,
      },
      {
        key: "z",
        label: "Z",
        direction: "input",
        dataType: "float",
        isOptional: true,
      },
      {
        key: "w",
        label: "W",
        direction: "input",
        dataType: "float",
        isOptional: true,
      },
    ],
    outputs: [
      {
        key: "out",
        label: "Out",
        direction: "output",
        dataType: "vec4",
      },
    ],
    paramSchemaId: COMPOSE_VEC4_SCHEMA.id,
    compute: (inputs, params): NodeOutputValues => {
      const x = resolveNumberInput(inputs.x ?? null, params, "x", 0);
      const y = resolveNumberInput(inputs.y ?? null, params, "y", 0);
      const z = resolveNumberInput(inputs.z ?? null, params, "z", 0);
      const w = resolveNumberInput(inputs.w ?? null, params, "w", 1);
      return { out: [x, y, z, w] };
    },
  },
  {
    typeId: "swizzle-vec2",
    label: "Swizzle Vec2",
    description: "Reorder vec2 components.",
    category: "Vector",
    inputs: [
      {
        key: "value",
        label: "Value",
        direction: "input",
        dataType: "vec2",
      },
    ],
    outputs: [
      {
        key: "out",
        label: "Out",
        direction: "output",
        dataType: "vec2",
      },
    ],
    paramSchemaId: SWIZZLE_VEC2_SCHEMA.id,
    compute: (inputs, params): NodeOutputValues => {
      const value = coerceVec2(inputs.value ?? null);
      if (!value) {
        return { out: null };
      }
      const xIndex = resolveIndex(params, "xIndex", 1, 0);
      const yIndex = resolveIndex(params, "yIndex", 1, 1);
      return { out: [value[xIndex], value[yIndex]] };
    },
  },
  {
    typeId: "swizzle-vec3",
    label: "Swizzle Vec3",
    description: "Reorder vec3 components.",
    category: "Vector",
    inputs: [
      {
        key: "value",
        label: "Value",
        direction: "input",
        dataType: "vec3",
      },
    ],
    outputs: [
      {
        key: "out",
        label: "Out",
        direction: "output",
        dataType: "vec3",
      },
    ],
    paramSchemaId: SWIZZLE_VEC3_SCHEMA.id,
    compute: (inputs, params): NodeOutputValues => {
      const value = coerceVec3(inputs.value ?? null);
      if (!value) {
        return { out: null };
      }
      const xIndex = resolveIndex(params, "xIndex", 2, 0);
      const yIndex = resolveIndex(params, "yIndex", 2, 1);
      const zIndex = resolveIndex(params, "zIndex", 2, 2);
      return { out: [value[xIndex], value[yIndex], value[zIndex]] };
    },
  },
  {
    typeId: "swizzle-vec4",
    label: "Swizzle Vec4",
    description: "Reorder vec4 components.",
    category: "Vector",
    inputs: [
      {
        key: "value",
        label: "Value",
        direction: "input",
        dataType: "vec4",
      },
    ],
    outputs: [
      {
        key: "out",
        label: "Out",
        direction: "output",
        dataType: "vec4",
      },
    ],
    paramSchemaId: SWIZZLE_VEC4_SCHEMA.id,
    compute: (inputs, params): NodeOutputValues => {
      const value = coerceVec4(inputs.value ?? null);
      if (!value) {
        return { out: null };
      }
      const xIndex = resolveIndex(params, "xIndex", 3, 0);
      const yIndex = resolveIndex(params, "yIndex", 3, 1);
      const zIndex = resolveIndex(params, "zIndex", 3, 2);
      const wIndex = resolveIndex(params, "wIndex", 3, 3);
      return {
        out: [value[xIndex], value[yIndex], value[zIndex], value[wIndex]],
      };
    },
  },
  {
    typeId: "color",
    label: "Color",
    description: "Build a vec4 color from RGB and alpha.",
    category: "Vector",
    inputs: [
      {
        key: "color",
        label: "Color",
        direction: "input",
        dataType: "vec3",
        isOptional: true,
      },
      {
        key: "alpha",
        label: "Alpha",
        direction: "input",
        dataType: "float",
        isOptional: true,
      },
    ],
    outputs: [
      {
        key: "out",
        label: "Out",
        direction: "output",
        dataType: "vec4",
      },
    ],
    paramSchemaId: COLOR_SCHEMA.id,
    compute: (inputs, params): NodeOutputValues => {
      const baseColor =
        coerceVec3(inputs.color ?? null) ??
        getParamVec3(params, "color", [1, 0.6, 0.2]);
      const alpha = resolveNumberInput(
        inputs.alpha ?? null,
        params,
        "alpha",
        1,
      );
      return {
        out: [
          baseColor[0],
          baseColor[1],
          baseColor[2],
          clampNumber(alpha, 0, 1),
        ],
      };
    },
  },
];

const OUTPUT_NODES: ReadonlyArray<NodeDefinition> = [
  createOutputNodeDefinition(
    "output-text-float",
    "Output: Text (Float)",
    "Compile a float to a text artifact.",
    "float",
  ),
  createOutputNodeDefinition(
    "output-text-int",
    "Output: Text (Int)",
    "Compile an int to a text artifact.",
    "int",
  ),
  createOutputNodeDefinition(
    "output-text-bool",
    "Output: Text (Bool)",
    "Compile a bool to a text artifact.",
    "bool",
  ),
  createOutputNodeDefinition(
    "output-text-vec2",
    "Output: Text (Vec2)",
    "Compile a vec2 to a text artifact.",
    "vec2",
  ),
  createOutputNodeDefinition(
    "output-text-vec3",
    "Output: Text (Vec3)",
    "Compile a vec3 to a text artifact.",
    "vec3",
  ),
  createOutputNodeDefinition(
    "output-text-vec4",
    "Output: Text (Vec4)",
    "Compile a vec4 to a text artifact.",
    "vec4",
  ),
  createOutputNodeDefinition(
    "output-code-float",
    "Output: Code (Float)",
    "Compile a float to a code snippet.",
    "float",
  ),
  createOutputNodeDefinition(
    "output-code-int",
    "Output: Code (Int)",
    "Compile an int to a code snippet.",
    "int",
  ),
  createOutputNodeDefinition(
    "output-code-bool",
    "Output: Code (Bool)",
    "Compile a bool to a code snippet.",
    "bool",
  ),
  createOutputNodeDefinition(
    "output-code-vec2",
    "Output: Code (Vec2)",
    "Compile a vec2 to a code snippet.",
    "vec2",
  ),
  createOutputNodeDefinition(
    "output-code-vec3",
    "Output: Code (Vec3)",
    "Compile a vec3 to a code snippet.",
    "vec3",
  ),
  createOutputNodeDefinition(
    "output-code-vec4",
    "Output: Code (Vec4)",
    "Compile a vec4 to a code snippet.",
    "vec4",
  ),
  createOutputNodeDefinition(
    "output-image-float",
    "Output: Image (Float)",
    "Compile a float to a grayscale image.",
    "float",
  ),
  createOutputNodeDefinition(
    "output-image-vec3",
    "Output: Image (Vec3)",
    "Compile a vec3 color to an image.",
    "vec3",
  ),
  createOutputNodeDefinition(
    "output-image-vec4",
    "Output: Image (Vec4)",
    "Compile a vec4 color to an image.",
    "vec4",
  ),
];

const REROUTE_NODES: ReadonlyArray<NodeDefinition> = [
  createRerouteNodeDefinition(
    "reroute-float",
    "Reroute (Float)",
    "Pass-through dot for float wiring.",
    "float",
  ),
  createRerouteNodeDefinition(
    "reroute-int",
    "Reroute (Int)",
    "Pass-through dot for int wiring.",
    "int",
  ),
  createRerouteNodeDefinition(
    "reroute-bool",
    "Reroute (Bool)",
    "Pass-through dot for bool wiring.",
    "bool",
  ),
  createRerouteNodeDefinition(
    "reroute-vec2",
    "Reroute (Vec2)",
    "Pass-through dot for vec2 wiring.",
    "vec2",
  ),
  createRerouteNodeDefinition(
    "reroute-vec3",
    "Reroute (Vec3)",
    "Pass-through dot for vec3 wiring.",
    "vec3",
  ),
  createRerouteNodeDefinition(
    "reroute-vec4",
    "Reroute (Vec4)",
    "Pass-through dot for vec4 wiring.",
    "vec4",
  ),
  createRerouteNodeDefinition(
    "reroute-mat3",
    "Reroute (Mat3)",
    "Pass-through dot for mat3 wiring.",
    "mat3",
  ),
  createRerouteNodeDefinition(
    "reroute-mat4",
    "Reroute (Mat4)",
    "Pass-through dot for mat4 wiring.",
    "mat4",
  ),
  createRerouteNodeDefinition(
    "reroute-sampler2d",
    "Reroute (Sampler2D)",
    "Pass-through dot for sampler2D wiring.",
    "sampler2D",
  ),
];

const REROUTE_NODE_TYPE_SET = new Set<string>(
  REROUTE_NODES.map((definition) => definition.typeId),
);

export const isRerouteNodeType = (nodeType: string): boolean =>
  REROUTE_NODE_TYPE_SET.has(nodeType);

export const NODE_DEFINITIONS: ReadonlyArray<NodeDefinition> = [
  ...CONSTANT_NODES,
  ...MATH_NODES,
  ...VECTOR_NODES,
  ...CONVERSION_NODE_DEFINITIONS,
  ...REROUTE_NODES,
  ...OUTPUT_NODES,
];

const PARAM_SCHEMAS: ReadonlyArray<ParamSchemaDefinition> = [
  CONST_FLOAT_SCHEMA,
  CONST_INT_SCHEMA,
  CONST_BOOL_SCHEMA,
  CONST_VEC2_SCHEMA,
  CONST_VEC3_SCHEMA,
  CONST_VEC4_SCHEMA,
  COMPOSE_VEC2_SCHEMA,
  COMPOSE_VEC3_SCHEMA,
  COMPOSE_VEC4_SCHEMA,
  SWIZZLE_VEC2_SCHEMA,
  SWIZZLE_VEC3_SCHEMA,
  SWIZZLE_VEC4_SCHEMA,
  CLAMP_SCHEMA,
  LERP_SCHEMA,
  COLOR_SCHEMA,
];

const PARAM_SCHEMA_MAP = new Map<string, ParamSchemaDefinition>(
  PARAM_SCHEMAS.map((schema) => [schema.id, schema]),
);

export const NODE_CATALOG: ReadonlyArray<NodeCatalogEntry> =
  NODE_DEFINITIONS.map((definition) => ({
    type: definition.typeId,
    label: definition.label,
    description: definition.description,
    paramSchema: definition.paramSchemaId
      ? PARAM_SCHEMA_MAP.get(definition.paramSchemaId)
      : undefined,
  }));

const NODE_MAP = new Map<string, NodeCatalogEntry>(
  NODE_CATALOG.map((entry) => [entry.type, entry]),
);

export const getNodeCatalogEntry = (
  type: string,
): NodeCatalogEntry | undefined => NODE_MAP.get(type);

const NODE_DEFINITION_MAP = new Map<string, NodeDefinition>(
  NODE_DEFINITIONS.map((definition) => [definition.typeId, definition]),
);

export const resolveNodeDefinition = (
  nodeType: string,
): NodeDefinition | undefined => NODE_DEFINITION_MAP.get(nodeType);

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
