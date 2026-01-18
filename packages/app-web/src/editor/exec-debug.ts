import type { ExecError, ExecEvaluationStats } from "@shadr/exec-engine";
import type { NodeId, SocketId } from "@shadr/graph-core";

export type ExecDebugNodeError = Readonly<{
  nodeId: NodeId;
  tags: ReadonlyArray<string>;
}>;

export type ExecDebugEntry =
  | Readonly<{
      id: number;
      timestamp: number;
      outputSocketId: SocketId;
      status: "success";
      stats: ExecEvaluationStats;
      nodeErrors: ReadonlyArray<ExecDebugNodeError>;
    }>
  | Readonly<{
      id: number;
      timestamp: number;
      outputSocketId: SocketId;
      status: "error";
      error: ExecError;
    }>;
