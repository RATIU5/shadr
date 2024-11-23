import { Edge } from "./edge.js";
import { CoreError } from "./error.js";
import { Node } from "./node.js";

export class Graph<T extends string> {
  private nodes: Map<string, Node<T>>;
  private edges: Set<Edge<T>>;
  private edgeCombinations: Set<string>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Set();
    this.edgeCombinations = new Set();
  }

  addNode(node: Node<T>): void {
    this.nodes.set(node.id, node);
  }

  removeNode(node: Node<T>): void {
    this.nodes.delete(node.id);
  }

  addEdge(edge: Edge<T>): void {
    const combination = `${edge.source.id}-${edge.target.id}`;
    if (this.edgeCombinations.has(combination)) {
      throw new CoreError(
        "Graph:EdgeAlreadyExists",
        "Duplicate edge combination"
      );
    }
    this.edges.add(edge);
    this.edgeCombinations.add(combination);
  }

  removeEdge(edge: Edge<T>): void {
    this.edges.delete(edge);
  }
}
