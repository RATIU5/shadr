import { generateID } from "./utils.js";

export class Port {
  readonly id: string;
  readonly name: string;
  private _edgeId: string | null = null;

  constructor(name: string) {
    this.id = generateID();
    this.name = name;
  }

  get edgeId(): string | null {
    return this._edgeId;
  }

  set edgeId(edgeId: string | null) {
    this._edgeId = edgeId;
  }
}
