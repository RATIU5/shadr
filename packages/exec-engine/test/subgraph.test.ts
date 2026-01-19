import { Either, Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  createExecState,
  evaluateSocket,
  getNodeErrors,
} from "@shadr/exec-engine";
import {
  addNode,
  addWire,
  createGraph,
  type GraphNode,
  type GraphSocket,
  type SocketId,
} from "@shadr/graph-core";
import type { NodeDefinition } from "@shadr/plugin-system";
import type { GraphDocumentV1, JsonObject } from "@shadr/shared";
import {
  GRAPH_DOCUMENT_V1_SCHEMA_VERSION,
  MAX_SUBGRAPH_DEPTH,
  SUBGRAPH_INPUT_SOCKET_KEY,
  SUBGRAPH_NODE_TYPE,
  makeGraphId,
  makeNodeId,
  makeSocketId,
  makeSubgraphInputNodeType,
  makeWireId,
} from "@shadr/shared";

const expectOk = <T>(effect: Effect.Effect<T, unknown>): T => {
  const result = Effect.runSync(Effect.either(effect));
  if (Either.isLeft(result)) {
    throw new Error(`Unexpected error: ${String(result.left)}`);
  }
  return result.right;
};

const resolveNodeDefinition = (
  nodeType: string,
): NodeDefinition | undefined => {
  if (nodeType === "const") {
    return {
      typeId: "const",
      label: "Const",
      description: "Constant value",
      inputs: [],
      outputs: [
        {
          key: "out",
          label: "Out",
          direction: "output",
          dataType: "float",
        },
      ],
      compute: (_inputs, params) => ({
        out: typeof params.value === "number" ? params.value : 0,
      }),
    };
  }
  if (nodeType === "add") {
    return {
      typeId: "add",
      label: "Add",
      description: "Adds two values",
      inputs: [
        { key: "a", label: "A", direction: "input", dataType: "float" },
        { key: "b", label: "B", direction: "input", dataType: "float" },
      ],
      outputs: [
        { key: "out", label: "Out", direction: "output", dataType: "float" },
      ],
      compute: (inputs) => ({
        out:
          (typeof inputs.a === "number" ? inputs.a : 0) +
          (typeof inputs.b === "number" ? inputs.b : 0),
      }),
    };
  }
  return undefined;
};

const createConstGraphDocument = (
  graphId: string,
  value: number,
): { document: GraphDocumentV1; outputSocketId: SocketId } => {
  const constNodeId = makeNodeId(`const-${graphId}`);
  const outputSocketId = makeSocketId(`${constNodeId}.out`);
  const node: GraphNode = {
    id: constNodeId,
    type: "const",
    position: { x: 0, y: 0 },
    params: { value } as JsonObject,
    inputs: [],
    outputs: [outputSocketId],
  };
  const socket: GraphSocket = {
    id: outputSocketId,
    nodeId: constNodeId,
    name: "out",
    direction: "output",
    dataType: "float",
    required: false,
  };
  return {
    document: {
      schemaVersion: GRAPH_DOCUMENT_V1_SCHEMA_VERSION,
      graphId: makeGraphId(graphId),
      nodes: [node],
      sockets: [socket],
      wires: [],
    },
    outputSocketId,
  };
};

const createNestedSubgraphDocument = (
  level: number,
): { document: GraphDocumentV1; outputSocketId: SocketId } => {
  if (level <= 0) {
    return createConstGraphDocument(`leaf-${Math.abs(level)}`, 1);
  }
  const inner = createNestedSubgraphDocument(level - 1);
  const subgraphNodeId = makeNodeId(`subgraph-${level}`);
  const outputSocketId = makeSocketId(`${subgraphNodeId}.out`);
  const node: GraphNode = {
    id: subgraphNodeId,
    type: SUBGRAPH_NODE_TYPE,
    position: { x: 0, y: 0 },
    params: {
      graph: inner.document,
      inputs: [],
      outputs: [{ key: "out", socketId: inner.outputSocketId }],
    } as JsonObject,
    inputs: [],
    outputs: [outputSocketId],
  };
  const socket: GraphSocket = {
    id: outputSocketId,
    nodeId: subgraphNodeId,
    name: "out",
    direction: "output",
    dataType: "float",
    required: false,
  };
  return {
    document: {
      schemaVersion: GRAPH_DOCUMENT_V1_SCHEMA_VERSION,
      graphId: makeGraphId(`graph-${level}`),
      nodes: [node],
      sockets: [socket],
      wires: [],
    },
    outputSocketId,
  };
};

