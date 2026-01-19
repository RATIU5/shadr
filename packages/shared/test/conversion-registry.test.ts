import { describe, expect, it } from "vitest";

import {
  Either,
  createConversionRegistry,
  getConversionEntry,
  isSocketTypeCompatible,
  listConversionTargets,
  listConversionsFrom,
} from "@shadr/shared";

describe("conversion registry", () => {
  const entries = [
    {
      id: "convert-float-to-int",
      fromType: "float",
      toType: "int",
      nodeType: "convert-float-to-int",
      inputKey: "in",
      outputKey: "out",
    },
    {
      id: "convert-int-to-float",
      fromType: "int",
      toType: "float",
      nodeType: "convert-int-to-float",
      inputKey: "in",
      outputKey: "out",
    },
  ] as const;

  it("builds lookup tables for conversions", () => {
    const result = createConversionRegistry(entries);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      const registry = result.right;
      expect(listConversionsFrom(registry, "float")).toHaveLength(1);
      expect(listConversionTargets(registry, "float")).toEqual(["int"]);
      expect(
        getConversionEntry(registry, "float", "int")?.nodeType,
      ).toBe("convert-float-to-int");
    }
  });

  it("does not treat conversions as implicit compatibility", () => {
    const result = createConversionRegistry(entries);
    expect(Either.isRight(result)).toBe(true);
    expect(isSocketTypeCompatible("float", "int")).toBe(false);
  });
});
