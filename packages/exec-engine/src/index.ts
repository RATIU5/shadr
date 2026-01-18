import type {
  Graph,
  GraphError,
  GraphSocketDirection,
  NodeId,
  SocketId,
  WireId,
} from "@shadr/graph-core";
import { executionSubgraphByOutputSockets } from "@shadr/graph-core";
import type {
  NodeDefinition,
  NodeInputValues,
  NodeOutputValues,
  NodeParamValues,
  ParamValue,
} from "@shadr/plugin-system";
import type { JsonObject, JsonValue } from "@shadr/shared";
import { Effect } from "effect";

export type ExecEngineError =
  | {
      _tag: "MissingNodeDefinition";
      nodeId: NodeId;
      nodeType: string;
    }
  | {
      _tag: "DuplicateSocketKey";
      nodeId: NodeId;
      socketName: string;
      direction: GraphSocketDirection;
    }
  | {
      _tag: "UnknownSocketKey";
      nodeId: NodeId;
      socketName: string;
      direction: GraphSocketDirection;
      nodeType: string;
    }
  | {
      _tag: "MissingSocketForDefinition";
      nodeId: NodeId;
      socketName: string;
      direction: GraphSocketDirection;
      nodeType: string;
    }
  | {
      _tag: "MissingRequiredInput";
      nodeId: NodeId;
      socketId: SocketId;
      socketName: string;
    }
  | {
      _tag: "MultipleInputWires";
      nodeId: NodeId;
      socketId: SocketId;
      wireIds: ReadonlyArray<WireId>;
    }
  | {
      _tag: "NodeComputeFailed";
      nodeId: NodeId;
      nodeType: string;
      cause: unknown;
    };

export type ExecError = GraphError | ExecEngineError;

export type NodeRuntimeError = Extract<
  ExecEngineError,
  { _tag: "MissingRequiredInput" | "NodeComputeFailed" }
>;

export type NodeErrorState = ReadonlyArray<NodeRuntimeError>;

export type NodeDefinitionResolver = (
  // eslint-disable-next-line no-unused-vars
  nodeType: string,
) => NodeDefinition | undefined;

export type ExecState = {
  dirty: Set<NodeId>;
  outputCache: Map<NodeId, NodeOutputValues>;
  nodeErrors: Map<NodeId, NodeErrorState>;
};

export const createExecState = (): ExecState => ({
  dirty: new Set<NodeId>(),
  outputCache: new Map<NodeId, NodeOutputValues>(),
  nodeErrors: new Map<NodeId, NodeErrorState>(),
});

const fail = (error: ExecError): Effect.Effect<never, ExecError> =>
  Effect.fail(error);

const toParamValue = (value: JsonValue): ParamValue | null => {
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  if (
    (value.length === 2 || value.length === 3 || value.length === 4) &&
    value.every((entry) => typeof entry === "number")
  ) {
    return value as ParamValue;
  }
  return null;
};

const coerceParamValues = (params: JsonObject): NodeParamValues => {
  const coerced: Record<string, ParamValue> = {};
  for (const [key, value] of Object.entries(params)) {
    const parsed = toParamValue(value);
    if (parsed !== null) {
      coerced[key] = parsed;
    }
  }
  return coerced;
};

const createNullOutputs = (
  outputNames: ReadonlyArray<string>,
): NodeOutputValues => {
  const outputs: Record<string, JsonValue | null> = {};
  for (const name of outputNames) {
    outputs[name] = null;
  }
  return outputs;
};

export const getNodeErrors = (
  state: ExecState,
  nodeId: NodeId,
): NodeErrorState => state.nodeErrors.get(nodeId) ?? [];

