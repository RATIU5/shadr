export type ErrorCodes =
  | "Edge:CannotUseSameNode"
  | "Edge:DifferentTypes"
  | "Graph:EdgeAlreadyExists";

export class CoreError extends Error {
  constructor(
    public readonly errorCode: ErrorCodes,
    public readonly message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = "CoreError";
  }

  toString(): string {
    return `[${this.errorCode}] ${this.message}${
      this.details ? `\nDetails: ${JSON.stringify(this.details)}` : ""
    }`;
  }

  toJSON(): Record<string, any> {
    return {
      errorCode: this.errorCode,
      message: this.message,
      details: this.details,
    };
  }
}
