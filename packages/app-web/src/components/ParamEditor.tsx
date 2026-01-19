import * as NumberField from "@kobalte/core/number-field";
import * as Switch from "@kobalte/core/switch";
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
  const paramField = "flex flex-col gap-2";
  const paramLabel =
    "text-[0.7rem] uppercase tracking-[0.1em] text-[color:var(--text-muted)]";
  const paramInputBase =
    "w-full rounded-lg border border-[color:var(--border-muted)] bg-[color:var(--surface-panel-soft)] px-[0.6rem] py-[0.45rem] text-[0.85rem] text-[color:var(--text-soft)]";
  const paramSwitchRow =
    "flex items-center justify-between gap-2 rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-panel-soft)] px-[0.6rem] py-[0.4rem]";
  const paramSwitchText = "text-[0.8rem] text-[color:var(--text-soft)]";
  const paramVector =
    "grid grid-cols-[repeat(auto-fit,minmax(70px,1fr))] gap-2";
  const paramVectorItem = "grid gap-1";
  const paramVectorLabel =
    "text-[0.65rem] uppercase tracking-[0.14em] text-[color:var(--text-muted)]";

  const renderNumberField = (
    field: Extract<ParamFieldDefinition, { kind: "float" | "int" }>,
  ) => {
    const value = getNumberParam(props.node, field);
    const step = field.step ?? (field.kind === "int" ? 1 : 0.01);
    return (
      <div class={paramField}>
        <div class={paramLabel}>{field.label}</div>
        <NumberField.Root
          class="w-full"
          rawValue={value}
          minValue={field.min}
          maxValue={field.max}
          step={step}
          onRawValueChange={(next) => {
            const clamped = clampNumber(next, field.min, field.max);
            const normalized =
              field.kind === "int" ? Math.round(clamped) : clamped;
            props.onParamChange(field.id, normalized);
          }}
        >
          <NumberField.Input class={paramInputBase} />
        </NumberField.Root>
      </div>
    );
  };

  const renderBoolField = (
    field: Extract<ParamFieldDefinition, { kind: "bool" }>,
  ) => {
    const checked = getBoolParam(props.node, field);
    return (
      <div class={paramField}>
        <div class={paramLabel}>{field.label}</div>
        <div class={paramSwitchRow}>
          <span class={paramSwitchText}>
            {checked ? "Enabled" : "Disabled"}
          </span>
          <Switch.Root
            class="relative h-6 w-11"
            checked={checked}
            onChange={(next) => props.onParamChange(field.id, next)}
          >
            <Switch.Input />
            <Switch.Control class="absolute inset-0 rounded-full border border-[color:var(--border-muted)] bg-[color:var(--surface-panel-soft)] transition-colors duration-200 data-[checked]:border-[color:var(--status-info-border)] data-[checked]:bg-[color:var(--status-info-bg)]">
              <Switch.Thumb class="absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-[color:var(--text-soft)] transition-transform duration-200 data-[checked]:translate-x-[20px] data-[checked]:bg-[color:var(--text-strong)]" />
            </Switch.Control>
          </Switch.Root>
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
      <div class={paramField}>
        <div class={paramLabel}>{field.label}</div>
        <div class={paramVector}>
          {Array.from({ length: size }).map((_, index) => (
            <label class={paramVectorItem}>
              <span class={paramVectorLabel}>{VECTOR_LABELS[index]}</span>
              <NumberField.Root
                class="w-full"
                rawValue={value[index] ?? 0}
                minValue={field.min}
                maxValue={field.max}
                step={step}
                onRawValueChange={(next) => {
                  const clamped = clampNumber(next, field.min, field.max);
                  const updated = [...value] as number[];
                  updated[index] = clamped;
                  props.onParamChange(field.id, updated);
                }}
              >
                <NumberField.Input class={`${paramInputBase} text-center`} />
              </NumberField.Root>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div class="flex flex-col gap-[0.85rem]">
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
