import * as NumberField from "@kobalte/core/number-field";
import * as Switch from "@kobalte/core/switch";
import type { GraphNode, NodeId } from "@shadr/graph-core";
import type {
  ParamFieldDefinition,
  ParamSchemaDefinition,
  Vec2,
  Vec3,
  Vec4,
} from "@shadr/plugin-system";
import type { JsonObject, JsonValue } from "@shadr/shared";
import { For } from "solid-js";

type OverrideNodeEntry = Readonly<{
  node: GraphNode;
  label: string;
  schema: ParamSchemaDefinition;
  overrides?: JsonObject;
}>;

/* eslint-disable no-unused-vars -- prop function types keep named args for clarity */
type SubgraphParamOverridesProps = Readonly<{
  nodes: ReadonlyArray<OverrideNodeEntry>;
  onOverrideChange: (nodeId: NodeId, fieldId: string, value: JsonValue) => void;
  onOverrideReset: (nodeId: NodeId, fieldId: string) => void;
}>;
/* eslint-enable no-unused-vars */

const isNumberArray = (value: JsonValue | undefined): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "number");

const isValueEqual = (left: JsonValue, right: JsonValue): boolean => {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((entry, index) => entry === right[index]);
  }
  return false;
};

const clampNumber = (value: number, min?: number, max?: number): number => {
  if (min != null && value < min) {
    return min;
  }
  if (max != null && value > max) {
    return max;
  }
  return value;
};

const getBaseNumber = (
  node: GraphNode,
  field: Extract<ParamFieldDefinition, { kind: "float" | "int" }>,
): number => {
  const raw = node.params[field.id];
  if (typeof raw === "number") {
    return raw;
  }
  return field.defaultValue;
};

const getBaseBool = (
  node: GraphNode,
  field: Extract<ParamFieldDefinition, { kind: "bool" }>,
): boolean => {
  const raw = node.params[field.id];
  if (typeof raw === "boolean") {
    return raw;
  }
  return field.defaultValue;
};

