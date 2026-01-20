import type {
  ExecError,
  ExecEvaluationResult,
  ExecState,
  NodeDefinitionResolver,
} from "@shadr/exec-engine";
import {
  createExecState,
  evaluateSocketWithStats,
  markDirty,
  markDirtyForParamChange,
  markDirtyForWireChange,
} from "@shadr/exec-engine";
import type { Graph, NodeId, SocketId, WireId } from "@shadr/graph-core";
import { Context, Effect, Layer } from "effect";

/* eslint-disable no-unused-vars */
export type ExecServiceApi = Readonly<{
  createExecState: () => ExecState;
  markDirty: (_graph: Graph, _state: ExecState, _nodeId: NodeId) => ExecState;
  markDirtyForParamChange: (
    _graph: Graph,
    _state: ExecState,
    _nodeId: NodeId,
  ) => ExecState;
  markDirtyForWireChange: (
    _graph: Graph,
    _state: ExecState,
    _wireId: WireId,
  ) => Effect.Effect<ExecState, ExecError>;
  evaluateSocketWithStats: (
    _graph: Graph,
    _socketId: SocketId,
    _resolveNodeDefinition: NodeDefinitionResolver,
    _state?: ExecState,
  ) => Effect.Effect<ExecEvaluationResult, ExecError>;
}>;
/* eslint-enable no-unused-vars */

export class ExecService extends Context.Tag("ExecService")<
  ExecService,
  ExecServiceApi
>() {}

export const ExecServiceLive = Layer.succeed(ExecService, {
  createExecState,
  markDirty,
  markDirtyForParamChange,
  markDirtyForWireChange,
  evaluateSocketWithStats,
});

export const markDirtyForWireChangeEffect = (
  graph: Graph,
  state: ExecState,
  wireId: WireId,
): Effect.Effect<ExecState, ExecError, ExecService> =>
  Effect.flatMap(ExecService, (service) =>
    service.markDirtyForWireChange(graph, state, wireId),
  );

export const evaluateSocketWithStatsEffect = (
  graph: Graph,
  socketId: SocketId,
  resolveNodeDefinition: NodeDefinitionResolver,
  state?: ExecState,
): Effect.Effect<ExecEvaluationResult, ExecError, ExecService> =>
  Effect.flatMap(ExecService, (service) =>
    service.evaluateSocketWithStats(
      graph,
      socketId,
      resolveNodeDefinition,
      state,
    ),
  );
