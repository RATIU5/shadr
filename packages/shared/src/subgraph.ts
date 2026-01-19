import type { GraphDocumentV1, JsonObject } from "./graph-schema.js";
import type { NodeId, SocketId } from "./identity.js";
import type { SocketTypeId } from "./socket-types.js";

export const SUBGRAPH_NODE_TYPE = "subgraph";
export const SUBGRAPH_INPUT_NODE_PREFIX = "subgraph-input:";
export const SUBGRAPH_INPUT_SOCKET_KEY = "value";
export const MAX_SUBGRAPH_DEPTH = 10;
export const MAX_SUBGRAPH_NODE_COUNT = 1000;
export const MAX_SUBGRAPH_TOTAL_NODES = 2000;

export const makeSubgraphInputNodeType = (dataType: SocketTypeId): string =>
  `${SUBGRAPH_INPUT_NODE_PREFIX}${dataType}`;

export type SubgraphInputMapping = Readonly<{
  key: string;
  nodeId: NodeId;
}>;

export type SubgraphOutputMapping = Readonly<{
  key: string;
  socketId: SocketId;
}>;

export type SubgraphPromotedParam = Readonly<{
  key: string;
  nodeId: NodeId;
  fieldId: string;
}>;

export type SubgraphParamOverrides = Readonly<Record<NodeId, JsonObject>>;

export type SubgraphNodeParams = Readonly<{
  graph: GraphDocumentV1;
  inputs: ReadonlyArray<SubgraphInputMapping>;
  outputs: ReadonlyArray<SubgraphOutputMapping>;
  promotedParams?: ReadonlyArray<SubgraphPromotedParam>;
  overrides?: SubgraphParamOverrides;
}>;
