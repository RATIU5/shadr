import { Application, Container, Graphics, IPointData } from "pixi.js";
import { Node } from "./node";
import { Draggable } from "./draggable";
import { Grid } from "./grid";
import {
  MouseDownEvent,
  MouseMoveEvent,
  MouseUpEvent,
  ResizeEvent,
} from "./events";

export class NodeEditor {
  private app: Application;
  private isDragging: boolean;
  private resizeTimeout: number;
  private selectedDraggable: Draggable | null;
  private allDraggables: Map<number, Draggable>;
  private dragOffset: IPointData | null;
  private grid: Grid;

  constructor(canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    this.app = new Application({
      view: canvas,
      width: rect.width,
      height: rect.height,
      autoDensity: true,
      antialias: true,
      backgroundColor: 0x1a1b1c,
      resolution: window.devicePixelRatio || 1,
    });
    this.allDraggables = new Map();
    this.isDragging = false;
    this.resizeTimeout = 0;
    this.selectedDraggable = null;
    this.dragOffset = null;

    console.log(this.app.view.getBoundingClientRect!());
    this.grid = new Grid(this.app);
    this.app.stage.addChild(this.grid.getGraphics());

    this.onResize();
    this.addEventListeners();
    this.grid.drawGrid();

    // this.addNode(new Node(1, { x: 100, y: 100 }, { x: 100, y: 200 }));
  }

  addEventListeners() {
    MouseDownEvent.addCallback(this.onMouseDown.bind(this));
    MouseUpEvent.addCallback(this.onMouseUp.bind(this));
    MouseMoveEvent.addCallback(this.onMouseMove.bind(this));
    ResizeEvent.addCallback(this.onResize.bind(this));
  }

  addNode(node: Node) {
    this.app.stage.addChild(node.getGraphics());
    this.allDraggables.set(node.getId(), node);
  }

  onMouseDown(event: Event) {
    const mousePosition = this.getMousePosition(event as MouseEvent);
    this.selectedDraggable = this.findDraggableAt(mousePosition);

    if (this.selectedDraggable) {
      this.isDragging = true;
      const draggableArea = this.selectedDraggable.getGraphics();
      this.dragOffset = {
        x: mousePosition.x - draggableArea.x,
        y: mousePosition.y - draggableArea.y,
      };
    }
  }

  onMouseUp() {
    this.isDragging = false;
    this.selectedDraggable = null;
    this.dragOffset = null;
  }

  onMouseMove(event: Event) {
    if (this.isDragging && this.selectedDraggable) {
      const newPosition: IPointData = this.getMousePosition(
        event as MouseEvent,
      );

      // Apply the offset to keep the cursor position consistent
      this.selectedDraggable.updatePosition({
        x: newPosition.x - (this.dragOffset?.x || 0),
        y: newPosition.y - (this.dragOffset?.y || 0),
      });
    }
  }

  onResize() {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = setTimeout(() => {
      this.app.renderer.resize(
        this.app.view.offsetWidth,
        this.app.view.offsetHeight,
      );
      this.app.view.style!.width = `${window.innerWidth}px`;
      this.app.view.style!.height = `${window.innerHeight}px`;
    }, 100);
  }

  getMousePosition(event: MouseEvent): IPointData {
    return { x: event.clientX, y: event.clientY };
  }

  private findDraggableAt(position: IPointData): Draggable | null {
    for (const draggable of this.allDraggables.values()) {
      const area = draggable.getGraphics();

      // Check if the position is within the draggable's interactive area
      if (this.isPositionInsideArea(position, area)) {
        return draggable;
      }
    }
    return null;
  }

  private isPositionInsideArea(
    position: IPointData,
    area: Container | Graphics,
  ): boolean {
    const bounds = area.getBounds();
    return (
      position.x >= bounds.x &&
      position.x <= bounds.x + bounds.width &&
      position.y >= bounds.y &&
      position.y <= bounds.y + bounds.height
    );
  }
}
