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
  }

  get() {
    return this.container;
  }
}
