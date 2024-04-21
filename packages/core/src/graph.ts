import { Edge } from "./edge.js";
import { CoreError } from "./error.js";
import { Node } from "./node.js";

export class Graph {
  private nodes: Map<string, Node>;
  private edges: Set<Edge>;
  private edgeCombinations: Set<string>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Set();
    this.edgeCombinations = new Set();
  }

  addNode(node: Node): void {
    this.nodes.set(node.id, node);
  }

  removeNode(node: Node): void {
    this.nodes.delete(node.id);
  }

  addEdge(edge: Edge): void {
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

  removeEdge(edge: Edge): void {
    this.edges.delete(edge);
  }
}
