/// <reference types="@solidjs/start/env" />
/* eslint-disable no-unused-vars -- ambient declarations define shared globals */

import type { NodeId, SocketId, WireId } from "@shadr/graph-core";

type ShadrPoint = Readonly<{ x: number; y: number }>;

declare global {
  interface Window {
    __SHADR_TEST__?: {
      getNodeIds: () => ReadonlyArray<NodeId>;
      getWireIds: () => ReadonlyArray<WireId>;
      getNodePosition: (nodeId: NodeId) => ShadrPoint | null;
      getNodeScreenCenter: (nodeId: NodeId) => ShadrPoint | null;
      getSocketsForNode: (nodeId: NodeId) => Readonly<{
        inputs: ReadonlyArray<SocketId>;
        outputs: ReadonlyArray<SocketId>;
      }> | null;
      getSocketScreenPosition: (socketId: SocketId) => ShadrPoint | null;
    };
  }
}

export {};
/* eslint-enable no-unused-vars */
