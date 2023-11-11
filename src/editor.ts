import * as PIXI from "pixi.js";
import { Node } from "./node";
export class NodeEditor {
  private app: PIXI.Application;
  private nodes: Map<number, Node>;
  private isMouseDown: boolean;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.nodes = new Map();
    this.isMouseDown = false;

    // this.interactionManager = new InteractionManager(this);
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.app.view.addEventListener!("mousedown", this.onMouseDown.bind(this));
    this.app.view.addEventListener!("mouseup", this.onMouseUp.bind(this));
    this.app.view.addEventListener!("mousemove", this.onMouseMove.bind(this));
    window.addEventListener("resize", this.onResize.bind(this));
  }

  onMouseDown(event: Event) {
    this.isMouseDown = true;
  }

  onMouseUp(event: Event) {
    this.isMouseDown = false;
  }

  onMouseMove(event: Event) {
    if (this.isMouseDown) {
      // Calculate new position based on mouse movement
      // Redraw or update the node
    }
  }

  onResize(event: Event) {}

  getNodeFromEvent(event) {}

  calculateNewPosition(event, node) {}
  addNode(node) {}

  removeNode(nodeId) {}

  connectNodes(outputNode, inputNode, outputPort, inputPort) {}

  update() {}

  onNodeSelect(node) {}

  onNodeDrag(node, newPosition) {}
}
