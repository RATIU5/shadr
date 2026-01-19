import { err, isErr, ok, type Result } from "./result.js";

export const SOCKET_TYPE_PRIMITIVES = [
  "float",
  "int",
  "bool",
  "vec2",
  "vec3",
  "vec4",
  "mat3",
  "mat4",
  "sampler2D",
] as const;

export type SocketPrimitive = (typeof SOCKET_TYPE_PRIMITIVES)[number];

export type SocketTypeId = string;

export type SocketTypeMetadata = Readonly<{
  id: SocketTypeId;
  label: string;
  description: string;
  color: string;
  isPrimitive: boolean;
}>;

const primitiveSocketTypeMetadata: Record<SocketPrimitive, SocketTypeMetadata> =
  {
    float: {
      id: "float",
      label: "Float",
      description: "Single-precision number.",
      color: "#4aa8ff",
      isPrimitive: true,
    },
    int: {
      id: "int",
      label: "Int",
      description: "Whole number.",
      color: "#4aff86",
      isPrimitive: true,
    },
    bool: {
      id: "bool",
      label: "Bool",
      description: "Boolean true/false.",
      color: "#ffd166",
      isPrimitive: true,
    },
    vec2: {
      id: "vec2",
      label: "Vec2",
      description: "2D vector.",
      color: "#f497ff",
      isPrimitive: true,
    },
    vec3: {
      id: "vec3",
      label: "Vec3",
      description: "3D vector.",
      color: "#f67280",
      isPrimitive: true,
    },
    vec4: {
      id: "vec4",
      label: "Vec4",
      description: "4D vector.",
      color: "#f25f5c",
      isPrimitive: true,
    },
    mat3: {
      id: "mat3",
      label: "Mat3",
      description: "3x3 matrix.",
      color: "#6c8cff",
      isPrimitive: true,
    },
    mat4: {
      id: "mat4",
      label: "Mat4",
      description: "4x4 matrix.",
      color: "#5b5ff2",
      isPrimitive: true,
    },
    sampler2D: {
      id: "sampler2D",
      label: "Sampler2D",
      description: "2D texture sampler.",
      color: "#9b5de5",
      isPrimitive: true,
    },
  };

export const isPrimitiveSocketType = (
  value: SocketTypeId,
): value is SocketPrimitive =>
  (SOCKET_TYPE_PRIMITIVES as readonly string[]).includes(value);

export const getPrimitiveSocketTypeMetadata = (
  id: SocketPrimitive,
): SocketTypeMetadata => primitiveSocketTypeMetadata[id];

export const getSocketTypeMetadata = (
  id: SocketTypeId,
): SocketTypeMetadata | undefined =>
  isPrimitiveSocketType(id) ? primitiveSocketTypeMetadata[id] : undefined;

export type SocketTypeCompatibilityEntry = Readonly<{
  fromType: SocketTypeId;
  toType: SocketTypeId;
}>;

export type SocketTypeCompatibilityIssue = Readonly<{
  _tag: "DuplicateCompatibilityPair";
  fromType: SocketTypeId;
  toType: SocketTypeId;
}>;

export type SocketTypeCompatibilityMatrix = Readonly<{
  entries: ReadonlyArray<SocketTypeCompatibilityEntry>;
  byFromType: ReadonlyMap<SocketTypeId, ReadonlySet<SocketTypeId>>;
}>;

const makeCompatibilityKey = (
  fromType: SocketTypeId,
  toType: SocketTypeId,
): string => `${fromType}->${toType}`;

export const createSocketTypeCompatibilityMatrix = (
  entries: ReadonlyArray<SocketTypeCompatibilityEntry>,
): Result<
  SocketTypeCompatibilityMatrix,
  ReadonlyArray<SocketTypeCompatibilityIssue>
> => {
  const issues: SocketTypeCompatibilityIssue[] = [];
  const byFromType = new Map<SocketTypeId, Set<SocketTypeId>>();
  const seenPairs = new Set<string>();

  for (const entry of entries) {
    const pairKey = makeCompatibilityKey(entry.fromType, entry.toType);
    if (seenPairs.has(pairKey)) {
      issues.push({
        _tag: "DuplicateCompatibilityPair",
        fromType: entry.fromType,
        toType: entry.toType,
      });
      continue;
    }
    seenPairs.add(pairKey);

    const targets = byFromType.get(entry.fromType);
    if (targets) {
      targets.add(entry.toType);
    } else {
      byFromType.set(entry.fromType, new Set([entry.toType]));
    }
  }

  if (issues.length > 0) {
    return err(issues);
  }

  const readonlyByFromType = new Map<SocketTypeId, ReadonlySet<SocketTypeId>>(
    Array.from(byFromType.entries(), ([key, value]) => [key, new Set(value)]),
  );

  return ok({
    entries,
    byFromType: readonlyByFromType,
  });
};

const DEFAULT_SOCKET_TYPE_COMPATIBILITY_ENTRIES: ReadonlyArray<SocketTypeCompatibilityEntry> =
  [];

const defaultCompatibilityResult = createSocketTypeCompatibilityMatrix(
  DEFAULT_SOCKET_TYPE_COMPATIBILITY_ENTRIES,
);
if (isErr(defaultCompatibilityResult)) {
  const details = defaultCompatibilityResult.left
    .map((issue) => `${issue.fromType}->${issue.toType}`)
    .join(", ");
  throw new Error(
    `Invalid socket compatibility matrix entries: ${details || "unknown"}`,
  );
}

const DEFAULT_SOCKET_TYPE_COMPATIBILITY_MATRIX =
  defaultCompatibilityResult.right;

let activeCompatibilityMatrix = DEFAULT_SOCKET_TYPE_COMPATIBILITY_MATRIX;

export const getSocketTypeCompatibilityMatrix =
  (): SocketTypeCompatibilityMatrix => activeCompatibilityMatrix;

export const setSocketTypeCompatibilityMatrix = (
  matrix: SocketTypeCompatibilityMatrix,
): void => {
  activeCompatibilityMatrix = matrix;
};

export const isSocketTypeCompatibleWithMatrix = (
  matrix: SocketTypeCompatibilityMatrix,
  fromType: SocketTypeId,
  toType: SocketTypeId,
): boolean => {
  if (fromType === toType) {
    return true;
  }
  return matrix.byFromType.get(fromType)?.has(toType) ?? false;
};

export const isSocketTypeCompatible = (
  fromType: SocketTypeId,
  toType: SocketTypeId,
): boolean =>
  isSocketTypeCompatibleWithMatrix(activeCompatibilityMatrix, fromType, toType);
