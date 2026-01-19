import type {
  Graph,
  GraphError,
  GraphId,
  GraphSocketDirection,
  NodeId,
  SocketId,
  WireId,
} from "@shadr/graph-core";
import {
  executionSubgraphByOutputSockets,
  graphFromDocumentV1,
} from "@shadr/graph-core";
import type {
  NodeDefinition,
  NodeInputValues,
  NodeOutputValues,
  NodeParamValues,
  ParamValue,
  Vec2,
  Vec3,
  Vec4,
} from "@shadr/plugin-system";
import type {
  JsonObject,
  JsonValue,
  SubgraphNodeParams,
  SubgraphParamOverrides,
} from "@shadr/shared";
import {
  MAX_SUBGRAPH_DEPTH,
  MAX_SUBGRAPH_NODE_COUNT,
  MAX_SUBGRAPH_TOTAL_NODES,
  SUBGRAPH_INPUT_NODE_PREFIX,
  SUBGRAPH_INPUT_SOCKET_KEY,
  SUBGRAPH_NODE_TYPE,
} from "@shadr/shared";
import { Effect, Either } from "effect";

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
    }
  | {
      _tag: "ExecutionCanceled";
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

export type ExecNodeTiming = Readonly<{
  nodeId: NodeId;
  nodeType: string;
  durationMs: number;
  cacheHit: boolean;
}>;

export type ExecEvaluationStats = Readonly<{
  totalMs: number;
  cacheHits: number;
  cacheMisses: number;
  nodeTimings: ReadonlyArray<ExecNodeTiming>;
}>;

export type ExecEvaluationResult = Readonly<{
  value: JsonValue | null;
  stats: ExecEvaluationStats;
}>;

export type ExecEvaluationHooks = Readonly<{
  // eslint-disable-next-line no-unused-vars
  onNodeEvaluated?: (timing: ExecNodeTiming) => void;
  shouldCancel?: () => boolean;
}>;

type SubgraphEvalContext = Readonly<{
  depth: number;
  graphIdStack: ReadonlyArray<GraphId>;
  remainingNodeBudget: number;
}>;

export const createExecState = (): ExecState => ({
  dirty: new Set<NodeId>(),
  outputCache: new Map<NodeId, NodeOutputValues>(),
  nodeErrors: new Map<NodeId, NodeErrorState>(),
});

type ExecInstrumentation = {
  startMs: number;
  cacheHits: number;
  cacheMisses: number;
  nodeTimings: ExecNodeTiming[];
};

const nowMs = (): number => {
  const perf = globalThis.performance;
  if (perf && typeof perf.now === "function") {
    return perf.now();
  }
  return Date.now();
};

const createInstrumentation = (): ExecInstrumentation => ({
  startMs: nowMs(),
  cacheHits: 0,
  cacheMisses: 0,
  nodeTimings: [],
});

const finalizeInstrumentation = (
  instrumentation: ExecInstrumentation,
): ExecEvaluationStats => ({
  totalMs: Math.max(0, nowMs() - instrumentation.startMs),
  cacheHits: instrumentation.cacheHits,
  cacheMisses: instrumentation.cacheMisses,
  nodeTimings: instrumentation.nodeTimings,
});

const recordNodeTiming = (
  instrumentation: ExecInstrumentation | undefined,
  timing: ExecNodeTiming,
  hooks?: ExecEvaluationHooks,
): void => {
  if (!instrumentation) {
    hooks?.onNodeEvaluated?.(timing);
    return;
  }
  instrumentation.nodeTimings.push(timing);
  hooks?.onNodeEvaluated?.(timing);
};

const fail = (error: ExecError): Effect.Effect<never, ExecError> =>
  Effect.fail(error);

const toParamValue = (value: JsonValue): ParamValue | null => {
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  if (!value.every((entry) => typeof entry === "number")) {
    return null;
  }
  if (value.length === 2) {
    return [value[0] ?? 0, value[1] ?? 0] as Vec2;
  }
  if (value.length === 3) {
    return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0] as Vec3;
  }
  if (value.length === 4) {
    return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, value[3] ?? 0] as Vec4;
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

const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isString = (value: JsonValue | undefined): value is string =>
  typeof value === "string";

const readSubgraphOverrides = (
  value: JsonValue | undefined,
): SubgraphParamOverrides | undefined | null => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isJsonObject(value)) {
    return null;
  }
  const entries = Object.entries(value).flatMap(([nodeId, params]) => {
    if (!isJsonObject(params)) {
      return [];
    }
    return [[nodeId, params] as const];
  });
  if (entries.length !== Object.keys(value).length) {
    return null;
  }
  return Object.fromEntries(entries);
};

