import { types } from "@shadr/common";
import { Application } from "pixi.js";

/**
 * The core renderer for the Shadr editor.
 *
 * This class is responsible for rendering the the editor's 2D graphics, such as the grid and nodes.
 *
 * This class does not handle rendering UI elements, such as buttons or text.
 * For UI elements, please check out the `@shadr/ui` package.
 */
export class ShadrRenderer {
  /**
   * The PIXI.js application instance, used for rendering.
   *
   * This is not the same as the `Application` type from `@shadr/application`,
   * although both packages work closely together.
   */
  #app: Application;

  constructor({ width, height }: types.Renderer.SetupOptions) {
    async function initPixi(app: Application) {
      await app.init({});
    }
    this.#app = new Application();
    try {
      initPixi(this.#app);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Get the canvas element used by the renderer.
   * @returns the canvas element used by the renderer
   */
  canvas() {
    if (!this.#app) {
      throw new Error("Application not initialized");
    }
    return this.#app.canvas;
  }

  /**
   * Resize the renderer to the specified width, height, and resolution.
   *
   * This method calls `renderer.resize` from PIXI.js.
   * @param param0 the width, height, and resolution of the renderer
   */
  resize({
    width,
    height,
    resolution,
  }: {
    width: number;
    height: number;
    resolution?: number;
  }) {
    this.#app.renderer.resize(width, height, resolution);
  }
}
