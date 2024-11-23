import { generateID } from "./utils.js";

export class Input<T extends string> {
  readonly id: string;
  readonly nodeId: string;
  readonly name: string;
  readonly type: T;

  constructor(nodeId: string, name: string, type: T) {
    this.id = generateID();
    this.nodeId = nodeId;
    this.name = name;
    this.type = type;
  }
}
