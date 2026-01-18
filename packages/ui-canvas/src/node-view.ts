import type { GraphNode, NodeId } from "@shadr/graph-core";
import * as PIXI from "pixi.js";

import type { NodeLayout } from "./layout.js";
import { getNodeSize } from "./layout.js";

const NODE_FILL = 0x1b1b1f;
const NODE_STROKE = 0x3c3c44;
const NODE_SELECTED_STROKE = 0x67d0ff;
const SOCKET_FILL = 0x101014;
const SOCKET_STROKE = 0x7b7b86;
const SOCKET_RADIUS = 4;

export class NodeView {
  readonly id: NodeId;
  readonly container: PIXI.Container;
  private readonly body: PIXI.Graphics;
  private readonly sockets: PIXI.Graphics;
  private layout: NodeLayout;
  private selected = false;

  constructor(node: GraphNode, layout: NodeLayout) {
    this.id = node.id;
    this.container = new PIXI.Container();
    this.body = new PIXI.Graphics();
    this.sockets = new PIXI.Graphics();
    this.container.addChild(this.body);
    this.container.addChild(this.sockets);
    this.layout = layout;
    this.update(node, layout);
  }

  update(node: GraphNode, layout: NodeLayout, selected = false): void {
    this.layout = layout;
    this.selected = selected;
    this.container.x = node.position.x;
    this.container.y = node.position.y;
    this.drawBody(node);
    this.drawSockets(node);
  }

  destroy(): void {
    this.container.removeChildren();
  }

  private drawBody(node: GraphNode): void {
    const { width, height } = getNodeSize(node, this.layout);
    this.body.clear();
    this.body.rect(0, 0, width, height);
    this.body.fill(NODE_FILL);
    this.body.stroke({
      width: 2,
      color: this.selected ? NODE_SELECTED_STROKE : NODE_STROKE,
      alpha: 1,
    });
  }

  private drawSockets(node: GraphNode): void {
    this.sockets.clear();
    const startY =
      this.layout.headerHeight +
      this.layout.bodyPadding +
      this.layout.socketSpacing / 2;
    for (let index = 0; index < node.inputs.length; index += 1) {
      const y = startY + index * this.layout.socketSpacing;
      this.drawSocket(this.layout.socketOffsetX, y);
    }
    for (let index = 0; index < node.outputs.length; index += 1) {
      const y = startY + index * this.layout.socketSpacing;
      this.drawSocket(this.layout.width - this.layout.socketOffsetX, y);
    }
  }

  private drawSocket(x: number, y: number): void {
    this.sockets.circle(x, y, SOCKET_RADIUS);
    this.sockets.fill(SOCKET_FILL);
    this.sockets.stroke({ width: 1, color: SOCKET_STROKE, alpha: 1 });
  }
}
