import type { ExecEvaluationHooks, ExecNodeTiming } from "@shadr/exec-engine";
import { evaluateSocketWithStats } from "@shadr/exec-engine";
import type { Graph, NodeId, SocketId } from "@shadr/graph-core";
import { Effect, Either } from "effect";

import { resolveNodeDefinition } from "~/editor/exec";
import type {
  ExecWorkerRequest,
  ExecWorkerResponse,
} from "~/workers/exec-worker-protocol";

const collectUpstreamNodes = (
  graph: Graph,
  startNodeId: NodeId,
): Set<NodeId> => {
  const visited = new Set<NodeId>();
  const stack: NodeId[] = [startNodeId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const incoming = graph.incoming.get(current);
    if (!incoming) {
      continue;
    }
    for (const nodeId of incoming) {
      stack.push(nodeId);
    }
  }
  return visited;
};

const getEvaluationTotal = (graph: Graph, socketId: SocketId): number => {
  const socket = graph.sockets.get(socketId);
  if (!socket) {
    return 0;
  }
  return collectUpstreamNodes(graph, socket.nodeId).size;
};

const ctx = self;

ctx.onmessage = (event: MessageEvent<ExecWorkerRequest>) => {
  const message = event.data;
  if (message.type !== "evaluate") {
    return;
  }

  const { requestId, graph, socketId, execState } = message;
  const total = getEvaluationTotal(graph, socketId);
  let completed = 0;
  const postProgress = (timing: ExecNodeTiming): void => {
    completed += 1;
    const payload: ExecWorkerResponse = {
      type: "progress",
      requestId,
      completed,
      total,
      nodeId: timing.nodeId,
      nodeType: timing.nodeType,
      durationMs: timing.durationMs,
      cacheHit: timing.cacheHit,
    };
    ctx.postMessage(payload);
  };

  if (total > 0) {
    const initial: ExecWorkerResponse = {
      type: "progress",
      requestId,
      completed: 0,
      total,
    };
    ctx.postMessage(initial);
  }

  const hooks: ExecEvaluationHooks = {
    onNodeEvaluated: postProgress,
  };

  const result = Effect.runSync(
    Effect.either(
      evaluateSocketWithStats(
        graph,
        socketId,
        resolveNodeDefinition,
        execState,
        hooks,
      ),
    ),
  );

  if (Either.isLeft(result)) {
    const payload: ExecWorkerResponse = {
      type: "error",
      requestId,
      error: result.left,
    };
    ctx.postMessage(payload);
    return;
  }

  const payload: ExecWorkerResponse = {
    type: "result",
    requestId,
    result: result.right,
    execState,
  };
  ctx.postMessage(payload);
};
