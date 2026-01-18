import type { SocketTypeId } from "@shadr/shared";
import { isPrimitiveSocketType } from "@shadr/shared";
import { Effect } from "effect";

import type { NodeDefinitionIssue, PluginRegistryError } from "./errors.js";
import type {
  EventMap,
  NodeDefinition,
  NodeTypeId,
  ParamSchemaDefinition,
  ParamSchemaId,
  PluginContext,
  PluginDefinition,
  PluginId,
  SocketTypeDefinition,
} from "./types.js";

type PluginRegistration<Events extends EventMap, Graph, GraphError> = Readonly<{
  plugin: PluginDefinition<Events, Graph, GraphError>;
  nodeDefinitionIds: ReadonlyArray<NodeTypeId>;
  socketTypeIds: ReadonlyArray<SocketTypeId>;
  paramSchemaIds: ReadonlyArray<ParamSchemaId>;
}>;

const fail = (
  error: PluginRegistryError,
): Effect.Effect<never, PluginRegistryError> => Effect.fail(error);

const pluginInitFailed = (
  pluginId: PluginId,
  cause: unknown,
): PluginRegistryError => ({
  _tag: "PluginInitFailed",
  pluginId,
  cause,
});

const pluginDestroyFailed = (
  pluginId: PluginId,
  cause: unknown,
): PluginRegistryError => ({
  _tag: "PluginDestroyFailed",
  pluginId,
  cause,
});

const findDuplicate = <T>(items: ReadonlyArray<T>): T | undefined => {
  const seen = new Set<T>();
  for (const item of items) {
    if (seen.has(item)) {
      return item;
    }
    seen.add(item);
  }
  return undefined;
};

const invalidNodeDefinition = (
  nodeType: NodeTypeId,
  issue: NodeDefinitionIssue,
): PluginRegistryError => ({
  _tag: "InvalidNodeDefinition",
  nodeType,
  issue,
});

const validateSocketKey = (
  nodeType: NodeTypeId,
  issue: NodeDefinitionIssue,
): PluginRegistryError => invalidNodeDefinition(nodeType, issue);

const validateNodeDefinition = (
  node: NodeDefinition,
  knownSocketTypes: ReadonlySet<SocketTypeId>,
  knownParamSchemas: ReadonlySet<ParamSchemaId>,
): PluginRegistryError | null => {
  const inputKeys = new Set<string>();
  for (const input of node.inputs) {
    if (inputKeys.has(input.key)) {
      return validateSocketKey(node.typeId, {
        _tag: "DuplicateInputKey",
        key: input.key,
      });
    }
    inputKeys.add(input.key);
  }

  const outputKeys = new Set<string>();
  for (const output of node.outputs) {
    if (outputKeys.has(output.key)) {
      return validateSocketKey(node.typeId, {
        _tag: "DuplicateOutputKey",
        key: output.key,
      });
    }
    if (inputKeys.has(output.key)) {
      return validateSocketKey(node.typeId, {
        _tag: "InputOutputKeyCollision",
        key: output.key,
      });
    }
    outputKeys.add(output.key);
  }

  for (const socket of [...node.inputs, ...node.outputs]) {
    if (isPrimitiveSocketType(socket.dataType)) {
      continue;
    }
    if (!knownSocketTypes.has(socket.dataType)) {
      return invalidNodeDefinition(node.typeId, {
        _tag: "UnknownSocketType",
        socketKey: socket.key,
        socketTypeId: socket.dataType,
      });
    }
  }

  if (node.paramSchemaId && !knownParamSchemas.has(node.paramSchemaId)) {
    return invalidNodeDefinition(node.typeId, {
      _tag: "UnknownParamSchema",
      schemaId: node.paramSchemaId,
    });
  }

  return null;
};

export class PluginRegistry<
  Events extends EventMap = EventMap,
  Graph = unknown,
  GraphError = unknown,
