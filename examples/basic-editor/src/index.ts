import { Edge, Graph, Input, Node, Output } from "@shadr/core";

type NodePortTypes = "float" | "int" | "vec2" | "vec3" | "vec4";

const graph = new Graph();

const node1 = new Node({
  type: "input",
  position: { x: 100, y: 100 },
  size: { width: 100, height: 100 },
});

const node2 = new Node({
  type: "output",
  position: { x: 300, y: 100 },
  size: { width: 100, height: 100 },
});

graph.addNode(node1);
graph.addNode(node2);

const edge = new Edge(
  new Output<NodePortTypes>(node1.id, "test1", "float"),
  new Input<NodePortTypes>(node2.id, "test2", "int")
);

graph.addEdge(edge);
