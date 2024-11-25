import * as types from "~/types";

export type SetupOptions<T extends {}> = {
  renderer: types.Editor.Renderer.Renderer;
  eventBus: types.Editor.Events.EventBus<T>;
};

export type Grid = {
  render: () => void;
};
