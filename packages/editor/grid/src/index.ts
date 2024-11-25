import { types } from "@shadr/common";

export const createGrid = <T extends {}>(
  options: types.Editor.Grid.SetupOptions<T>
): types.Editor.Grid.Grid => {
  const renderer = options.renderer;
  const eventBus = options.eventBus;

  renderer.createContainer((container) => {}, "gridContainer");

  return {
    render() {},
  };
};
