import type { SocketTypeId } from "@shadr/shared";

import type { NodeTypeId, ParamSchemaId, PluginId } from "./types.js";

export type NodeDefinitionIssue =
  | { _tag: "DuplicateInputKey"; key: string }
  | { _tag: "DuplicateOutputKey"; key: string }
  | { _tag: "InputOutputKeyCollision"; key: string }
  | {
      _tag: "UnknownSocketType";
      socketKey: string;
      socketTypeId: SocketTypeId;
    }
  | { _tag: "UnknownParamSchema"; schemaId: ParamSchemaId };

export type PluginRegistryError =
  | { _tag: "DuplicatePlugin"; pluginId: PluginId }
  | { _tag: "UnknownPlugin"; pluginId: PluginId }
  | { _tag: "DuplicateNodeDefinition"; nodeType: NodeTypeId }
  | {
      _tag: "InvalidNodeDefinition";
      nodeType: NodeTypeId;
      issue: NodeDefinitionIssue;
    }
  | { _tag: "DuplicateSocketType"; socketTypeId: SocketTypeId }
  | { _tag: "DuplicateParamSchema"; schemaId: ParamSchemaId }
  | { _tag: "PluginInitFailed"; pluginId: PluginId; cause: unknown }
  | { _tag: "PluginDestroyFailed"; pluginId: PluginId; cause: unknown }
  | { _tag: "PluginOwnershipMismatch"; pluginId: PluginId };
