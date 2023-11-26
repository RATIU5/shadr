import { Application, Container, Graphics, IPointData } from "pixi.js";
import { Node } from "./node";
import { Draggable } from "./draggable";
import { Grid } from "./grid";
import { Events } from "./events";

type Interactions = {
  zoomFactor: number;
  dragOffset: IPointData;
  minZoom: number;
  maxZoom: number;
  zoomSensitivity: number;
  isDragging: boolean;
  dragStart: IPointData;
};

export class NodeEditor {
  private interactions: Interactions;
  private gridOptions: GridOptions;
  private grid: Grid;
  private nodes: Node[];

  constructor(canvas: HTMLCanvasElement) {
    const app = new Application({
      view: canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      autoDensity: true,
      antialias: true,
      backgroundColor: 0x1a1b1c,
      resolution: window.devicePixelRatio || 1,
    });

    this.interactions = {
      zoomFactor: 1,
      dragOffset: { x: 0, y: 0 },
      minZoom: 0.5,
      maxZoom: 5,
      zoomSensitivity: 0.025,
      isDragging: false,
      dragStart: { x: 0, y: 0 },
    };

    // Needed to capture events
    app.stage.eventMode = "static";
    app.stage.on("mousedown", this.handleMouseDown.bind(this));
    app.stage.on("mouseup", this.handleMouseUp.bind(this));
    app.stage.on("mousemove", this.handleMouseMove.bind(this));
    app.stage.on("wheel", this.handkeMouseWheel.bind(this));

    this.grid = new Grid(app, this.gridOptions);
    app.stage.addChild(this.grid.getMesh());
  }

  handleMouseDown = (e) => {
    if (e.button === 0 || e.button === 1) {
      this.interactions.isDragging = true;
      this.interactions.dragStart = {
        x: e.clientX,
        y: e.clientY,
      };
    }
  };

  handleMouseUp = (e) => {
    this.interactions.isDragging = false;
  };

  handleMouseMove = (e) => {
    if (this.interactions.isDragging) {
      const deltaX = e.clientX - this.interactions.dragStart.x;
      const deltaY = e.clientY - this.interactions.dragStart.y;

      this.interactions.dragOffset.x += deltaX * this.interactions.zoomFactor;
      this.interactions.dragOffset.y += deltaY * this.interactions.zoomFactor;

      this.grid.setUniform("u_dragOffset", [
        this.interactions.dragOffset.x,
        this.interactions.dragOffset.y,
      ]);
      this.interactions.dragStart = { x: e.clientX, y: e.clientY };
    }
  };

  handkeMouseWheel = (e) => {
    this.interactions.zoomFactor *=
      e.deltaY > 0
        ? 1 - this.interactions.zoomSensitivity
        : 1 + this.interactions.zoomSensitivity;
    this.interactions.zoomFactor = Math.max(
      this.interactions.minZoom,
      Math.min(this.interactions.maxZoom, this.interactions.zoomFactor),
    );
    this.grid.setUniform("u_zoom", this.interactions.zoomFactor);
  };
}