export const evaluateSocket = (
  graph: Graph,
  socketId: SocketId,
  resolveNodeDefinition: NodeDefinitionResolver,
  state?: ExecState,
): Effect.Effect<JsonValue | null, ExecError> =>
  Effect.flatMap(
    executionSubgraphByOutputSockets(graph, [socketId]),
    (subgraph) =>
      Effect.gen(function* (_) {
        const execState = state ?? createExecState();
        const inputWireIndex = new Map<SocketId, WireId[]>();
        for (const wireId of subgraph.wires) {
          const wire = graph.wires.get(wireId);
          if (!wire) {
            return yield* _(fail({ _tag: "MissingWire", wireId }));
          }
          const toSocket = graph.sockets.get(wire.toSocketId);
          if (!toSocket) {
            return yield* _(
              fail({ _tag: "MissingSocket", socketId: wire.toSocketId }),
            );
          }
          if (toSocket.direction !== "input") {
            return yield* _(
              fail({
                _tag: "InvalidSocketDirection",
                socketId: toSocket.id,
                expected: "input",
              }),
            );
          }
          const list = inputWireIndex.get(wire.toSocketId);
          if (list) {
            list.push(wireId);
          } else {
            inputWireIndex.set(wire.toSocketId, [wireId]);
          }
        }

        const outputCache = execState.outputCache;

        const validateNodeSockets = (
          nodeId: NodeId,
          nodeType: string,
          nodeSocketIds: ReadonlyArray<SocketId>,
          direction: GraphSocketDirection,
          expectedKeys: ReadonlySet<string>,
        ): Effect.Effect<ReadonlyArray<string>, ExecError> =>
          Effect.gen(function* (__) {
            const names: string[] = [];
            const seen = new Set<string>();
            for (const socketId of nodeSocketIds) {
              const socket = graph.sockets.get(socketId);
              if (!socket) {
                return yield* __(fail({ _tag: "MissingSocket", socketId }));
              }
              if (socket.direction !== direction) {
                return yield* __(
                  fail({
                    _tag: "InvalidSocketDirection",
                    socketId: socket.id,
                    expected: direction,
                  }),
                );
              }
              if (seen.has(socket.name)) {
                return yield* __(
                  fail({
                    _tag: "DuplicateSocketKey",
                    nodeId,
                    socketName: socket.name,
                    direction,
                  }),
                );
              }
              if (!expectedKeys.has(socket.name)) {
                return yield* __(
                  fail({
                    _tag: "UnknownSocketKey",
                    nodeId,
                    socketName: socket.name,
                    direction,
                    nodeType,
                  }),
                );
              }
              seen.add(socket.name);
              names.push(socket.name);
            }

            for (const key of expectedKeys) {
              if (!seen.has(key)) {
                return yield* __(
                  fail({
                    _tag: "MissingSocketForDefinition",
                    nodeId,
                    socketName: key,
                    direction,
                    nodeType,
                  }),
                );
              }
            }

            return names;
          });

        const evaluateNode = (
          nodeId: NodeId,
        ): Effect.Effect<NodeOutputValues, ExecError> =>
          Effect.suspend(() => {
            const cached = outputCache.get(nodeId);
            if (cached && !execState.dirty.has(nodeId)) {
              return Effect.succeed(cached);
            }

            return Effect.gen(function* (__) {
              const node = graph.nodes.get(nodeId);
              if (!node) {
                return yield* __(fail({ _tag: "MissingNode", nodeId }));
              }
              if (!subgraph.nodes.has(nodeId)) {
                return yield* __(fail({ _tag: "MissingNode", nodeId }));
              }

              const definition = resolveNodeDefinition(node.type);
              if (!definition) {
                return yield* __(
                  fail({
                    _tag: "MissingNodeDefinition",
                    nodeId,
                    nodeType: node.type,
                  }),
                );
              }

              const inputKeys = new Set(
                definition.inputs.map((input) => input.key),
              );
              const outputKeys = new Set(
                definition.outputs.map((output) => output.key),
              );

              const inputNames = yield* __(
                validateNodeSockets(
                  nodeId,
                  definition.typeId,
                  node.inputs,
                  "input",
                  inputKeys,
                ),
              );
              const outputNames = yield* __(
                validateNodeSockets(
                  nodeId,
                  definition.typeId,
                  node.outputs,
                  "output",
                  outputKeys,
                ),
              );

              const inputs: Record<string, JsonValue | null> = {};
              const missingRequired: NodeRuntimeError[] = [];
              for (const [index, socketId] of node.inputs.entries()) {
                const socket = graph.sockets.get(socketId);
                if (!socket) {
                  return yield* __(fail({ _tag: "MissingSocket", socketId }));
                }
                const name = inputNames[index];
                if (!name) {
                  return yield* __(
                    fail({
                      _tag: "UnknownSocketKey",
                      nodeId,
                      socketName: socket.name,
                      direction: "input",
                      nodeType: definition.typeId,
                    }),
                  );
                }

                const wireIds = inputWireIndex.get(socketId) ?? [];
                if (wireIds.length > 1) {
                  return yield* __(
                    fail({
                      _tag: "MultipleInputWires",
                      nodeId,
                      socketId,
                      wireIds: [...wireIds].sort((left, right) =>
                        left.localeCompare(right),
                      ),
                    }),
                  );
                }

                if (wireIds.length === 0) {
                  if (socket.defaultValue !== undefined) {
                    inputs[name] = socket.defaultValue;
                    continue;
                  }
                  if (socket.required) {
                    missingRequired.push({
                      _tag: "MissingRequiredInput",
                      nodeId,
                      socketId,
                      socketName: name,
                    });
                  }
                  inputs[name] = null;
                  continue;
                }

                const wireId = wireIds[0];
                const wire = graph.wires.get(wireId);
                if (!wire) {
                  return yield* __(fail({ _tag: "MissingWire", wireId }));
                }
                const fromSocket = graph.sockets.get(wire.fromSocketId);
                if (!fromSocket) {
                  return yield* __(
                    fail({
                      _tag: "MissingSocket",
                      socketId: wire.fromSocketId,
                    }),
                  );
                }
                if (fromSocket.direction !== "output") {
                  return yield* __(
                    fail({
                      _tag: "InvalidSocketDirection",
                      socketId: fromSocket.id,
                      expected: "output",
                    }),
                  );
                }
                if (!subgraph.nodes.has(fromSocket.nodeId)) {
                  return yield* __(
                    fail({ _tag: "MissingNode", nodeId: fromSocket.nodeId }),
                  );
                }
                const value = yield* __(evaluateOutputSocket(fromSocket.id));
                inputs[name] = value;
              }

              if (missingRequired.length > 0) {
                const nullOutputs = createNullOutputs(outputNames);
                outputCache.set(nodeId, nullOutputs);
                execState.nodeErrors.set(nodeId, missingRequired);
                execState.dirty.delete(nodeId);
                return nullOutputs;
              }

              const params = coerceParamValues(node.params);
              const nodeInputs: NodeInputValues = inputs;
              let outputs: NodeOutputValues;
              try {
                outputs = definition.compute(nodeInputs, params, { nodeId });
              } catch (cause) {
                const nullOutputs = createNullOutputs(outputNames);
                execState.nodeErrors.set(nodeId, [
                  {
                    _tag: "NodeComputeFailed",
                    nodeId,
                    nodeType: definition.typeId,
                    cause,
                  },
                ]);
                outputCache.set(nodeId, nullOutputs);
                execState.dirty.delete(nodeId);
                return nullOutputs;
              }

              const normalized: Record<string, JsonValue | null> = {};
              for (const [index, socketId] of node.outputs.entries()) {
                const socket = graph.sockets.get(socketId);
                if (!socket) {
                  return yield* __(fail({ _tag: "MissingSocket", socketId }));
                }
                const name = outputNames[index];
                if (!name) {
                  return yield* __(
                    fail({
                      _tag: "UnknownSocketKey",
                      nodeId,
                      socketName: socket.name,
                      direction: "output",
                      nodeType: definition.typeId,
                    }),
                  );
                }
                const value = outputs[name];
                normalized[name] = value === undefined ? null : value;
              }

              execState.nodeErrors.delete(nodeId);
              outputCache.set(nodeId, normalized);
              execState.dirty.delete(nodeId);
              return normalized;
            });
          });

        const evaluateOutputSocket = (
          targetSocketId: SocketId,
        ): Effect.Effect<JsonValue | null, ExecError> =>
          Effect.gen(function* (__) {
            const socket = graph.sockets.get(targetSocketId);
            if (!socket) {
              return yield* __(
                fail({ _tag: "MissingSocket", socketId: targetSocketId }),
              );
            }
            if (socket.direction !== "output") {
              return yield* __(
                fail({
                  _tag: "InvalidSocketDirection",
                  socketId: socket.id,
                  expected: "output",
                }),
              );
            }
            const outputs = yield* __(evaluateNode(socket.nodeId));
            return outputs[socket.name] ?? null;
          });

        return yield* _(evaluateOutputSocket(socketId));
      }),
  );