const readSubgraphPromotedParams = (
  value: JsonValue | undefined,
): SubgraphNodeParams["promotedParams"] | undefined | null => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const entries = value.flatMap((entry) => {
    if (!isJsonObject(entry)) {
      return [];
    }
    const key = entry["key"];
    const nodeId = entry["nodeId"];
    const fieldId = entry["fieldId"];
    if (!isString(key) || !isString(nodeId) || !isString(fieldId)) {
      return [];
    }
    return [
      {
        key,
        nodeId: nodeId as NodeId,
        fieldId,
      },
    ];
  });
  if (entries.length !== value.length) {
    return null;
  }
  return entries;
};

const readSubgraphParams = (params: JsonObject): SubgraphNodeParams | null => {
  const graphValue = params["graph"];
  if (!isJsonObject(graphValue)) {
    return null;
  }
  const graphRecord = graphValue as JsonObject;
  const schemaVersion = graphRecord["schemaVersion"];
  const graphId = graphRecord["graphId"];
  const nodes = graphRecord["nodes"];
  const sockets = graphRecord["sockets"];
  const wires = graphRecord["wires"];
  if (
    typeof schemaVersion !== "number" ||
    !isString(graphId) ||
    !Array.isArray(nodes) ||
    !Array.isArray(sockets) ||
    !Array.isArray(wires)
  ) {
    return null;
  }
  const inputsValue = params["inputs"];
  const outputsValue = params["outputs"];
  if (!Array.isArray(inputsValue) || !Array.isArray(outputsValue)) {
    return null;
  }
  const inputs = inputsValue.flatMap((entry) => {
    if (!isJsonObject(entry)) {
      return [];
    }
    const key = entry["key"];
    const nodeId = entry["nodeId"];
    if (!isString(key) || !isString(nodeId)) {
      return [];
    }
    return [{ key, nodeId: nodeId as NodeId }];
  });
  const outputs = outputsValue.flatMap((entry) => {
    if (!isJsonObject(entry)) {
      return [];
    }
    const key = entry["key"];
    const socketId = entry["socketId"];
    if (!isString(key) || !isString(socketId)) {
      return [];
    }
    return [{ key, socketId: socketId as SocketId }];
  });
  if (inputs.length !== inputsValue.length) {
    return null;
  }
  if (outputs.length !== outputsValue.length) {
    return null;
  }
  const promotedParams = readSubgraphPromotedParams(params["promotedParams"]);
  if (promotedParams === null) {
    return null;
  }
  const overrides = readSubgraphOverrides(params["overrides"]);
  if (overrides === null) {
    return null;
  }
  return {
    graph: graphValue as SubgraphNodeParams["graph"],
    inputs,
    outputs,
    ...(promotedParams ? { promotedParams } : {}),
    ...(overrides ? { overrides } : {}),
  };
};

const applySubgraphOverrides = (
  graph: Graph,
  overrides?: SubgraphParamOverrides,
): Graph => {
  if (!overrides || Object.keys(overrides).length === 0) {
    return graph;
  }
  let updated = false;
  const nodes = new Map(graph.nodes);
  for (const [nodeId, params] of Object.entries(overrides)) {
    const node = nodes.get(nodeId as NodeId);
    if (!node) {
      continue;
    }
    nodes.set(nodeId as NodeId, {
      ...node,
      params: { ...node.params, ...params },
    });
    updated = true;
  }
  if (!updated) {
    return graph;
  }
  return {
    ...graph,
    nodes,
  };
};

const applySubgraphParamPromotions = (
  graph: Graph,
  params: SubgraphNodeParams,
  inputs: Record<string, JsonValue | null>,
): Graph => {
  if (!params.promotedParams || params.promotedParams.length === 0) {
    return graph;
  }
  let updated = false;
  const nodes = new Map(graph.nodes);
  for (const promotion of params.promotedParams) {
    const value = inputs[promotion.key];
    if (value === null || value === undefined) {
      continue;
    }
    const node = nodes.get(promotion.nodeId);
    if (!node) {
      continue;
    }
    nodes.set(promotion.nodeId, {
      ...node,
      params: { ...node.params, [promotion.fieldId]: value },
    });
    updated = true;
  }
  if (!updated) {
    return graph;
  }
  return {
    ...graph,
    nodes,
  };
};

