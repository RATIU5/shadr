import * as PIXI from "pixi.js";
import { Node } from "./node";

export class NodeEditor {
  private app: PIXI.Application;
  private nodes: Map<number, Node>;
  private isMouseDown: boolean;
  private element: HTMLCanvasElement;
  private resizeTimeout: number;

  constructor(element: HTMLCanvasElement) {
    const rect = element.getBoundingClientRect();
    this.app = new PIXI.Application({
      view: element,
      width: rect.width,
      height: rect.height,
    });
    this.nodes = new Map();
    this.isMouseDown = false;
    this.element = element;
    this.resizeTimeout = 0;

    // this.interactionManager = new InteractionManager(this);
    this.setupEventListeners();

    this.app.ticker.add(() => this.update.bind(this));

    this.addNode(new Node(1, { x: 10, y: 10 }, { x: 100, y: 100 }));
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

  onResize() {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = setTimeout(() => {
      const rect = this.element.getBoundingClientRect();
      this.app.renderer.resize(rect.width, rect.height);
    }, 250);
  }

  getNodeFromEvent(event) {}

  calculateNewPosition(event, node) {}

  addNode(node: Node) {
    this.nodes.set(node.getId(), node);
  }

  removeNode(nodeId) {}

  connectNodes(outputNode, inputNode, outputPort, inputPort) {}

  update() {}

  onNodeSelect(node) {}

  onNodeDrag(node, newPosition) {}
}
