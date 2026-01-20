import { describe, expect, it } from "vitest";

import * as devtools from "@shadr/devtools";

describe("devtools entrypoint", () => {
  it("loads without public exports yet", () => {
    expect(Object.keys(devtools)).toEqual([]);
  });
});
