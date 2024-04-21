import { generateID } from "./utils.js";

export class Input {
  readonly id: string;
  readonly nodeId: string;
  readonly name: string;
  readonly type: string;

  constructor(nodeId: string, name: string, type: string) {
    this.id = generateID();
    this.nodeId = nodeId;
    this.name = name;
    this.type = type;
  }
}
