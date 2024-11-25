import { types, utils } from "@shadr/common";
import { Application, Container } from "pixi.js";

/**
 * Create a new renderer for Shadr, using PIXI.js under the hood
 * @param param0 options for setting up the renderer
 * @returns
 */
export const createRenderer = async ({
  width,
  height,
}: types.Editor.Renderer.SetupOptions): Promise<types.Editor.Renderer.Renderer> => {
  let pixiApp: Application;

  try {
    pixiApp = new Application();
    await pixiApp.init({
      preference: "webgpu",
      width,
      height,
      hello: false,
      antialias: true,
      powerPreference: "high-performance",
      resolution: window.devicePixelRatio ?? 1,
    });
  } catch (err) {
    throw err;
  }

  return {
    /**
     * Get the canvas element of the pixi.js renderer.
     */
    get canvas() {
      return pixiApp?.canvas;
    },

    createContainer: (fnCallback, name) => {
      const container = new Container();
      container.label = name ?? utils.randomString();
      fnCallback(container);
      pixiApp.stage.addChild(container);
    },

    /**
     * Resize the renderer to the specified dimensions.
     * @param param0 the resize options
     */
    resize: ({ width, height, resolution }) => {
      pixiApp.renderer.resize(width, height, resolution);
    },

    /**
     * Destroy the renderer.
     */
    destroy: () => {
      pixiApp.destroy();
    },
  };
};
