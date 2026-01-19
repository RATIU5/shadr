import type {
  ExecError,
  ExecEvaluationResult,
  ExecState,
} from "@shadr/exec-engine";
import type { Graph, NodeId, SocketId } from "@shadr/graph-core";

export type ExecWorkerEvaluateRequest = Readonly<{
  type: "evaluate";
  requestId: number;
  graph: Graph;
  socketId: SocketId;
  execState: ExecState;
}>;

export type ExecWorkerProgress = Readonly<{
  type: "progress";
  requestId: number;
  completed: number;
  total: number;
  nodeId?: NodeId;
  nodeType?: string;
  durationMs?: number;
  cacheHit?: boolean;
}>;

export type ExecWorkerResult = Readonly<{
  type: "result";
  requestId: number;
  result: ExecEvaluationResult;
  execState: ExecState;
}>;

export type ExecWorkerError = Readonly<{
  type: "error";
  requestId: number;
  error: ExecError;
}>;

export type ExecWorkerRequest = ExecWorkerEvaluateRequest;

export type ExecWorkerResponse =
  | ExecWorkerProgress
  | ExecWorkerResult
  | ExecWorkerError;
