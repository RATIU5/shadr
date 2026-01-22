import { describe, expect, it } from "vitest";

import { getBezierPoint, getWireControlPoints } from "../src/wire-geometry.js";

describe("wire geometry", () => {
  it("keeps control points aligned horizontally with endpoints", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 40 };
    const { cp1, cp2 } = getWireControlPoints(from, to);

    expect(cp1.y).toBe(from.y);
    expect(cp2.y).toBe(to.y);
    expect(cp1.x).toBeGreaterThan(from.x);
    expect(cp2.x).toBeLessThan(to.x);
  });

  it("mirrors the curve direction when wires run right-to-left", () => {
    const from = { x: 100, y: 0 };
    const to = { x: 0, y: 0 };
    const { cp1, cp2 } = getWireControlPoints(from, to);

    expect(cp1.x).toBeLessThan(from.x);
    expect(cp2.x).toBeGreaterThan(to.x);
  });

  it("uses a minimum curve distance for short wires", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 10, y: 0 };
    const { cp1, cp2 } = getWireControlPoints(from, to);

    expect(Math.abs(cp1.x - from.x)).toBeGreaterThanOrEqual(80);
    expect(Math.abs(to.x - cp2.x)).toBeGreaterThanOrEqual(80);
  });

  it("returns endpoints for bezier interpolation", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 10, y: 10 };
    const cp1 = { x: 5, y: 0 };
    const cp2 = { x: 5, y: 10 };

    const start = getBezierPoint(from, cp1, cp2, to, 0);
    const end = getBezierPoint(from, cp1, cp2, to, 1);

    expect(start).toEqual(from);
    expect(end).toEqual(to);
  });
});
