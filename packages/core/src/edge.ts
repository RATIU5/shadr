import { CoreError } from "./error.js";
import { Input } from "./input.js";
import { Output } from "./output.js";
import { generateID } from "./utils.js";

export class Edge {
  readonly id: string;
  readonly source: Output;
  readonly target: Input;

  constructor(source: Output, target: Input) {
    this.id = generateID();

    if (source.nodeId === target.nodeId) {
      throw new CoreError(
        "Edge:CannotUseSameNode",
        "Cannot use the same node as source and target"
      );
    }

    if (source.type !== target.type) {
      throw new CoreError(
        "Edge:DifferentTypes",
        `Output type '${source.type}' does not match input type '${target.type}'`
      );
    }
    this.source = source;
    this.target = target;
  }
}