> {
  private readonly plugins = new Map<
    PluginId,
    PluginDefinition<Events, Graph, GraphError>
  >();
  private readonly nodeDefinitions = new Map<NodeTypeId, NodeDefinition>();
  private readonly socketTypes = new Map<SocketTypeId, SocketTypeDefinition>();
  private readonly paramSchemas = new Map<
    ParamSchemaId,
    ParamSchemaDefinition
  >();
  private readonly pluginIndex = new Map<
    PluginId,
    PluginRegistration<Events, Graph, GraphError>
  >();

  registerPlugin(
    plugin: PluginDefinition<Events, Graph, GraphError>,
    context: PluginContext<Events, Graph, GraphError>,
  ): Effect.Effect<void, PluginRegistryError> {
    return Effect.flatMap(this.validatePlugin(plugin), () => {
      this.applyRegistration(plugin);
      if (!plugin.init) {
        return Effect.void;
      }
      return Effect.catchAll(
        Effect.mapError(plugin.init(context), (cause) =>
          pluginInitFailed(plugin.id, cause),
        ),
        (error) => {
          this.rollbackRegistration(plugin.id);
          return Effect.fail(error);
        },
      );
    });
  }

  unregisterPlugin(
    pluginId: PluginId,
    context: PluginContext<Events, Graph, GraphError>,
  ): Effect.Effect<void, PluginRegistryError> {
    const registration = this.pluginIndex.get(pluginId);
    if (!registration) {
      return fail({ _tag: "UnknownPlugin", pluginId });
    }

    const plugin = registration.plugin;
    if (!plugin.destroy) {
      this.rollbackRegistration(pluginId);
      return Effect.void;
    }

    return Effect.catchAll(
      Effect.mapError(plugin.destroy(context), (cause) =>
        pluginDestroyFailed(pluginId, cause),
      ),
      (error) => Effect.fail(error),
    ).pipe(
      Effect.tap(() => Effect.sync(() => this.rollbackRegistration(pluginId))),
      Effect.asVoid,
    );
  }

  registerNodeDefinition(
    definition: NodeDefinition,
    ownerPluginId?: PluginId,
  ): Effect.Effect<void, PluginRegistryError> {
    if (this.nodeDefinitions.has(definition.typeId)) {
      return fail({
        _tag: "DuplicateNodeDefinition",
        nodeType: definition.typeId,
      });
    }
    if (ownerPluginId && !this.plugins.has(ownerPluginId)) {
      return fail({ _tag: "PluginOwnershipMismatch", pluginId: ownerPluginId });
    }
    this.nodeDefinitions.set(definition.typeId, definition);
    return Effect.void;
  }

  registerSocketType(
    definition: SocketTypeDefinition,
    ownerPluginId?: PluginId,
  ): Effect.Effect<void, PluginRegistryError> {
    if (this.socketTypes.has(definition.id)) {
      return fail({
        _tag: "DuplicateSocketType",
        socketTypeId: definition.id,
      });
    }
    if (ownerPluginId && !this.plugins.has(ownerPluginId)) {
      return fail({ _tag: "PluginOwnershipMismatch", pluginId: ownerPluginId });
    }
    this.socketTypes.set(definition.id, definition);
    return Effect.void;
  }

  registerParamSchema(
    definition: ParamSchemaDefinition,
    ownerPluginId?: PluginId,
  ): Effect.Effect<void, PluginRegistryError> {
    if (this.paramSchemas.has(definition.id)) {
      return fail({
        _tag: "DuplicateParamSchema",
        schemaId: definition.id,
      });
    }
    if (ownerPluginId && !this.plugins.has(ownerPluginId)) {
      return fail({ _tag: "PluginOwnershipMismatch", pluginId: ownerPluginId });
    }
    this.paramSchemas.set(definition.id, definition);
    return Effect.void;
  }

  getPlugin(
    pluginId: PluginId,
  ): PluginDefinition<Events, Graph, GraphError> | undefined {
    return this.plugins.get(pluginId);
  }

  getNodeDefinition(nodeType: NodeTypeId): NodeDefinition | undefined {
    return this.nodeDefinitions.get(nodeType);
  }

  getSocketType(socketTypeId: SocketTypeId): SocketTypeDefinition | undefined {
    return this.socketTypes.get(socketTypeId);
  }

  getParamSchema(schemaId: ParamSchemaId): ParamSchemaDefinition | undefined {
    return this.paramSchemas.get(schemaId);
  }

  listPlugins(): ReadonlyArray<PluginDefinition<Events, Graph, GraphError>> {
    return [...this.plugins.values()];
  }

  listNodeDefinitions(): ReadonlyArray<NodeDefinition> {
    return [...this.nodeDefinitions.values()];
  }

  listSocketTypes(): ReadonlyArray<SocketTypeDefinition> {
    return [...this.socketTypes.values()];
  }

  listParamSchemas(): ReadonlyArray<ParamSchemaDefinition> {
    return [...this.paramSchemas.values()];
  }

  private validatePlugin(
    plugin: PluginDefinition<Events, Graph, GraphError>,
  ): Effect.Effect<void, PluginRegistryError> {
    if (this.plugins.has(plugin.id)) {
      return fail({ _tag: "DuplicatePlugin", pluginId: plugin.id });
    }

    const nodeIds = (plugin.nodes ?? []).map((node) => node.typeId);
    const socketTypeIds = (plugin.socketTypes ?? []).map((socket) => socket.id);
    const schemaIds = (plugin.paramSchemas ?? []).map((schema) => schema.id);

    const duplicateNodeId = findDuplicate(nodeIds);
    if (duplicateNodeId) {
      return fail({
        _tag: "DuplicateNodeDefinition",
        nodeType: duplicateNodeId,
      });
    }
    const duplicateSocketId = findDuplicate(socketTypeIds);
    if (duplicateSocketId) {
      return fail({
        _tag: "DuplicateSocketType",
        socketTypeId: duplicateSocketId,
      });
    }
    const duplicateSchemaId = findDuplicate(schemaIds);
    if (duplicateSchemaId) {
      return fail({
        _tag: "DuplicateParamSchema",
        schemaId: duplicateSchemaId,
      });
    }

    for (const nodeId of nodeIds) {
      if (this.nodeDefinitions.has(nodeId)) {
        return fail({ _tag: "DuplicateNodeDefinition", nodeType: nodeId });
      }
    }
    for (const socketTypeId of socketTypeIds) {
      if (this.socketTypes.has(socketTypeId)) {
        return fail({ _tag: "DuplicateSocketType", socketTypeId });
      }
    }
    for (const schemaId of schemaIds) {
      if (this.paramSchemas.has(schemaId)) {
        return fail({ _tag: "DuplicateParamSchema", schemaId });
      }
    }

    const knownSocketTypes = new Set<SocketTypeId>([
      ...this.socketTypes.keys(),
      ...socketTypeIds,
    ]);
    const knownParamSchemas = new Set<ParamSchemaId>([
      ...this.paramSchemas.keys(),
      ...schemaIds,
    ]);
    for (const node of plugin.nodes ?? []) {
      const error = validateNodeDefinition(
        node,
        knownSocketTypes,
        knownParamSchemas,
      );
      if (error) {
        return fail(error);
      }
    }

    return Effect.void;
  }

  private applyRegistration(
    plugin: PluginDefinition<Events, Graph, GraphError>,
  ): void {
    this.plugins.set(plugin.id, plugin);

    const nodeDefinitionIds: NodeTypeId[] = [];
    for (const node of plugin.nodes ?? []) {
      this.nodeDefinitions.set(node.typeId, node);
      nodeDefinitionIds.push(node.typeId);
    }

    const socketTypeIds: SocketTypeId[] = [];
    for (const socketType of plugin.socketTypes ?? []) {
      this.socketTypes.set(socketType.id, socketType);
      socketTypeIds.push(socketType.id);
    }

    const paramSchemaIds: ParamSchemaId[] = [];
    for (const schema of plugin.paramSchemas ?? []) {
      this.paramSchemas.set(schema.id, schema);
      paramSchemaIds.push(schema.id);
    }

    this.pluginIndex.set(plugin.id, {
      plugin,
      nodeDefinitionIds,
      socketTypeIds,
      paramSchemaIds,
    });
  }

  private rollbackRegistration(pluginId: PluginId): void {
    const registration = this.pluginIndex.get(pluginId);
    if (!registration) {
      return;
    }

    for (const nodeId of registration.nodeDefinitionIds) {
      this.nodeDefinitions.delete(nodeId);
    }
    for (const socketTypeId of registration.socketTypeIds) {
      this.socketTypes.delete(socketTypeId);
    }
    for (const schemaId of registration.paramSchemaIds) {
      this.paramSchemas.delete(schemaId);
    }

    this.pluginIndex.delete(pluginId);
    this.plugins.delete(pluginId);
  }
}

export const createPluginRegistry = <
  Events extends EventMap = EventMap,
  Graph = unknown,
  GraphError = unknown,
>(): PluginRegistry<Events, Graph, GraphError> =>
  new PluginRegistry<Events, Graph, GraphError>();
