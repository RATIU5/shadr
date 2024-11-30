import { EventBus } from "@shadr/editor-events";
import { Grid } from "@shadr/editor-grid";
import { Container, Application as PixiApplication } from "pixi.js";
import { EventManager } from "./lib/event-manager";
import { Events } from "./lib/event-manager/types";
import { World } from "@shadr/editor-core";

/**
 * The main application class for the Shadr editor.
 */
export class Application {
  #world = new World();
  #eventBus = new EventBus<Events>();
  #eventManager = new EventManager(this.#eventBus, this.#world);
  #pixiApp = new PixiApplication();
  #grid = new Grid();

  constructor() {}

  async init(canvas: HTMLCanvasElement) {
    await this.#pixiApp.init({
      canvas,
      resizeTo: canvas,
      hello: false,
      preference: "webgl",
      preferWebGLVersion: 2,
      powerPreference: "high-performance",
      resolution: window.devicePixelRatio ?? 1,
    });
    this.#pixiApp.ticker.maxFPS = 60;
    this.#pixiApp.ticker.minFPS = 30;

    this.#world.resize(canvas.width, canvas.height);
    this.#grid.init(this.#eventBus, this.#world);
    const gridContainer = new Container({
      label: "GridContainer",
    });
    gridContainer.addChild(this.#grid.getMesh());

    this.#pixiApp.stage.addChild(gridContainer);
  }

  run() {
    const fpsCounter = { value: 0, frames: 0, lastUpdate: 0 };

    this.#pixiApp.ticker.add((deltaTime) => {
      const currentTime = performance.now();
      fpsCounter.frames++;

      if (currentTime - fpsCounter.lastUpdate >= 1000) {
        fpsCounter.value = fpsCounter.frames;
        fpsCounter.frames = 0;
        fpsCounter.lastUpdate = currentTime;
      }

      const delta = deltaTime.deltaTime / 60;

      this.update(delta);
    });
  }

  update(_: number) {
    // Fixed timestep game logic here
  }

  destroy() {
    this.#pixiApp?.destroy();
  }

  public events() {
    return this.#eventManager;
  }

  /**
   * Handle the resize of the renderer
   */
  handleResize() {
    this.#pixiApp.renderer.resize(window.innerWidth, window.innerHeight);
  }
}
