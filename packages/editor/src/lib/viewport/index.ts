import { Container, ICanvas, IRenderer } from "pixi.js";
import { EventBus } from "../events/event-bus";
import { BusState, InteractionManager } from "../events/interaction-manager";
import { Grid } from "../graphics/grid/grid";
import { State } from "../state/state";

export type ApplicationState = {
  zoomFactor: number;
  dragOffset: {
    x: number;
    y: number;
  };
  dragStart: {
    x: number;
    y: number;
  };
};

export type ViewportConfig = {
  renderer: IRenderer<ICanvas>;
};

export class Viewport {
  renderer: IRenderer<ICanvas>;
  container: Container;
  grid: Grid;
  eventBus: EventBus<BusState>;
  state: State<ApplicationState>;
  interactionManager: InteractionManager;

  constructor(config: ViewportConfig) {
    this.renderer = config.renderer;
    this.container = new Container();
    this.container.name = "viewport";
    this.container.eventMode = "static"
    this.state = new State({
      zoomFactor: 1,
      dragOffset: {
        x: 0,
        y: 0,
      },
      dragStart: {
        x: 0,
        y: 0,
      },
    });
    this.eventBus = new EventBus();
    this.interactionManager = new InteractionManager(this.container, this.renderer, this.eventBus);
    this.grid = new Grid(this.renderer.view.width, this.renderer.view.height);
    this.container.addChild(this.grid.getMesh());
    const stage = new Container();
    stage.name = "stage";
    this.container.addChild(stage);


    this.setupEvents();
  }

  setupEvents() {
    this.eventBus.on("keydown:space", (value) => {
      if (this.renderer.view.style) {
        this.renderer.view.style.cursor = value ? "grab" : "default";
      }
    });

    this.eventBus.on("mousedown:middle", (value) => {
      if (this.renderer.view.style) {
        this.renderer.view.style.cursor = value ? "grab" : "default";
      }
    });

    this.eventBus.on("editor:dragDown", (coords) => {
      this.state.get("dragStart").x = coords.x;
      this.state.get("dragStart").y = coords.y;
    });

    this.eventBus.on("editor:dragXY", (coords) => {
      const deltaX = coords.x - this.state.get("dragStart").x;
      const deltaY = coords.y - this.state.get("dragStart").y;
      this.state.get("dragOffset").x += deltaX * this.state.get("zoomFactor");
      this.state.get("dragOffset").y += deltaY * this.state.get("zoomFactor");

      // Update grid position
      this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);

      // Update container position
      this.stage.position.x = this.state.get("dragOffset").x;
      this.stage.position.y = this.state.get("dragOffset").y;

      this.state.get("dragStart").x = coords.x;
      this.state.get("dragStart").y = coords.y;
    });

    this.eventBus.on("editor:dragX", (amount) => {
      this.state.get("dragOffset").x += amount * this.state.get("zoomFactor");

      // Update grid position
      this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);

      // Update container position
      this.stage.position.x = this.state.get("dragOffset").x;
    });

    this.eventBus.on("editor:dragY", (amount) => {
      this.state.get("dragOffset").y += amount * this.state.get("zoomFactor");

      // Update grid position
      this.grid.setUniform("u_offset", [this.state.get("dragOffset").x, this.state.get("dragOffset").y]);

      // Update container position
      this.stage.position.y = this.state.get("dragOffset").y;
    });
  }

  get stage(): Container {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    return  this.container.getChildByName<Container>("stage")!;
  }

  get viewport(): Container {
    return this.container;
  }

  get center(): { x: number; y: number } {
    return {
      x: this.renderer.view.width/ 4 + this.state.get("dragOffset").x,
      y: this.renderer.view.height / 4 + this.state.get("dragOffset").y,
    };
  }
}
