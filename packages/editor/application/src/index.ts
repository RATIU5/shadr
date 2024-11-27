import { EventBus } from "@shadr/editor-events";
import { Grid } from "@shadr/editor-grid";
import { Events } from "./types";
import { Container, Application as PixiApplication } from "pixi.js";

/**
 * The main application class for the Shadr editor.
 */
export class Application {
  #eventBus = new EventBus<Events>();
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
    this.#grid.init(this.#eventBus, {
      width: this.#pixiApp.renderer.width,
      height: this.#pixiApp.renderer.height,
    });
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

  /**
   * Handle the resize of the renderer
   */
  handleResize() {
    this.#pixiApp.renderer.resize(window.innerWidth, window.innerHeight);
  }

  /**
   * Emits a `raw:keydown` event with the key event object.
   * @param e key event
   */
  handleKeyDown(e: KeyboardEvent) {
    this.#eventBus.emit("raw:keydown", e);
  }

  /**
   * Emits a `raw:keyup` event with the key event object.
   * @param e key event
   */
  handleKeyUp(e: KeyboardEvent) {
    this.#eventBus.emit("raw:keyup", e);
  }

  /**
   * Emits a `raw:mousemove` event with the mouse event object.
   * @param e mouse event
   */
  handleMouseMove(e: MouseEvent) {
    this.#eventBus.emit("raw:mousemove", e);
  }

  /**
   *  Emits a `raw:mousedown` event with the mouse event object.
   * @param e mouse event
   */
  handleMouseDown(e: MouseEvent) {
    this.#eventBus.emit("raw:mousedown", e);
  }

  /**
   * Emits a `raw:mouseup` event with the mouse event object.
   * @param e mouse event
   */
  handleMouseUp(e: MouseEvent) {
    this.#eventBus.emit("raw:mouseup", e);
  }

  /**
   * Emits a `raw:mousewheel` event with the wheel event object.
   * @param e wheel event
   */
  handleMouseWheel(e: WheelEvent) {
    this.#eventBus.emit("raw:mousewheel", e);
  }
}
