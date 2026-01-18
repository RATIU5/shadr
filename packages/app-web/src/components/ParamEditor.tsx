import { NumberField, Switch } from "@kobalte/core";
import type { GraphNode } from "@shadr/graph-core";
import type {
  ParamFieldDefinition,
  ParamSchemaDefinition,
  Vec2,
  Vec3,
  Vec4,
} from "@shadr/plugin-system";
import type { JsonValue } from "@shadr/shared";

/* eslint-disable no-unused-vars */
type ParamEditorProps = Readonly<{
  node: GraphNode;
  schema: ParamSchemaDefinition;
  onParamChange: (key: string, value: JsonValue) => void;
}>;
/* eslint-enable no-unused-vars */

const isNumberArray = (value: JsonValue | undefined): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "number");

const clampNumber = (value: number, min?: number, max?: number): number => {
  if (min != null && value < min) {
    return min;
  }
  if (max != null && value > max) {
    return max;
  }
  return value;
};

const getNumberParam = (
  node: GraphNode,
  field: Extract<ParamFieldDefinition, { kind: "float" | "int" }>,
): number => {
  const raw = node.params[field.id];
  if (typeof raw === "number") {
    return raw;
  }
  return field.defaultValue;
};

const getBoolParam = (
  node: GraphNode,
  field: Extract<ParamFieldDefinition, { kind: "bool" }>,
): boolean => {
  const raw = node.params[field.id];
  if (typeof raw === "boolean") {
    return raw;
  }
  return field.defaultValue;
};

const getVecParam = (
  node: GraphNode,
  field: Extract<ParamFieldDefinition, { kind: "vec2" | "vec3" | "vec4" }>,
): Vec2 | Vec3 | Vec4 => {
  const raw = node.params[field.id];
  if (isNumberArray(raw)) {
    if (field.kind === "vec2" && raw.length >= 2) {
      return [raw[0], raw[1]];
    }
    if (field.kind === "vec3" && raw.length >= 3) {
      return [raw[0], raw[1], raw[2]];
    }
    if (field.kind === "vec4" && raw.length >= 4) {
      return [raw[0], raw[1], raw[2], raw[3]];
    }
  }
  return field.defaultValue;
};

const VECTOR_LABELS = ["X", "Y", "Z", "W"];

export default function ParamEditor(props: ParamEditorProps) {
  const renderNumberField = (
    field: Extract<ParamFieldDefinition, { kind: "float" | "int" }>,
  ) => {
    const value = getNumberParam(props.node, field);
    const step = field.step ?? (field.kind === "int" ? 1 : 0.01);
    return (
      <div class="param-field">
        <div class="param-label">{field.label}</div>
        <NumberField
          class="param-input"
          value={value}
          min={field.min}
          max={field.max}
          step={step}
          onChange={(next) => {
            const clamped = clampNumber(next, field.min, field.max);
            const normalized =
              field.kind === "int" ? Math.round(clamped) : clamped;
            props.onParamChange(field.id, normalized);
          }}
        />
      </div>
    );
  };

  const renderBoolField = (
    field: Extract<ParamFieldDefinition, { kind: "bool" }>,
  ) => {
    const checked = getBoolParam(props.node, field);
    return (
      <div class="param-field">
        <div class="param-label">{field.label}</div>
        <div class="param-switch-row">
          <span class="param-switch-text">
            {checked ? "Enabled" : "Disabled"}
          </span>
          <label class="param-switch">
            <Switch
              class="param-switch-input"
              checked={checked}
              onChange={(next) => props.onParamChange(field.id, next)}
            />
            <span class="param-switch-track">
              <span class="param-switch-thumb" />
            </span>
          </label>
        </div>
      </div>
    );
  };

  const renderVectorField = (
    field: Extract<ParamFieldDefinition, { kind: "vec2" | "vec3" | "vec4" }>,
  ) => {
    const value = getVecParam(props.node, field);
    const step = field.step ?? 0.01;
    const size = field.kind === "vec2" ? 2 : field.kind === "vec3" ? 3 : 4;
    return (
      <div class="param-field">
        <div class="param-label">{field.label}</div>
        <div class="param-vector">
          {Array.from({ length: size }).map((_, index) => (
            <label class="param-vector-item">
              <span class="param-vector-label">{VECTOR_LABELS[index]}</span>
              <NumberField
                class="param-input param-input-small"
                value={value[index] ?? 0}
                min={field.min}
                max={field.max}
                step={step}
                onChange={(next) => {
                  const clamped = clampNumber(next, field.min, field.max);
                  const updated = [...value] as number[];
                  updated[index] = clamped;
                  props.onParamChange(field.id, updated);
                }}
              />
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div class="param-section">
      {props.schema.fields.map((field) => {
        switch (field.kind) {
          case "float":
          case "int":
            return renderNumberField(field);
          case "bool":
            return renderBoolField(field);
          case "vec2":
          case "vec3":
          case "vec4":
            return renderVectorField(field);
          default:
            return null;
        }
      })}
    </div>
  );
}
