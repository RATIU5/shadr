import { Input } from "./input.js";
import { Output } from "./output.js";
import { generateID } from "./utils.js";

export class Node<T extends string> {
  readonly id: string;
  readonly type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  inputs: Map<string, Input<T>>;
  outputs: Map<string, Output<T>>;

  constructor({
    type,
    position,
    size,
  }: {
    type: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }) {
    this.id = generateID();
    this.type = type;
    this.position = position;
    this.size = size;
    this.inputs = new Map();
    this.outputs = new Map();
  }

  addInput(input: Input<T>): void {
    this.inputs.set(input.name, input);
  }

  addOutput(output: Output<T>): void {
    this.outputs.set(output.name, output);
  }
}
