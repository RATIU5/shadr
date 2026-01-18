import { Brand } from "effect";

export type NodeId = Brand.Branded<string, "NodeId">;
export const makeNodeId = Brand.nominal<NodeId>();

export type SocketId = Brand.Branded<string, "SocketId">;
export const makeSocketId = Brand.nominal<SocketId>();

export type WireId = Brand.Branded<string, "WireId">;
export const makeWireId = Brand.nominal<WireId>();

export type GraphId = Brand.Branded<string, "GraphId">;
export const makeGraphId = Brand.nominal<GraphId>();
