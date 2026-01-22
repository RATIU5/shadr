import { describe, expect, it } from "vitest";

import { Camera2D } from "@shadr/ui-canvas";

describe("Camera2D", () => {
  it("round-trips world and screen coordinates", () => {
    const camera = new Camera2D({ center: { x: 10, y: -5 }, zoom: 2 });
    camera.setViewportSize({ width: 200, height: 100 });

    const world = { x: 20, y: 5 };
    const screen = camera.worldToScreen(world);
    const worldBack = camera.screenToWorld(screen);

    expect(worldBack.x).toBeCloseTo(world.x, 6);
    expect(worldBack.y).toBeCloseTo(world.y, 6);
  });

  it("accounts for device pixels when requested", () => {
    const camera = new Camera2D({ center: { x: 0, y: 0 }, zoom: 1 });
    camera.setViewportSize(
      { width: 200, height: 100 },
      { devicePixels: true, pixelRatio: 2 },
    );

    const screen = camera.worldToScreen({ x: 0, y: 0 }, { devicePixels: true });
    expect(screen.x).toBeCloseTo(100, 6);
    expect(screen.y).toBeCloseTo(50, 6);

    const world = camera.screenToWorld(
      { x: 100, y: 50 },
      { devicePixels: true },
    );
    expect(world.x).toBeCloseTo(0, 6);
    expect(world.y).toBeCloseTo(0, 6);
  });

  it("keeps the world point fixed when zooming at a screen point", () => {
    const camera = new Camera2D({ center: { x: 0, y: 0 }, zoom: 1 });
    camera.setViewportSize({ width: 200, height: 100 });

    const screenPoint = { x: 30, y: 40 };
    const worldBefore = camera.screenToWorld(screenPoint);
    camera.zoomAt(screenPoint, 2);
    const worldAfter = camera.screenToWorld(screenPoint);

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6);
  });

  it("derives world bounds and transform from center and zoom", () => {
    const camera = new Camera2D({ center: { x: 10, y: 20 }, zoom: 2 });
    camera.setViewportSize({ width: 200, height: 100 });

    const bounds = camera.getWorldBounds();
    expect(bounds.minX).toBeCloseTo(-40, 6);
    expect(bounds.maxX).toBeCloseTo(60, 6);
    expect(bounds.minY).toBeCloseTo(-5, 6);
    expect(bounds.maxY).toBeCloseTo(45, 6);

    const transform = camera.getWorldTransform();
    expect(transform.position.x).toBeCloseTo(80, 6);
    expect(transform.position.y).toBeCloseTo(10, 6);
    expect(transform.scale).toBeCloseTo(2, 6);
  });
});