const getBaseVec = (
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

const formatValue = (value: JsonValue): string => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => String(entry)).join(", ")}]`;
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return "None";
};

const VECTOR_LABELS = ["X", "Y", "Z", "W"];

export default function SubgraphParamOverrides(
  props: SubgraphParamOverridesProps,
) {
  const sectionRoot = "flex flex-col gap-3";
  const nodePanel =
    "flex flex-col gap-2 rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-panel)] px-2.5 py-2";
  const nodeHeader = "flex items-center justify-between gap-2";
  const nodeLabel =
    "text-[0.7rem] uppercase tracking-[0.2em] text-[color:var(--text-muted)]";
  const nodeName = "text-[0.85rem] text-[color:var(--text-strong)]";
  const nodeChipBase =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.18em]";
  const nodeChipMuted =
    "border-[color:var(--border-muted)] bg-[color:var(--surface-panel-soft)] text-[color:var(--text-muted)]";
  const nodeChipActive =
    "border-[color:var(--status-warn-border)] bg-[color:var(--status-warn-bg)] text-[color:var(--status-warn-text)]";
  const fieldPanel =
    "flex flex-col gap-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-muted)] px-2 py-2";
  const fieldHeader = "flex items-center justify-between gap-2";
  const fieldLabel =
    "text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--text-muted)]";
  const fieldChipBase =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.18em]";
  const fieldChipDefault =
    "border-[color:var(--border-muted)] bg-[color:var(--surface-panel-soft)] text-[color:var(--text-muted)]";
  const fieldChipOverride =
    "border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)]";
  const resetButtonBase =
    "rounded-full border px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.18em] transition";
  const resetButtonActive =
    "border-[color:var(--status-warn-border)] bg-[color:var(--status-warn-bg)] text-[color:var(--status-warn-text)] hover:border-[color:var(--status-warn-border)]";
  const resetButtonDisabled =
    "cursor-not-allowed border-[color:var(--border-subtle)] bg-[color:var(--surface-panel-soft)] text-[color:var(--text-muted)]";
  const defaultValueLabel = "text-[0.6rem] text-[color:var(--text-muted)]";
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

  const renderFieldHeader = (
    nodeId: NodeId,
    field: ParamFieldDefinition,
    baseValue: JsonValue,
    overrideValue: JsonValue | undefined,
  ) => {
    const isOverridden =
      overrideValue !== undefined && !isValueEqual(overrideValue, baseValue);
    return (
      <div class={fieldHeader}>
        <span class={fieldLabel}>{field.label}</span>
        <div class="flex items-center gap-2">
          <span
            class={`${fieldChipBase} ${
              isOverridden ? fieldChipOverride : fieldChipDefault
            }`}
          >
            {isOverridden ? "Override" : "Default"}
          </span>
          <button
            class={`${resetButtonBase} ${
              isOverridden ? resetButtonActive : resetButtonDisabled
            }`}
            disabled={!isOverridden}
            onClick={() => props.onOverrideReset(nodeId, field.id)}
          >
            Reset
          </button>
        </div>
      </div>
    );
  };

  const renderNumberField = (
    node: GraphNode,
    overrides: JsonObject | undefined,
    field: Extract<ParamFieldDefinition, { kind: "float" | "int" }>,
  ) => {
    const baseValue = getBaseNumber(node, field);
    const overrideValue = overrides?.[field.id];
    const activeValue =
      typeof overrideValue === "number" &&
      !isValueEqual(overrideValue, baseValue)
        ? overrideValue
        : baseValue;
    const step = field.step ?? (field.kind === "int" ? 1 : 0.01);
    const commitValue = (next: number) => {
      const clamped = clampNumber(next, field.min, field.max);
      const normalized = field.kind === "int" ? Math.round(clamped) : clamped;
      if (isValueEqual(normalized, baseValue)) {
        props.onOverrideReset(node.id, field.id);
      } else {
        props.onOverrideChange(node.id, field.id, normalized);
      }
    };
    return (
      <div class={fieldPanel}>
        {renderFieldHeader(node.id, field, baseValue, overrideValue)}
        <NumberField.Root
          class="w-full"
          rawValue={activeValue}
          minValue={field.min}
          maxValue={field.max}
          step={step}
          onRawValueChange={commitValue}
        >
          <NumberField.Input class={paramInputBase} />
        </NumberField.Root>
        {overrideValue !== undefined ? (
          <div class={defaultValueLabel}>Default: {formatValue(baseValue)}</div>
        ) : null}
      </div>
    );
  };

  const renderBoolField = (
    node: GraphNode,
    overrides: JsonObject | undefined,
    field: Extract<ParamFieldDefinition, { kind: "bool" }>,
  ) => {
    const baseValue = getBaseBool(node, field);
    const overrideValue = overrides?.[field.id];
    const activeValue =
      typeof overrideValue === "boolean" &&
      !isValueEqual(overrideValue, baseValue)
        ? overrideValue
        : baseValue;
    return (
      <div class={fieldPanel}>
        {renderFieldHeader(node.id, field, baseValue, overrideValue)}
        <div class={paramSwitchRow}>
          <span class={paramSwitchText}>
            {activeValue ? "Enabled" : "Disabled"}
          </span>
          <Switch.Root
            class="relative h-6 w-11"
            checked={activeValue}
            onChange={(next) => {
              if (isValueEqual(next, baseValue)) {
                props.onOverrideReset(node.id, field.id);
              } else {
                props.onOverrideChange(node.id, field.id, next);
              }
            }}
          >
            <Switch.Input />
            <Switch.Control class="absolute inset-0 rounded-full border border-[color:var(--border-muted)] bg-[color:var(--surface-panel-soft)] transition-colors duration-200 data-[checked]:border-[color:var(--status-info-border)] data-[checked]:bg-[color:var(--status-info-bg)]">
              <Switch.Thumb class="absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-[color:var(--text-soft)] transition-transform duration-200 data-[checked]:translate-x-[20px] data-[checked]:bg-[color:var(--text-strong)]" />
            </Switch.Control>
          </Switch.Root>
        </div>
        {overrideValue !== undefined ? (
          <div class={defaultValueLabel}>Default: {formatValue(baseValue)}</div>
        ) : null}
      </div>
    );
  };

  const renderVectorField = (
    node: GraphNode,
    overrides: JsonObject | undefined,
    field: Extract<ParamFieldDefinition, { kind: "vec2" | "vec3" | "vec4" }>,
  ) => {
    const baseValue = getBaseVec(node, field);
    const overrideValue = overrides?.[field.id];
    const activeValue =
      isNumberArray(overrideValue) && !isValueEqual(overrideValue, baseValue)
        ? overrideValue
        : baseValue;
    const step = field.step ?? 0.01;
    const size = field.kind === "vec2" ? 2 : field.kind === "vec3" ? 3 : 4;
    return (
      <div class={fieldPanel}>
        {renderFieldHeader(node.id, field, baseValue, overrideValue)}
        <div class={paramVector}>
          {Array.from({ length: size }).map((_, index) => (
            <label class={paramVectorItem}>
              <span class={paramVectorLabel}>{VECTOR_LABELS[index]}</span>
              <NumberField.Root
                class="w-full"
                rawValue={activeValue[index] ?? 0}
                minValue={field.min}
                maxValue={field.max}
                step={step}
                onRawValueChange={(next) => {
                  const clamped = clampNumber(next, field.min, field.max);
                  const updated = [...activeValue] as number[];
                  updated[index] = clamped;
                  if (isValueEqual(updated, baseValue)) {
                    props.onOverrideReset(node.id, field.id);
                  } else {
                    props.onOverrideChange(node.id, field.id, updated);
                  }
                }}
              >
                <NumberField.Input class={`${paramInputBase} text-center`} />
              </NumberField.Root>
            </label>
          ))}
        </div>
        {overrideValue !== undefined ? (
          <div class={defaultValueLabel}>Default: {formatValue(baseValue)}</div>
        ) : null}
      </div>
    );
  };

  return (
    <div class={sectionRoot}>
      <For each={props.nodes}>
        {(entry) => {
          const overrideCount = entry.overrides
            ? Object.keys(entry.overrides).length
            : 0;
          return (
            <div class={nodePanel}>
              <div class={nodeHeader}>
                <div class="flex flex-col">
                  <span class={nodeLabel}>Node</span>
                  <span class={nodeName}>{entry.label}</span>
                </div>
                <span
                  class={`${nodeChipBase} ${
                    overrideCount > 0 ? nodeChipActive : nodeChipMuted
                  }`}
                >
                  {overrideCount} overrides
                </span>
              </div>
              <div class="flex flex-col gap-2">
                {entry.schema.fields.map((field) => {
                  switch (field.kind) {
                    case "float":
                    case "int":
                      return renderNumberField(
                        entry.node,
                        entry.overrides,
                        field,
                      );
                    case "bool":
                      return renderBoolField(
                        entry.node,
                        entry.overrides,
                        field,
                      );
                    case "vec2":
                    case "vec3":
                    case "vec4":
                      return renderVectorField(
                        entry.node,
                        entry.overrides,
                        field,
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