export const getNodeErrors = (
  state: ExecState,
  nodeId: NodeId,
): NodeErrorState => state.nodeErrors.get(nodeId) ?? [];

const evaluateSocketInternal = (
  graph: Graph,
  socketId: SocketId,
  resolveNodeDefinition: NodeDefinitionResolver,
  state?: ExecState,
  instrumentation?: ExecInstrumentation,
  subgraphContext?: SubgraphEvalContext,
  hooks?: ExecEvaluationHooks,
): Effect.Effect<JsonValue | null, ExecError> =>
  Effect.flatMap(
    executionSubgraphByOutputSockets(graph, [socketId]),
    (subgraph) =>
      Effect.gen(function* () {
        const execState = state ?? createExecState();
        const evalContext: SubgraphEvalContext = subgraphContext ?? {
          depth: 0,
          graphIdStack: [graph.graphId],
          remainingNodeBudget: MAX_SUBGRAPH_TOTAL_NODES,
        };
        const inputWireIndex = new Map<SocketId, WireId[]>();
        for (const wireId of subgraph.wires) {
          const wire = graph.wires.get(wireId);
          if (!wire) {
            return yield* fail({ _tag: "MissingWire", wireId });
          }
          const toSocket = graph.sockets.get(wire.toSocketId);
          if (!toSocket) {
            return yield* fail({
              _tag: "MissingSocket",
              socketId: wire.toSocketId,
            });
          }
          if (toSocket.direction !== "input") {
            return yield* fail({
              _tag: "InvalidSocketDirection",
              socketId: toSocket.id,
              expected: "input",
            });
          }
          const list = inputWireIndex.get(wire.toSocketId);
          if (list) {
            list.push(wireId);
          } else {
            inputWireIndex.set(wire.toSocketId, [wireId]);
          }
        }

        const outputCache = execState.outputCache;

        /* eslint-disable no-unused-vars */
        const validateNodeSockets: (
          ...args: [
            NodeId,
            string,
            ReadonlyArray<SocketId>,
            GraphSocketDirection,
            ReadonlySet<string>,
          ]
        ) => Effect.Effect<ReadonlyArray<string>, ExecError> =
          Effect.fnUntraced(function* (
            nodeId: NodeId,
            nodeType: string,
            nodeSocketIds: ReadonlyArray<SocketId>,
            direction: GraphSocketDirection,
            expectedKeys: ReadonlySet<string>,
          ) {
            const names: string[] = [];
            const seen = new Set<string>();
            for (const socketId of nodeSocketIds) {
              const socket = graph.sockets.get(socketId);
              if (!socket) {
                return yield* fail({ _tag: "MissingSocket", socketId });
              }
              if (socket.direction !== direction) {
                return yield* fail({
                  _tag: "InvalidSocketDirection",
                  socketId: socket.id,
                  expected: direction,
                });
              }
              if (seen.has(socket.name)) {
                return yield* fail({
                  _tag: "DuplicateSocketKey",
                  nodeId,
                  socketName: socket.name,
                  direction,
                });
              }
              if (!expectedKeys.has(socket.name)) {
                return yield* fail({
                  _tag: "UnknownSocketKey",
                  nodeId,
                  socketName: socket.name,
                  direction,
                  nodeType,
                });
              }
              seen.add(socket.name);
              names.push(socket.name);
            }

            for (const key of expectedKeys) {
              if (!seen.has(key)) {
                return yield* fail({
                  _tag: "MissingSocketForDefinition",
                  nodeId,
                  socketName: key,
                  direction,
                  nodeType,
                });
              }
            }

            return names;
          });

        const collectSocketNames: (
          ...args: [NodeId, ReadonlyArray<SocketId>, GraphSocketDirection]
        ) => Effect.Effect<ReadonlyArray<string>, ExecError> =
          Effect.fnUntraced(function* (
            nodeId: NodeId,
            socketIds: ReadonlyArray<SocketId>,
            direction: GraphSocketDirection,
          ) {
            const names: string[] = [];
            const seen = new Set<string>();
            for (const socketId of socketIds) {
              const socket = graph.sockets.get(socketId);
              if (!socket) {
                return yield* fail({ _tag: "MissingSocket", socketId });
              }
              if (socket.direction !== direction) {
                return yield* fail({
                  _tag: "InvalidSocketDirection",
                  socketId: socket.id,
                  expected: direction,
                });
              }
              if (seen.has(socket.name)) {
                return yield* fail({
                  _tag: "DuplicateSocketKey",
                  nodeId,
                  socketName: socket.name,
                  direction,
                });
              }
              seen.add(socket.name);
              names.push(socket.name);
            }
            return names;
          });

        const ensureNotCanceled = (): Effect.Effect<void, ExecError> => {
          if (hooks?.shouldCancel?.()) {
            return fail({ _tag: "ExecutionCanceled" });
          }
          return Effect.succeed(undefined);
        };

        const evaluateNode = (
          nodeId: NodeId,
        ): Effect.Effect<NodeOutputValues, ExecError> =>
          Effect.suspend(() =>
            Effect.flatMap(ensureNotCanceled(), () => {
              const cached = outputCache.get(nodeId);
              if (cached && !execState.dirty.has(nodeId)) {
                if (instrumentation) {
                  instrumentation.cacheHits += 1;
                }
                recordNodeTiming(
                  instrumentation,
                  {
                    nodeId,
                    nodeType: graph.nodes.get(nodeId)?.type ?? "unknown",
                    durationMs: 0,
                    cacheHit: true,
                  },
                  hooks,
                );
                return Effect.succeed(cached);
              }
              if (instrumentation) {
                instrumentation.cacheMisses += 1;
              }

              return Effect.gen(function* () {
                const node = graph.nodes.get(nodeId);
                if (!node) {
                  return yield* fail({ _tag: "MissingNode", nodeId });
                }
                if (!subgraph.nodes.has(nodeId)) {
                  return yield* fail({ _tag: "MissingNode", nodeId });
                }

                if (node.type === SUBGRAPH_NODE_TYPE) {
                  const inputNames = yield* collectSocketNames(
                    nodeId,
                    node.inputs,
                    "input",
                  );
                  const outputNames = yield* collectSocketNames(
                    nodeId,
                    node.outputs,
                    "output",
                  );
                  const inputs: Record<string, JsonValue | null> = {};
                  const missingRequired: NodeRuntimeError[] = [];
                  for (const [index, socketId] of node.inputs.entries()) {
                    const socket = graph.sockets.get(socketId);
                    if (!socket) {
                      return yield* fail({ _tag: "MissingSocket", socketId });
                    }
                    const name = inputNames[index];
                    if (!name) {
                      return yield* fail({
                        _tag: "UnknownSocketKey",
                        nodeId,
                        socketName: socket.name,
                        direction: "input",
                        nodeType: SUBGRAPH_NODE_TYPE,
                      });
                    }
                    const wireIds = inputWireIndex.get(socketId) ?? [];
                    if (wireIds.length > 1) {
                      return yield* fail({
                        _tag: "MultipleInputWires",
                        nodeId,
                        socketId,
                        wireIds: [...wireIds].sort((left, right) =>
                          left.localeCompare(right),
                        ),
                      });
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
                    const wireId = wireIds[0]!;
                    const wire = graph.wires.get(wireId);
                    if (!wire) {
                      return yield* fail({ _tag: "MissingWire", wireId });
                    }
                    const fromSocket = graph.sockets.get(wire.fromSocketId);
                    if (!fromSocket) {
                      return yield* fail({
                        _tag: "MissingSocket",
                        socketId: wire.fromSocketId,
                      });
                    }
                    if (fromSocket.direction !== "output") {
                      return yield* fail({
                        _tag: "InvalidSocketDirection",
                        socketId: fromSocket.id,
                        expected: "output",
                      });
                    }
                    if (!subgraph.nodes.has(fromSocket.nodeId)) {
                      return yield* fail({
                        _tag: "MissingNode",
                        nodeId: fromSocket.nodeId,
                      });
                    }
                    const value = yield* evaluateOutputSocket(fromSocket.id);
                    inputs[name] = value;
                  }

                  if (missingRequired.length > 0) {
                    const nullOutputs = createNullOutputs(outputNames);
                    recordNodeTiming(
                      instrumentation,
                      {
                        nodeId,
                        nodeType: node.type,
                        durationMs: 0,
                        cacheHit: false,
                      },
                      hooks,
                    );
                    outputCache.set(nodeId, nullOutputs);
                    execState.nodeErrors.set(nodeId, missingRequired);
                    execState.dirty.delete(nodeId);
                    return nullOutputs;
                  }

                  const nullOutputs = createNullOutputs(outputNames);
                  const computeStart = nowMs();
                  const params = readSubgraphParams(node.params);
                  if (!params) {
                    recordNodeTiming(
                      instrumentation,
                      {
                        nodeId,
                        nodeType: node.type,
                        durationMs: Math.max(0, nowMs() - computeStart),
                        cacheHit: false,
                      },
                      hooks,
                    );
                    execState.nodeErrors.set(nodeId, [
                      {
                        _tag: "NodeComputeFailed",
                        nodeId,
                        nodeType: node.type,
                        cause: new Error("Invalid subgraph params"),
                      },
                    ]);
                    outputCache.set(nodeId, nullOutputs);
                    execState.dirty.delete(nodeId);
                    return nullOutputs;
                  }

                  if (evalContext.depth >= MAX_SUBGRAPH_DEPTH) {
                    recordNodeTiming(
                      instrumentation,
                      {
                        nodeId,
                        nodeType: node.type,
                        durationMs: Math.max(0, nowMs() - computeStart),
                        cacheHit: false,
                      },
                      hooks,
                    );
                    execState.nodeErrors.set(nodeId, [
                      {
                        _tag: "NodeComputeFailed",
                        nodeId,
                        nodeType: node.type,
                        cause: new Error(
                          `Subgraph depth exceeds ${MAX_SUBGRAPH_DEPTH} levels.`,
                        ),
                      },
                    ]);
                    outputCache.set(nodeId, nullOutputs);
                    execState.dirty.delete(nodeId);
                    return nullOutputs;
                  }

                  if (evalContext.graphIdStack.includes(params.graph.graphId)) {
                    recordNodeTiming(
                      instrumentation,
                      {
                        nodeId,
                        nodeType: node.type,
                        durationMs: Math.max(0, nowMs() - computeStart),
                        cacheHit: false,
                      },
                      hooks,
                    );
                    execState.nodeErrors.set(nodeId, [
                      {
                        _tag: "NodeComputeFailed",
                        nodeId,
                        nodeType: node.type,
                        cause: new Error(
                          `Recursive subgraph reference detected for ${params.graph.graphId}.`,
                        ),
                      },
                    ]);
                    outputCache.set(nodeId, nullOutputs);
                    execState.dirty.delete(nodeId);
                    return nullOutputs;
                  }

                  if (params.graph.nodes.length > MAX_SUBGRAPH_NODE_COUNT) {
                    recordNodeTiming(
                      instrumentation,
                      {
                        nodeId,
                        nodeType: node.type,
                        durationMs: Math.max(0, nowMs() - computeStart),
                        cacheHit: false,
                      },
                      hooks,
                    );
                    execState.nodeErrors.set(nodeId, [
                      {
                        _tag: "NodeComputeFailed",
                        nodeId,
                        nodeType: node.type,
                        cause: new Error(
                          `Subgraph exceeds ${MAX_SUBGRAPH_NODE_COUNT} nodes.`,
                        ),
                      },
                    ]);
                    outputCache.set(nodeId, nullOutputs);
                    execState.dirty.delete(nodeId);
                    return nullOutputs;
                  }

                  if (
                    params.graph.nodes.length > evalContext.remainingNodeBudget
                  ) {
                    recordNodeTiming(
                      instrumentation,
                      {
                        nodeId,
                        nodeType: node.type,
                        durationMs: Math.max(0, nowMs() - computeStart),
                        cacheHit: false,
                      },
                      hooks,
                    );
                    execState.nodeErrors.set(nodeId, [
                      {
                        _tag: "NodeComputeFailed",
                        nodeId,
                        nodeType: node.type,
                        cause: new Error(
                          `Subgraph budget exceeded (${MAX_SUBGRAPH_TOTAL_NODES} nodes total).`,
                        ),
                      },
                    ]);
                    outputCache.set(nodeId, nullOutputs);
                    execState.dirty.delete(nodeId);
                    return nullOutputs;
                  }

                  const graphResult = yield* Effect.either(
                    graphFromDocumentV1(params.graph),
                  );
                  if (Either.isLeft(graphResult)) {
                    recordNodeTiming(
                      instrumentation,
                      {
                        nodeId,
                        nodeType: node.type,
                        durationMs: Math.max(0, nowMs() - computeStart),
                        cacheHit: false,
                      },
                      hooks,
                    );
                    execState.nodeErrors.set(nodeId, [
                      {
                        _tag: "NodeComputeFailed",
                        nodeId,
                        nodeType: node.type,
                        cause: graphResult.left,
                      },
                    ]);
                    outputCache.set(nodeId, nullOutputs);
                    execState.dirty.delete(nodeId);
                    return nullOutputs;
                  }

                  const subgraphGraph = applySubgraphOverrides(
                    graphResult.right,
                    params.overrides,
                  );

                  const inputValuesByNodeId = new Map<
                    NodeId,
                    JsonValue | null
                  >();
                  for (const entry of params.inputs) {
                    inputValuesByNodeId.set(
                      entry.nodeId,
                      inputs[entry.key] ?? null,
                    );
                  }

                  const promotedGraph = applySubgraphParamPromotions(
                    subgraphGraph,
                    params,
                    inputs,
                  );

                  const resolveSubgraphNodeDefinition: NodeDefinitionResolver =
                    (nodeType: string): NodeDefinition | undefined => {
                      if (nodeType.startsWith(SUBGRAPH_INPUT_NODE_PREFIX)) {
                        const dataType = nodeType.slice(
                          SUBGRAPH_INPUT_NODE_PREFIX.length,
                        );
                        const outputType =
                          dataType.length > 0 ? dataType : "float";
                        return {
                          typeId: nodeType,
                          label: "Subgraph Input",
                          description: "Feeds values from the parent graph.",
                          inputs: [],
                          outputs: [
                            {
                              key: SUBGRAPH_INPUT_SOCKET_KEY,
                              label: "Value",
                              direction: "output",
                              dataType: outputType,
                            },
                          ],
                          compute: (_inputs, _params, context) => ({
                            [SUBGRAPH_INPUT_SOCKET_KEY]:
                              inputValuesByNodeId.get(context.nodeId) ?? null,
                          }),
                        };
                      }
                      return resolveNodeDefinition(nodeType);
                    };

                  const innerState = createExecState();
                  const nextContext: SubgraphEvalContext = {
                    depth: evalContext.depth + 1,
                    graphIdStack: [
                      ...evalContext.graphIdStack,
                      params.graph.graphId,
                    ],
                    remainingNodeBudget:
                      evalContext.remainingNodeBudget -
                      params.graph.nodes.length,
                  };
                  const outputValues: Record<string, JsonValue | null> = {
                    ...nullOutputs,
                  };
                  const outputKeySet = new Set(outputNames);
                  for (const entry of params.outputs) {
                    if (!outputKeySet.has(entry.key)) {
                      recordNodeTiming(
                        instrumentation,
                        {
                          nodeId,
                          nodeType: node.type,
                          durationMs: Math.max(0, nowMs() - computeStart),
                          cacheHit: false,
                        },
                        hooks,
                      );
                      execState.nodeErrors.set(nodeId, [
                        {
                          _tag: "NodeComputeFailed",
                          nodeId,
                          nodeType: node.type,
                          cause: new Error(
                            `Unknown subgraph output key: ${entry.key}`,
                          ),
                        },
                      ]);
                      outputCache.set(nodeId, nullOutputs);
                      execState.dirty.delete(nodeId);
                      return nullOutputs;
                    }
                    const result = yield* Effect.either(
                      evaluateSocketInternal(
                        promotedGraph,
                        entry.socketId,
                        resolveSubgraphNodeDefinition,
                        innerState,
                        undefined,
                        nextContext,
                        hooks,
                      ),
                    );
                    if (Either.isLeft(result)) {
                      recordNodeTiming(
                        instrumentation,
                        {
                          nodeId,
                          nodeType: node.type,
                          durationMs: Math.max(0, nowMs() - computeStart),
                          cacheHit: false,
                        },
                        hooks,
                      );
                      execState.nodeErrors.set(nodeId, [
                        {
                          _tag: "NodeComputeFailed",
                          nodeId,
                          nodeType: node.type,
                          cause: result.left,
                        },
                      ]);
                      outputCache.set(nodeId, nullOutputs);
                      execState.dirty.delete(nodeId);
                      return nullOutputs;
                    }
                    outputValues[entry.key] = result.right;
                  }

                  recordNodeTiming(
                    instrumentation,
                    {
                      nodeId,
                      nodeType: node.type,
                      durationMs: Math.max(0, nowMs() - computeStart),
                      cacheHit: false,
                    },
                    hooks,
                  );
                  execState.nodeErrors.delete(nodeId);
                  outputCache.set(nodeId, outputValues);
                  execState.dirty.delete(nodeId);
                  return outputValues;
                }

                const definition = resolveNodeDefinition(node.type);
                if (!definition) {
                  return yield* fail({
                    _tag: "MissingNodeDefinition",
                    nodeId,
                    nodeType: node.type,
                  });
                }

                const inputKeys = new Set(
                  definition.inputs.map((input) => input.key),
                );
                const outputKeys = new Set(
                  definition.outputs.map((output) => output.key),
                );

                const inputNames = yield* validateNodeSockets(
                  nodeId,
                  definition.typeId,
                  node.inputs,
                  "input",
                  inputKeys,
                );
                const outputNames = yield* validateNodeSockets(
                  nodeId,
                  definition.typeId,
                  node.outputs,
                  "output",
                  outputKeys,
                );

                const inputs: Record<string, JsonValue | null> = {};
                const missingRequired: NodeRuntimeError[] = [];
                for (const [index, socketId] of node.inputs.entries()) {
                  const socket = graph.sockets.get(socketId);
                  if (!socket) {
                    return yield* fail({ _tag: "MissingSocket", socketId });
                  }
                  const name = inputNames[index];
                  if (!name) {
                    return yield* fail({
                      _tag: "UnknownSocketKey",
                      nodeId,
                      socketName: socket.name,
                      direction: "input",
                      nodeType: definition.typeId,
                    });
                  }

                  const wireIds = inputWireIndex.get(socketId) ?? [];
                  if (wireIds.length > 1) {
                    return yield* fail({
                      _tag: "MultipleInputWires",
                      nodeId,
                      socketId,
                      wireIds: [...wireIds].sort((left, right) =>
                        left.localeCompare(right),
                      ),
                    });
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

                  const wireId = wireIds[0]!;
                  const wire = graph.wires.get(wireId);
                  if (!wire) {
                    return yield* fail({ _tag: "MissingWire", wireId });
                  }
                  const fromSocket = graph.sockets.get(wire.fromSocketId);
                  if (!fromSocket) {
                    return yield* fail({
                      _tag: "MissingSocket",
                      socketId: wire.fromSocketId,
                    });
                  }
                  if (fromSocket.direction !== "output") {
                    return yield* fail({
                      _tag: "InvalidSocketDirection",
                      socketId: fromSocket.id,
                      expected: "output",
                    });
                  }
                  if (!subgraph.nodes.has(fromSocket.nodeId)) {
                    return yield* fail({
                      _tag: "MissingNode",
                      nodeId: fromSocket.nodeId,
                    });
                  }
                  const value = yield* evaluateOutputSocket(fromSocket.id);
                  inputs[name] = value;
                }

                if (missingRequired.length > 0) {
                  const nullOutputs = createNullOutputs(outputNames);
                  recordNodeTiming(
                    instrumentation,
                    {
                      nodeId,
                      nodeType: definition.typeId,
                      durationMs: 0,
                      cacheHit: false,
                    },
                    hooks,
                  );
                  outputCache.set(nodeId, nullOutputs);
                  execState.nodeErrors.set(nodeId, missingRequired);
                  execState.dirty.delete(nodeId);
                  return nullOutputs;
                }

                const params = coerceParamValues(node.params);
                const nodeInputs: NodeInputValues = inputs;
                const computeStart = nowMs();
                const outputsResult = yield* Effect.either(
                  Effect.try({
                    try: () => {
                      const outputs = definition.compute(nodeInputs, params, {
                        nodeId,
                      });
                      recordNodeTiming(
                        instrumentation,
                        {
                          nodeId,
                          nodeType: definition.typeId,
                          durationMs: Math.max(0, nowMs() - computeStart),
                          cacheHit: false,
                        },
                        hooks,
                      );
                      return outputs;
                    },
                    catch: (cause): ExecEngineError => {
                      recordNodeTiming(
                        instrumentation,
                        {
                          nodeId,
                          nodeType: definition.typeId,
                          durationMs: Math.max(0, nowMs() - computeStart),
                          cacheHit: false,
                        },
                        hooks,
                      );
                      return {
                        _tag: "NodeComputeFailed",
                        nodeId,
                        nodeType: definition.typeId,
                        cause,
                      };
                    },
                  }),
                );
                if (Either.isLeft(outputsResult)) {
                  const nullOutputs = createNullOutputs(outputNames);
                  execState.nodeErrors.set(nodeId, [
                    outputsResult.left as NodeRuntimeError,
                  ]);
                  outputCache.set(nodeId, nullOutputs);
                  execState.dirty.delete(nodeId);
                  return nullOutputs;
                }
                const outputs = outputsResult.right;

                const normalized: Record<string, JsonValue | null> = {};
                for (const [index, socketId] of node.outputs.entries()) {
                  const socket = graph.sockets.get(socketId);
                  if (!socket) {
                    return yield* fail({ _tag: "MissingSocket", socketId });
                  }
                  const name = outputNames[index];
                  if (!name) {
                    return yield* fail({
                      _tag: "UnknownSocketKey",
                      nodeId,
                      socketName: socket.name,
                      direction: "output",
                      nodeType: definition.typeId,
                    });
                  }
                  const value = outputs[name];
                  normalized[name] = value === undefined ? null : value;
                }

                execState.nodeErrors.delete(nodeId);
                outputCache.set(nodeId, normalized);
                execState.dirty.delete(nodeId);
                return normalized;
              });
            }),
          );

        /* eslint-disable no-unused-vars */
        const evaluateOutputSocket: (
          ...args: [SocketId]
        ) => Effect.Effect<JsonValue | null, ExecError> = Effect.fnUntraced(
          function* (targetSocketId: SocketId) {
            const socket = graph.sockets.get(targetSocketId);
            if (!socket) {
              return yield* fail({
                _tag: "MissingSocket",
                socketId: targetSocketId,
              });
            }
            if (socket.direction !== "output") {
              return yield* fail({
                _tag: "InvalidSocketDirection",
                socketId: socket.id,
                expected: "output",
              });
            }
            const outputs = yield* evaluateNode(socket.nodeId);
            return outputs[socket.name] ?? null;
          },
        );
        /* eslint-enable no-unused-vars */

        return yield* evaluateOutputSocket(socketId);
      }),
  );

export const evaluateSocket = (
  graph: Graph,
  socketId: SocketId,
  resolveNodeDefinition: NodeDefinitionResolver,
  state?: ExecState,
  hooks?: ExecEvaluationHooks,
): Effect.Effect<JsonValue | null, ExecError> =>
  evaluateSocketInternal(
    graph,
    socketId,
    resolveNodeDefinition,
    state,
    undefined,
    undefined,
    hooks,
  );

export const evaluateSocketWithStats = (
  graph: Graph,
  socketId: SocketId,
  resolveNodeDefinition: NodeDefinitionResolver,
  state?: ExecState,
  hooks?: ExecEvaluationHooks,
): Effect.Effect<ExecEvaluationResult, ExecError> =>
  Effect.flatMap(
    Effect.sync(() => createInstrumentation()),
    (instrumentation) =>
      Effect.map(
        evaluateSocketInternal(
          graph,
          socketId,
          resolveNodeDefinition,
          state,
          instrumentation,
          undefined,
          hooks,
        ),
        (value) => ({
          value,
          stats: finalizeInstrumentation(instrumentation),
        }),
      ),
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

/* eslint-disable no-unused-vars */
export const markDirtyForWireChange: (
  ...args: [Graph, ExecState, WireId]
) => Effect.Effect<ExecState, ExecError> = Effect.fnUntraced(function* (
  graph: Graph,
  state: ExecState,
  wireId: WireId,
) {
  const wire = graph.wires.get(wireId);
  if (!wire) {
    return yield* fail({ _tag: "MissingWire", wireId });
  }
  const toSocket = graph.sockets.get(wire.toSocketId);
  if (!toSocket) {
    return yield* fail({
      _tag: "MissingSocket",
      socketId: wire.toSocketId,
    });
  }
  return markDirty(graph, state, toSocket.nodeId);
});
/* eslint-enable no-unused-vars */
