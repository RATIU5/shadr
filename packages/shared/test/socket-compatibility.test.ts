import { describe, expect, it } from "vitest";

import {
  Either,
  createSocketTypeCompatibilityMatrix,
  isSocketTypeCompatibleWithMatrix,
} from "@shadr/shared";

describe("socket type compatibility", () => {
  it("treats exact matches as compatible", () => {
    const result = createSocketTypeCompatibilityMatrix([]);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      const matrix = result.right;
      expect(isSocketTypeCompatibleWithMatrix(matrix, "float", "float")).toBe(
        true,
      );
      expect(isSocketTypeCompatibleWithMatrix(matrix, "float", "int")).toBe(
        false,
      );
    }
  });

  it("respects explicit compatibility entries", () => {
    const result = createSocketTypeCompatibilityMatrix([
      { fromType: "float", toType: "int" },
    ]);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      const matrix = result.right;
      expect(isSocketTypeCompatibleWithMatrix(matrix, "float", "int")).toBe(
        true,
      );
      expect(isSocketTypeCompatibleWithMatrix(matrix, "int", "float")).toBe(
        false,
      );
    }
  });

  it("rejects duplicate compatibility pairs", () => {
    const result = createSocketTypeCompatibilityMatrix([
      { fromType: "float", toType: "int" },
      { fromType: "float", toType: "int" },
    ]);
    expect(Either.isLeft(result)).toBe(true);
  });
});