export type DirtyState = ExecState;

export const createDirtyState = (): DirtyState => createExecState();

const collectDownstream = (graph: Graph, start: NodeId): Set<NodeId> => {
  const visited = new Set<NodeId>();
  const stack: NodeId[] = [start];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);
    const targets = graph.outgoing.get(current);
    if (!targets) {
      continue;
    }

    for (const target of targets) {
      stack.push(target);
    }
  }

  return visited;
};

export const markDirty = (
  graph: Graph,
  state: ExecState,
  nodeId: NodeId,
): ExecState => {
  const dirty = new Set(state.dirty);
  for (const target of collectDownstream(graph, nodeId)) {
    dirty.add(target);
  }
  return {
    dirty,
    outputCache: state.outputCache,
    nodeErrors: state.nodeErrors,
  };
};

export const clearDirty = (
  state: ExecState,
  nodeIds: Iterable<NodeId>,
): ExecState => {
  const dirty = new Set(state.dirty);
  for (const nodeId of nodeIds) {
    dirty.delete(nodeId);
  }
  return {
    dirty,
    outputCache: state.outputCache,
    nodeErrors: state.nodeErrors,
  };
};

export const isDirty = (state: ExecState, nodeId: NodeId): boolean =>
  state.dirty.has(nodeId);

export const markDirtyForParamChange = (
  graph: Graph,
  state: ExecState,
  nodeId: NodeId,
): ExecState => markDirty(graph, state, nodeId);

export const markDirtyForWireChange = (
  graph: Graph,
  state: ExecState,
  wireId: WireId,
): Effect.Effect<ExecState, ExecError> =>
  Effect.gen(function* (_) {
    const wire = graph.wires.get(wireId);
    if (!wire) {
      return yield* _(fail({ _tag: "MissingWire", wireId }));
    }
    const toSocket = graph.sockets.get(wire.toSocketId);
    if (!toSocket) {
      return yield* _(
        fail({ _tag: "MissingSocket", socketId: wire.toSocketId }),
      );
    }
    return markDirty(graph, state, toSocket.nodeId);
  });
