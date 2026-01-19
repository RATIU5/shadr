import type { JsonValue } from "@shadr/shared";

export type DebugEventKind =
  | "graph"
  | "execution"
  | "selection"
  | "watch"
  | "system";

export type DebugEvent = Readonly<{
  id: number;
  timestamp: number;
  kind: DebugEventKind;
  label: string;
  detail?: string;
  payload?: JsonValue;
}>;
