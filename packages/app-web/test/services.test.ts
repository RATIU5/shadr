import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";

import type {
  ExecEvaluationResult,
  ExecState,
  NodeDefinitionResolver,
} from "@shadr/exec-engine";
import { createExecState } from "@shadr/exec-engine";
import type { Graph } from "@shadr/graph-core";
import { createGraph } from "@shadr/graph-core";
import type { GraphDocumentV1 } from "@shadr/shared";
import {
  makeGraphId,
  makeSocketId,
  makeWireId,
  type SocketId,
  type WireId,
} from "@shadr/shared";

import {
  ExecService,
  evaluateSocketWithStatsEffect,
  markDirtyForWireChangeEffect,
  type ExecServiceApi,
} from "../src/services/exec-service";
import {
  GraphService,
  graphFromDocument,
  graphToDocument,
  type GraphServiceApi,
} from "../src/services/graph-service";

const createEmptyDocument = (graphId = makeGraphId("graph")): GraphDocumentV1 => ({
  schemaVersion: 1,
  graphId,
  nodes: [],
  sockets: [],
  wires: [],
});

describe("graph-service effect wiring", () => {
  it("routes through the provided GraphService layer", () => {
    const graph = createGraph(makeGraphId("test-graph"));
    const document = createEmptyDocument(graph.graphId);
    const graphFromDocumentMock = vi.fn((input: GraphDocumentV1) =>
      Effect.succeed(graph),
    );
    const graphToDocumentMock = vi.fn((_input: Graph) => document);
    const service: GraphServiceApi = {
      createGraph: () => graph,
      graphFromDocument: graphFromDocumentMock,
      graphToDocument: graphToDocumentMock,
    };
    const layer = Layer.succeed(GraphService, service);

    const result = Effect.runSync(
      Effect.provide(graphFromDocument(document), layer),
    );
    expect(result).toBe(graph);
    expect(graphFromDocumentMock).toHaveBeenCalledWith(document);

    const roundTrip = Effect.runSync(
      Effect.provide(graphToDocument(graph), layer),
    );
    expect(roundTrip).toBe(document);
    expect(graphToDocumentMock).toHaveBeenCalledWith(graph);
  });
});

describe("exec-service effect wiring", () => {
  it("routes exec effects through the provided ExecService layer", () => {
    const graph = createGraph(makeGraphId("exec-graph"));
    const state = createExecState();
    const nextState: ExecState = createExecState();
    const wireId = makeWireId("wire-1");
    const socketId: SocketId = makeSocketId("socket-1");
    const result: ExecEvaluationResult = {
      value: null,
      stats: {
        totalMs: 0,
        cacheHits: 0,
        cacheMisses: 0,
        nodeTimings: [],
      },
    };
    const markDirtyForWireChangeMock = vi.fn(
      (_graph: Graph, _state: ExecState, _wireId: WireId) =>
        Effect.succeed(nextState),
    );
    const evaluateSocketWithStatsMock = vi.fn(
      (
        _graph: Graph,
        _socketId: SocketId,
        _resolve: NodeDefinitionResolver,
        _state?: ExecState,
      ) => Effect.succeed(result),
    );

    const service: ExecServiceApi = {
      createExecState: () => state,
      markDirty: vi.fn((_graph: Graph, _state: ExecState) => state),
      markDirtyForParamChange: vi.fn((_graph: Graph, _state: ExecState) => state),
      markDirtyForWireChange: markDirtyForWireChangeMock,
      evaluateSocketWithStats: evaluateSocketWithStatsMock,
    };
    const layer = Layer.succeed(ExecService, service);

    const wireResult = Effect.runSync(
      Effect.provide(markDirtyForWireChangeEffect(graph, state, wireId), layer),
    );
    expect(wireResult).toBe(nextState);
    expect(markDirtyForWireChangeMock).toHaveBeenCalledWith(graph, state, wireId);

    const resolver = () => undefined;
    const evalResult = Effect.runSync(
      Effect.provide(
        evaluateSocketWithStatsEffect(graph, socketId, resolver, state),
        layer,
      ),
    );
    expect(evalResult).toBe(result);
    expect(evaluateSocketWithStatsMock).toHaveBeenCalledWith(
      graph,
      socketId,
      resolver,
      state,
    );
  });
});
