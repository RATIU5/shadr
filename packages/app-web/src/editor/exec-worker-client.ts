import type {
  ExecError,
  ExecEvaluationResult,
  ExecState,
} from "@shadr/exec-engine";
import type { Graph, NodeId, SocketId } from "@shadr/graph-core";

import type {
  ExecWorkerEvaluateRequest,
  ExecWorkerResponse,
} from "~/workers/exec-worker-protocol";

export type ExecWorkerProgress = Readonly<{
  completed: number;
  total: number;
  nodeId?: NodeId;
  nodeType?: string;
  durationMs?: number;
  cacheHit?: boolean;
}>;

type ExecWorkerSuccess = Readonly<{
  result: ExecEvaluationResult;
  execState: ExecState;
}>;

type ActiveRequest = {
  id: number;
  // eslint-disable-next-line no-unused-vars
  resolve: (result: ExecWorkerSuccess) => void;
  // eslint-disable-next-line no-unused-vars
  reject: (error: ExecError) => void;
  // eslint-disable-next-line no-unused-vars
  onProgress?: (progress: ExecWorkerProgress) => void;
};

const createWorker = (): Worker =>
  new Worker(new URL("../workers/exec-worker.ts", import.meta.url), {
    type: "module",
  });

export const createExecWorkerClient = () => {
  let worker: Worker | null = null;
  let active: ActiveRequest | null = null;
  let nextRequestId = 0;

  const handleMessage = (event: MessageEvent<ExecWorkerResponse>): void => {
    if (!active) {
      return;
    }
    const message = event.data;
    if (message.requestId !== active.id) {
      return;
    }
    if (message.type === "progress") {
      active.onProgress?.({
        completed: message.completed,
        total: message.total,
        nodeId: message.nodeId,
        nodeType: message.nodeType,
        durationMs: message.durationMs,
        cacheHit: message.cacheHit,
      });
      return;
    }
    if (message.type === "result") {
      const { resolve } = active;
      active = null;
      resolve({ result: message.result, execState: message.execState });
      return;
    }
    const { reject } = active;
    active = null;
    reject(message.error);
  };

  const ensureWorker = (): Worker => {
    if (!worker) {
      worker = createWorker();
      worker.onmessage = handleMessage;
    }
    return worker;
  };

  const cancel = (): void => {
    if (!active) {
      return;
    }
    const { reject } = active;
    active = null;
    if (worker) {
      worker.terminate();
      worker = null;
    }
    reject({ _tag: "ExecutionCanceled" });
  };

  const evaluate = (
    graph: Graph,
    socketId: SocketId,
    execState: ExecState,
    // eslint-disable-next-line no-unused-vars
    onProgress?: (progress: ExecWorkerProgress) => void,
  ): Promise<ExecWorkerSuccess> => {
    if (active) {
      cancel();
    }
    const requestId = (nextRequestId += 1);
    const workerInstance = ensureWorker();
    return new Promise((resolve, reject) => {
      active = {
        id: requestId,
        resolve,
        reject,
        onProgress,
      };
      const payload: ExecWorkerEvaluateRequest = {
        type: "evaluate",
        requestId,
        graph,
        socketId,
        execState,
      };
      workerInstance.postMessage(payload);
    });
  };

  return {
    evaluate,
    cancel,
  };
};