describe("subgraph evaluation", () => {
  it("evaluates a collapsed subgraph node", () => {
    const internalInputNodeId = makeNodeId("sub-in");
    const internalInputSocketId = makeSocketId(
      `${internalInputNodeId}.${SUBGRAPH_INPUT_SOCKET_KEY}`,
    );
    const internalConstNodeId = makeNodeId("const");
    const internalConstSocketId = makeSocketId(`${internalConstNodeId}.out`);
    const internalAddNodeId = makeNodeId("add");
    const internalAddInputA = makeSocketId(`${internalAddNodeId}.a`);
    const internalAddInputB = makeSocketId(`${internalAddNodeId}.b`);
    const internalAddOutput = makeSocketId(`${internalAddNodeId}.out`);

    const internalNodes: GraphNode[] = [
      {
        id: internalInputNodeId,
        type: makeSubgraphInputNodeType("float"),
        position: { x: 0, y: 0 },
        params: {},
        inputs: [],
        outputs: [internalInputSocketId],
      },
      {
        id: internalConstNodeId,
        type: "const",
        position: { x: 120, y: 0 },
        params: { value: 3 } as JsonObject,
        inputs: [],
        outputs: [internalConstSocketId],
      },
      {
        id: internalAddNodeId,
        type: "add",
        position: { x: 240, y: 0 },
        params: {},
        inputs: [internalAddInputA, internalAddInputB],
        outputs: [internalAddOutput],
      },
    ];

    const internalSockets: GraphSocket[] = [
      {
        id: internalInputSocketId,
        nodeId: internalInputNodeId,
        name: SUBGRAPH_INPUT_SOCKET_KEY,
        direction: "output",
        dataType: "float",
        required: false,
      },
      {
        id: internalConstSocketId,
        nodeId: internalConstNodeId,
        name: "out",
        direction: "output",
        dataType: "float",
        required: false,
      },
      {
        id: internalAddInputA,
        nodeId: internalAddNodeId,
        name: "a",
        direction: "input",
        dataType: "float",
        required: true,
      },
      {
        id: internalAddInputB,
        nodeId: internalAddNodeId,
        name: "b",
        direction: "input",
        dataType: "float",
        required: true,
      },
      {
        id: internalAddOutput,
        nodeId: internalAddNodeId,
        name: "out",
        direction: "output",
        dataType: "float",
        required: false,
      },
    ];

    const internalWires = [
      {
        id: makeWireId("wire-in"),
        fromSocketId: internalInputSocketId,
        toSocketId: internalAddInputA,
      },
      {
        id: makeWireId("wire-const"),
        fromSocketId: internalConstSocketId,
        toSocketId: internalAddInputB,
      },
    ];

    const subgraphDocument = {
      schemaVersion: GRAPH_DOCUMENT_V1_SCHEMA_VERSION,
      graphId: makeGraphId("internal"),
      nodes: internalNodes,
      sockets: internalSockets,
      wires: internalWires,
    };

    const subgraphParams = {
      graph: subgraphDocument,
      inputs: [{ key: "in", nodeId: internalInputNodeId }],
      outputs: [{ key: "out", socketId: internalAddOutput }],
    };

    const subgraphNodeId = makeNodeId("subgraph");
    const subgraphInputSocketId = makeSocketId(`${subgraphNodeId}.in`);
    const subgraphOutputSocketId = makeSocketId(`${subgraphNodeId}.out`);

    const subgraphNode: GraphNode = {
      id: subgraphNodeId,
      type: SUBGRAPH_NODE_TYPE,
      position: { x: 0, y: 0 },
      params: subgraphParams as unknown as JsonObject,
      inputs: [subgraphInputSocketId],
      outputs: [subgraphOutputSocketId],
    };

    const subgraphSockets: GraphSocket[] = [
      {
        id: subgraphInputSocketId,
        nodeId: subgraphNodeId,
        name: "in",
        direction: "input",
        dataType: "float",
        required: true,
      },
      {
        id: subgraphOutputSocketId,
        nodeId: subgraphNodeId,
        name: "out",
        direction: "output",
        dataType: "float",
        required: false,
      },
    ];

    const externalNodeId = makeNodeId("external");
    const externalOutId = makeSocketId(`${externalNodeId}.out`);
    const externalNode: GraphNode = {
      id: externalNodeId,
      type: "const",
      position: { x: -120, y: 0 },
      params: { value: 2 } as JsonObject,
      inputs: [],
      outputs: [externalOutId],
    };
    const externalSockets: GraphSocket[] = [
      {
        id: externalOutId,
        nodeId: externalNodeId,
        name: "out",
        direction: "output",
        dataType: "float",
        required: false,
      },
    ];

    let graph = createGraph(makeGraphId("main"));
    graph = expectOk(addNode(graph, externalNode, externalSockets));
    graph = expectOk(addNode(graph, subgraphNode, subgraphSockets));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("wire-external"),
        fromSocketId: externalOutId,
        toSocketId: subgraphInputSocketId,
      }),
    );

    const value = expectOk(
      evaluateSocket(graph, subgraphOutputSocketId, resolveNodeDefinition),
    );
    expect(value).toBe(5);
  });

  it("applies promoted params from subgraph inputs", () => {
    const internalConstNodeId = makeNodeId("sub-const");
    const internalConstSocketId = makeSocketId(`${internalConstNodeId}.out`);
    const internalNode: GraphNode = {
      id: internalConstNodeId,
      type: "const",
      position: { x: 0, y: 0 },
      params: { value: 2 } as JsonObject,
      inputs: [],
      outputs: [internalConstSocketId],
    };
    const internalSocket: GraphSocket = {
      id: internalConstSocketId,
      nodeId: internalConstNodeId,
      name: "out",
      direction: "output",
      dataType: "float",
      required: false,
    };
    const subgraphDocument: GraphDocumentV1 = {
      schemaVersion: GRAPH_DOCUMENT_V1_SCHEMA_VERSION,
      graphId: makeGraphId("promoted"),
      nodes: [internalNode],
      sockets: [internalSocket],
      wires: [],
    };

    const subgraphNodeId = makeNodeId("subgraph-promoted");
    const subgraphInputSocketId = makeSocketId(`${subgraphNodeId}.value`);
    const subgraphOutputSocketId = makeSocketId(`${subgraphNodeId}.out`);
    const subgraphNode: GraphNode = {
      id: subgraphNodeId,
      type: SUBGRAPH_NODE_TYPE,
      position: { x: 0, y: 0 },
      params: {
        graph: subgraphDocument,
        inputs: [],
        outputs: [{ key: "out", socketId: internalConstSocketId }],
        promotedParams: [
          { key: "value", nodeId: internalConstNodeId, fieldId: "value" },
        ],
      } as JsonObject,
      inputs: [subgraphInputSocketId],
      outputs: [subgraphOutputSocketId],
    };
    const subgraphSockets: GraphSocket[] = [
      {
        id: subgraphInputSocketId,
        nodeId: subgraphNodeId,
        name: "value",
        direction: "input",
        dataType: "float",
        required: false,
      },
      {
        id: subgraphOutputSocketId,
        nodeId: subgraphNodeId,
        name: "out",
        direction: "output",
        dataType: "float",
        required: false,
      },
    ];

    const outerConstNodeId = makeNodeId("outer-const");
    const outerConstSocketId = makeSocketId(`${outerConstNodeId}.out`);
    const outerNode: GraphNode = {
      id: outerConstNodeId,
      type: "const",
      position: { x: 0, y: 0 },
      params: { value: 5 } as JsonObject,
      inputs: [],
      outputs: [outerConstSocketId],
    };
    const outerSocket: GraphSocket = {
      id: outerConstSocketId,
      nodeId: outerConstNodeId,
      name: "out",
      direction: "output",
      dataType: "float",
      required: false,
    };

    let graph = createGraph();
    graph = expectOk(addNode(graph, subgraphNode, subgraphSockets));
    graph = expectOk(addNode(graph, outerNode, [outerSocket]));
    graph = expectOk(
      addWire(graph, {
        id: makeWireId("wire-promoted"),
        fromSocketId: outerConstSocketId,
        toSocketId: subgraphInputSocketId,
      }),
    );

    const result = expectOk(
      evaluateSocket(graph, subgraphOutputSocketId, resolveNodeDefinition),
    );
    expect(result).toBe(5);
  });

  it("applies per-instance param overrides", () => {
    const inner = createConstGraphDocument("override", 2);
    const innerNodeId = inner.document.nodes[0]?.id ?? makeNodeId("inner");
    const subgraphNodeId = makeNodeId("subgraph-override");
    const outputSocketId = makeSocketId(`${subgraphNodeId}.out`);

    const subgraphNode: GraphNode = {
      id: subgraphNodeId,
      type: SUBGRAPH_NODE_TYPE,
      position: { x: 0, y: 0 },
      params: {
        graph: inner.document,
        inputs: [],
        outputs: [{ key: "out", socketId: inner.outputSocketId }],
        overrides: {
          [innerNodeId]: { value: 7 },
        },
      } as JsonObject,
      inputs: [],
      outputs: [outputSocketId],
    };

    const subgraphSocket: GraphSocket = {
      id: outputSocketId,
      nodeId: subgraphNodeId,
      name: "out",
      direction: "output",
      dataType: "float",
      required: false,
    };

    let graph = createGraph(makeGraphId("main-override"));
    graph = expectOk(addNode(graph, subgraphNode, [subgraphSocket]));

    const value = expectOk(
      evaluateSocket(graph, outputSocketId, resolveNodeDefinition),
    );
    expect(value).toBe(7);
  });

  it("prevents subgraph recursion by graph id", () => {
    const inner = createConstGraphDocument("loop", 2);
    const subgraphNodeId = makeNodeId("subgraph-loop");
    const outputSocketId = makeSocketId(`${subgraphNodeId}.out`);

    const subgraphNode: GraphNode = {
      id: subgraphNodeId,
      type: SUBGRAPH_NODE_TYPE,
      position: { x: 0, y: 0 },
      params: {
        graph: inner.document,
        inputs: [],
        outputs: [{ key: "out", socketId: inner.outputSocketId }],
      } as JsonObject,
      inputs: [],
      outputs: [outputSocketId],
    };

    const subgraphSocket: GraphSocket = {
      id: outputSocketId,
      nodeId: subgraphNodeId,
      name: "out",
      direction: "output",
      dataType: "float",
      required: false,
    };

    let graph = createGraph(makeGraphId("loop"));
    graph = expectOk(addNode(graph, subgraphNode, [subgraphSocket]));
    const state = createExecState();
    const value = expectOk(
      evaluateSocket(graph, outputSocketId, resolveNodeDefinition, state),
    );

    expect(value).toBeNull();
    const errors = getNodeErrors(state, subgraphNodeId);
    expect(errors).toHaveLength(1);
    expect(errors[0]?._tag).toBe("NodeComputeFailed");
  });

  it("blocks nested subgraphs beyond the depth limit", () => {
    const nested = createNestedSubgraphDocument(MAX_SUBGRAPH_DEPTH);
    const subgraphNodeId = makeNodeId("subgraph-depth");
    const outputSocketId = makeSocketId(`${subgraphNodeId}.out`);
    const subgraphNode: GraphNode = {
      id: subgraphNodeId,
      type: SUBGRAPH_NODE_TYPE,
      position: { x: 0, y: 0 },
      params: {
        graph: nested.document,
        inputs: [],
        outputs: [{ key: "out", socketId: nested.outputSocketId }],
      } as JsonObject,
      inputs: [],
      outputs: [outputSocketId],
    };
    const subgraphSocket: GraphSocket = {
      id: outputSocketId,
      nodeId: subgraphNodeId,
      name: "out",
      direction: "output",
      dataType: "float",
      required: false,
    };

    let graph = createGraph(makeGraphId("root-depth"));
    graph = expectOk(addNode(graph, subgraphNode, [subgraphSocket]));
    const state = createExecState();
    const value = expectOk(
      evaluateSocket(graph, outputSocketId, resolveNodeDefinition, state),
    );

    expect(value).toBeNull();
    const errors = getNodeErrors(state, subgraphNodeId);
    expect(errors).toHaveLength(1);
    expect(errors[0]?._tag).toBe("NodeComputeFailed");
  });
});
