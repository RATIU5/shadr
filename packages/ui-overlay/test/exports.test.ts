import { describe, expect, it } from "vitest";

import * as uiOverlay from "@shadr/ui-overlay";

describe("ui-overlay exports", () => {
  it("exposes no public exports yet", () => {
    expect(Object.keys(uiOverlay)).toEqual([]);
  });
});
