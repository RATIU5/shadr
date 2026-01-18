import type {
  Graph,
  GraphDocumentV1,
  GraphError,
  GraphId,
} from "@shadr/graph-core";
import {
  createGraph,
  graphFromDocumentV1,
  graphToDocumentV1,
} from "@shadr/graph-core";
import { Context, Effect, Layer } from "effect";

/* eslint-disable no-unused-vars */
export type GraphServiceApi = Readonly<{
  createGraph: (_graphId: GraphId) => Graph;
  graphFromDocument: (
    _document: GraphDocumentV1,
  ) => Effect.Effect<Graph, GraphError>;
  graphToDocument: (_graph: Graph) => GraphDocumentV1;
}>;
/* eslint-enable no-unused-vars */

export class GraphService extends Context.Tag("GraphService")<
  GraphService,
  GraphServiceApi
>() {}

export const GraphServiceLive = Layer.succeed(GraphService, {
  createGraph,
  graphFromDocument: graphFromDocumentV1,
  graphToDocument: graphToDocumentV1,
});

export const graphFromDocument = (
  document: GraphDocumentV1,
): Effect.Effect<Graph, GraphError> =>
  Effect.flatMap(GraphService, (service) =>
    service.graphFromDocument(document),
  );

export const graphToDocument = (graph: Graph): Effect.Effect<GraphDocumentV1> =>
  Effect.flatMap(GraphService, (service) =>
    Effect.sync(() => service.graphToDocument(graph)),
  );
