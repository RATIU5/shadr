/* eslint-disable no-unused-vars */
import type {
  GraphSocketLabelSettings,
  GraphSocketMetadata,
  JsonValue,
  NodeId,
  SocketTypeId,
} from "@shadr/shared";
import type { Effect } from "effect";

export type PluginId = string;
export type NodeTypeId = string;
export type ParamSchemaId = string;
export type ParamFieldId = string;

export type EventMap = Record<string, unknown>;

export type PluginMessageBus<Events extends EventMap = EventMap> = Readonly<{
  publish: <EventKey extends keyof Events>(
    event: EventKey,
    payload: Events[EventKey],
  ) => Effect.Effect<void>;
  publishDeferred: <EventKey extends keyof Events>(
    event: EventKey,
    payload: Events[EventKey],
  ) => Effect.Effect<void>;
  subscribe: <EventKey extends keyof Events>(
    event: EventKey,
    handler: (payload: Events[EventKey]) => Effect.Effect<void>,
  ) => Effect.Effect<() => void>;
  subscribeDeferred: <EventKey extends keyof Events>(
    event: EventKey,
    handler: (payload: Events[EventKey]) => Effect.Effect<void>,
  ) => Effect.Effect<() => void>;
  flushDeferred: () => Effect.Effect<void>;
}>;

export type PluginGraphApi<Graph, GraphError> = Readonly<{
  getGraph: () => Effect.Effect<Graph, GraphError>;
  updateGraph: (
    updater: (graph: Graph) => Effect.Effect<Graph, GraphError>,
  ) => Effect.Effect<Graph, GraphError>;
}>;

export type PluginContext<
  Events extends EventMap,
  Graph,
  GraphError,
> = Readonly<{
  bus: PluginMessageBus<Events>;
  graph: PluginGraphApi<Graph, GraphError>;
}>;

export type NodeSocketBase = Readonly<{
  key: string;
  label: string;
  dataType: SocketTypeId;
  isOptional?: boolean;
  minConnections?: number;
  maxConnections?: number;
  labelSettings?: GraphSocketLabelSettings;
  metadata?: GraphSocketMetadata;
}>;

export type NodeInputDefinition = NodeSocketBase &
  Readonly<{
    direction: "input";
  }>;

export type NodeOutputDefinition = NodeSocketBase &
  Readonly<{
    direction: "output";
  }>;

export type NodeComputeContext = Readonly<{
  nodeId: NodeId;
}>;

export type NodeInputValues = Readonly<Record<string, JsonValue | null>>;
export type NodeOutputValues = Readonly<Record<string, JsonValue | null>>;
export type NodeParamValues = Readonly<Record<string, ParamValue>>;

export type NodeCompute = (
  inputs: NodeInputValues,
  params: NodeParamValues,
  context: NodeComputeContext,
) => NodeOutputValues;

export type NodeDefinition = Readonly<{
  typeId: NodeTypeId;
  label: string;
  description: string;
  category?: string;
  inputs: ReadonlyArray<NodeInputDefinition>;
  outputs: ReadonlyArray<NodeOutputDefinition>;
  paramSchemaId?: ParamSchemaId;
  compute: NodeCompute;
}>;

export type SocketTypeDefinition = Readonly<{
  id: SocketTypeId;
  label: string;
  description: string;
  color: string;
  isPrimitive: boolean;
}>;

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type Vec4 = readonly [number, number, number, number];

export type ParamValue = number | boolean | Vec2 | Vec3 | Vec4;

type ParamFieldBase<Type extends string, Value> = Readonly<{
  id: ParamFieldId;
  label: string;
  description?: string;
  kind: Type;
  defaultValue: Value;
}>;

export type FloatParamField = ParamFieldBase<"float", number> &
  Readonly<{
    min?: number;
    max?: number;
    step?: number;
  }>;

export type IntParamField = ParamFieldBase<"int", number> &
  Readonly<{
    min?: number;
    max?: number;
    step?: number;
  }>;

export type BoolParamField = ParamFieldBase<"bool", boolean>;

export type Vec2ParamField = ParamFieldBase<"vec2", Vec2> &
  Readonly<{
    min?: number;
    max?: number;
    step?: number;
  }>;

export type Vec3ParamField = ParamFieldBase<"vec3", Vec3> &
  Readonly<{
    min?: number;
    max?: number;
    step?: number;
  }>;

export type Vec4ParamField = ParamFieldBase<"vec4", Vec4> &
  Readonly<{
    min?: number;
    max?: number;
    step?: number;
  }>;

export type ParamFieldDefinition =
  | FloatParamField
  | IntParamField
  | BoolParamField
  | Vec2ParamField
  | Vec3ParamField
  | Vec4ParamField;

export type ParamSchemaDefinition = Readonly<{
  id: ParamSchemaId;
  label: string;
  fields: ReadonlyArray<ParamFieldDefinition>;
}>;

export type PluginDefinition<
  Events extends EventMap,
  Graph,
  GraphError,
> = Readonly<{
  id: PluginId;
  name: string;
  version: string;
  description?: string;
  nodes?: ReadonlyArray<NodeDefinition>;
  socketTypes?: ReadonlyArray<SocketTypeDefinition>;
  paramSchemas?: ReadonlyArray<ParamSchemaDefinition>;
  init?: (
    context: PluginContext<Events, Graph, GraphError>,
  ) => Effect.Effect<void, unknown>;
  destroy?: (
    context: PluginContext<Events, Graph, GraphError>,
  ) => Effect.Effect<void, unknown>;
}>;
