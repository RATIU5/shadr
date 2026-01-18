import type { Point } from "./types.js";

export type WireControlPoints = Readonly<{ cp1: Point; cp2: Point }>;

const MIN_CURVE = 80;
const CURVE_FACTOR = 0.5;

export const getWireControlPoints = (
  from: Point,
  to: Point,
): WireControlPoints => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const curve = Math.max(MIN_CURVE, distance * CURVE_FACTOR);
  const direction = dx >= 0 ? 1 : -1;
  return {
    cp1: { x: from.x + curve * direction, y: from.y },
    cp2: { x: to.x - curve * direction, y: to.y },
  };
};

export const getBezierPoint = (
  from: Point,
  cp1: Point,
  cp2: Point,
  to: Point,
  t: number,
): Point => {
  const inv = 1 - t;
  const inv2 = inv * inv;
  const inv3 = inv2 * inv;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: inv3 * from.x + 3 * inv2 * t * cp1.x + 3 * inv * t2 * cp2.x + t3 * to.x,
    y: inv3 * from.y + 3 * inv2 * t * cp1.y + 3 * inv * t2 * cp2.y + t3 * to.y,
  };
};
