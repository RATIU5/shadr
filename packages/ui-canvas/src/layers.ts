import * as PIXI from "pixi.js";

export type SceneLayers = Readonly<{
  root: PIXI.Container;
  world: PIXI.Container;
  grid: PIXI.Container;
  wires: PIXI.Container;
  nodes: PIXI.Container;
  overlays: PIXI.Container;
}>;

export const createSceneLayers = (): SceneLayers => {
  const root = new PIXI.Container();
  const world = new PIXI.Container();
  const grid = new PIXI.Container();
  const wires = new PIXI.Container();
  const nodes = new PIXI.Container();
  const overlays = new PIXI.Container();

  root.addChild(world);
  world.addChild(grid);
  world.addChild(wires);
  world.addChild(nodes);
  world.addChild(overlays);

  return { root, world, grid, wires, nodes, overlays };
};
