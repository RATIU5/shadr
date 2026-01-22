import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ExecError,
  ExecEvaluationResult,
  ExecState,
} from "@shadr/exec-engine";
import { createExecState } from "@shadr/exec-engine";
import type { Graph, GraphNode, GraphSocket } from "@shadr/graph-core";
import { addNode, createGraph } from "@shadr/graph-core";
import type { NodeId, SocketId } from "@shadr/shared";
import { makeGraphId, makeNodeId, makeSocketId } from "@shadr/shared";

import {
  createExecWorkerClient,
  type ExecWorkerProgress,
} from "../src/editor/exec-worker-client";
import type {
  ExecWorkerEvaluateRequest,
  ExecWorkerRequest,
  ExecWorkerResponse,
} from "../src/workers/exec-worker-protocol";

vi.mock("@shadr/exec-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shadr/exec-engine")>();
  return {
    ...actual,
    evaluateSocketWithStats: vi.fn(),
  };
});

vi.mock("~/editor/exec", () => ({
  resolveNodeDefinition: () => undefined,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const createOutputNode = (
  nodeId: NodeId,
): { node: GraphNode; sockets: GraphSocket[]; socketId: SocketId } => {
  const socketId = makeSocketId(`${nodeId}.out`);
  const node: GraphNode = {
    id: nodeId,
    type: "test",
    position: { x: 0, y: 0 },
    params: {},
    inputs: [],
    outputs: [socketId],
  };
  const sockets: GraphSocket[] = [
    {
      id: socketId,
      nodeId,
      name: "out",
      direction: "output",
      dataType: "float",
      required: false,
    },
  ];
  return { node, sockets, socketId };
};

const applyGraph = (effect: ReturnType<typeof addNode>): Graph =>
  Effect.runSync(effect);

describe("exec-worker protocol", () => {
  it("posts progress and result messages for evaluation requests", async () => {
    vi.resetModules();
    const { evaluateSocketWithStats } = await import("@shadr/exec-engine");
    const evaluateSocketWithStatsMock = vi.mocked(evaluateSocketWithStats);
    evaluateSocketWithStatsMock.mockReset();

    const postMessage = vi.fn<(payload: ExecWorkerResponse) => void>();
    const ctx: {
      postMessage: (payload: ExecWorkerResponse) => void;
      onmessage: ((event: MessageEvent<ExecWorkerRequest>) => void) | null;
    } = {
      postMessage,
      onmessage: null,
    };
    vi.stubGlobal("self", ctx);

    const nodeId = makeNodeId("node-1");
    const { node, sockets, socketId } = createOutputNode(nodeId);
    let graph = createGraph(makeGraphId("graph"));
    graph = applyGraph(addNode(graph, node, sockets));

    const execState = createExecState();
    const result: ExecEvaluationResult = {
      value: 42,
      stats: {
        totalMs: 1,
        cacheHits: 0,
        cacheMisses: 1,
        nodeTimings: [],
      },
    };

    evaluateSocketWithStatsMock.mockImplementation(
      (_graph, _socketId, _resolver, _state, hooks) => {
        hooks?.onNodeEvaluated?.({
          nodeId,
          nodeType: "test",
          durationMs: 1,
          cacheHit: false,
        });
        return Effect.succeed(result);
      },
    );

    await import("../src/workers/exec-worker");

    const message: ExecWorkerRequest = {
      type: "evaluate",
      requestId: 7,
      graph,
      socketId,
      execState,
    };
    ctx.onmessage?.({ data: message } as MessageEvent<ExecWorkerRequest>);

    expect(postMessage).toHaveBeenCalledTimes(3);
    expect(postMessage.mock.calls[0]?.[0]).toEqual({
      type: "progress",
      requestId: 7,
      completed: 0,
      total: 1,
    });
    expect(postMessage.mock.calls[1]?.[0]).toEqual({
      type: "progress",
      requestId: 7,
      completed: 1,
      total: 1,
      nodeId,
      nodeType: "test",
      durationMs: 1,
      cacheHit: false,
    });
    expect(postMessage.mock.calls[2]?.[0]).toEqual({
      type: "result",
      requestId: 7,
      result,
      execState,
    });
  });

  it("posts error responses when evaluation fails", async () => {
    vi.resetModules();
    const { evaluateSocketWithStats } = await import("@shadr/exec-engine");
    const evaluateSocketWithStatsMock = vi.mocked(evaluateSocketWithStats);
    evaluateSocketWithStatsMock.mockReset();

    const postMessage = vi.fn<(payload: ExecWorkerResponse) => void>();
    const ctx: {
      postMessage: (payload: ExecWorkerResponse) => void;
      onmessage: ((event: MessageEvent<ExecWorkerRequest>) => void) | null;
    } = {
      postMessage,
      onmessage: null,
    };
    vi.stubGlobal("self", ctx);

    const nodeId = makeNodeId("node-2");
    const { node, sockets, socketId } = createOutputNode(nodeId);
    let graph = createGraph(makeGraphId("graph-error"));
    graph = applyGraph(addNode(graph, node, sockets));

    const execState = createExecState();
    const error: ExecError = { _tag: "ExecutionCanceled" };

    evaluateSocketWithStatsMock.mockImplementation(
      (_graph, _socketId, _resolver, _state, _hooks) => Effect.fail(error),
    );

    await import("../src/workers/exec-worker");

    const message: ExecWorkerRequest = {
      type: "evaluate",
      requestId: 3,
      graph,
      socketId,
      execState,
    };
    ctx.onmessage?.({ data: message } as MessageEvent<ExecWorkerRequest>);

    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(postMessage.mock.calls[1]?.[0]).toEqual({
      type: "error",
      requestId: 3,
      error,
    });
  });
});

describe("exec-worker client lifecycle", () => {
  class FakeWorker {
    static instances: FakeWorker[] = [];

    onmessage: ((event: MessageEvent<ExecWorkerResponse>) => void) | null = null;
    postMessage = vi.fn<(payload: ExecWorkerEvaluateRequest) => void>();
    terminate = vi.fn<() => void>();

    constructor(_url: URL, _options?: WorkerOptions) {
      FakeWorker.instances.push(this);
    }

    emit(message: ExecWorkerResponse) {
      this.onmessage?.({ data: message } as MessageEvent<ExecWorkerResponse>);
    }
  }

  beforeEach(() => {
    FakeWorker.instances = [];
  });

  it("forwards progress and result messages to the active request", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = createExecWorkerClient();

    const graph = createGraph(makeGraphId("client-graph"));
    const socketId = makeSocketId("node.out");
    const execState = createExecState();

    const onProgress = vi.fn<(progress: ExecWorkerProgress) => void>();
    const promise = client.evaluate(graph, socketId, execState, onProgress);

    const worker = FakeWorker.instances[0];
    if (!worker) {
      throw new Error("Expected worker instance");
    }
    const payload = worker.postMessage.mock.calls[0]?.[0];
    if (!payload) {
      throw new Error("Expected postMessage payload");
    }

    const result: ExecEvaluationResult = {
      value: "ok",
      stats: { totalMs: 0, cacheHits: 0, cacheMisses: 0, nodeTimings: [] },
    };

    worker.emit({
      type: "progress",
      requestId: payload.requestId,
      completed: 1,
      total: 2,
    });
    worker.emit({
      type: "result",
      requestId: payload.requestId,
      result,
      execState,
    });

    await expect(promise).resolves.toEqual({ result, execState });
    expect(onProgress).toHaveBeenCalledWith({
      completed: 1,
      total: 2,
      nodeId: undefined,
      nodeType: undefined,
      durationMs: undefined,
      cacheHit: undefined,
    });
  });

  it("cancels active evaluations and terminates the worker", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = createExecWorkerClient();

    const graph = createGraph(makeGraphId("cancel-graph"));
    const socketId = makeSocketId("node.out");
    const execState = createExecState();

    const first = client.evaluate(graph, socketId, execState);
    const firstWorker = FakeWorker.instances[0];
    if (!firstWorker) {
      throw new Error("Expected first worker");
    }

    const second = client.evaluate(graph, socketId, execState);
    const secondWorker = FakeWorker.instances[1];
    if (!secondWorker) {
      throw new Error("Expected second worker");
    }

    await expect(first).rejects.toEqual({ _tag: "ExecutionCanceled" });
    expect(firstWorker.terminate).toHaveBeenCalled();

    const payload = secondWorker.postMessage.mock.calls[0]?.[0];
    if (!payload) {
      throw new Error("Expected payload from second worker");
    }
    secondWorker.emit({
      type: "result",
      requestId: payload.requestId,
      result: {
        value: null,
        stats: { totalMs: 0, cacheHits: 0, cacheMisses: 0, nodeTimings: [] },
      },
      execState,
    });
    await expect(second).resolves.toEqual({
      result: {
        value: null,
        stats: {
          totalMs: 0,
          cacheHits: 0,
          cacheMisses: 0,
          nodeTimings: [],
        },
      },
      execState,
    });
  });

  it("ignores responses for a different request id", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = createExecWorkerClient();

    const graph = createGraph(makeGraphId("ignore-graph"));
    const socketId = makeSocketId("node.out");
    const execState = createExecState();

    const onProgress = vi.fn<(progress: ExecWorkerProgress) => void>();
    const promise = client.evaluate(graph, socketId, execState, onProgress);

    const worker = FakeWorker.instances[0];
    if (!worker) {
      throw new Error("Expected worker instance");
    }
    const payload = worker.postMessage.mock.calls[0]?.[0];
    if (!payload) {
      throw new Error("Expected postMessage payload");
    }

    worker.emit({
      type: "progress",
      requestId: payload.requestId + 1,
      completed: 1,
      total: 1,
    });
    expect(onProgress).not.toHaveBeenCalled();

    const result: ExecEvaluationResult = {
      value: "done",
      stats: { totalMs: 0, cacheHits: 0, cacheMisses: 0, nodeTimings: [] },
    };
    worker.emit({
      type: "result",
      requestId: payload.requestId,
      result,
      execState,
    });

    await expect(promise).resolves.toEqual({ result, execState });
  });
});
