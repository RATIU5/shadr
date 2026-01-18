import type { GraphNode, NodeId } from "@shadr/graph-core";
import * as PIXI from "pixi.js";

import type { NodeLayout } from "./layout.js";
import { getNodeHeaderToggleBounds, getNodeSize } from "./layout.js";

const NODE_FILL = 0x1b1b1f;
const NODE_BYPASSED_FILL = 0x15151a;
const NODE_STROKE = 0x3c3c44;
const NODE_BYPASSED_STROKE = 0x565661;
const NODE_SELECTED_STROKE = 0x67d0ff;
const NODE_HOVER_STROKE = 0x7fb6ff;
const NODE_ERROR_STROKE = 0xff6a6a;
const SOCKET_FILL = 0x101014;
const SOCKET_STROKE = 0x7b7b86;
const SOCKET_BYPASSED_FILL = 0x0d0d12;
const SOCKET_BYPASSED_STROKE = 0x585862;
const SOCKET_RADIUS = 4;
const HEADER_FILL = 0x232734;
const HEADER_BYPASSED_FILL = 0x1a1f2b;
const HEADER_TEXT = 0xdce2f0;
const HEADER_TEXT_MUTED = 0xa5adbf;
const BADGE_ERROR = 0xff6a6a;
const BADGE_BYPASS = 0x7a7f90;
const BADGE_RADIUS = 3;

export type NodeVisualState = Readonly<{
  selected: boolean;
  hovered: boolean;
  bypassed: boolean;
  hasError: boolean;
  collapsed: boolean;
}>;

const DEFAULT_VISUAL_STATE: NodeVisualState = {
  selected: false,
  hovered: false,
  bypassed: false,
  hasError: false,
  collapsed: false,
};

export class NodeView {
  readonly id: NodeId;
  readonly container: PIXI.Container;
  private readonly body: PIXI.Graphics;
  private readonly header: PIXI.Graphics;
  private readonly headerIcons: PIXI.Graphics;
  private readonly sockets: PIXI.Graphics;
  private readonly titleText: PIXI.Text;
  private readonly toggleText: PIXI.Text;
  private layout: NodeLayout;
  private state: NodeVisualState = DEFAULT_VISUAL_STATE;
  private lastTitle: string | null = null;

  constructor(node: GraphNode, layout: NodeLayout) {
    this.id = node.id;
    this.container = new PIXI.Container();
    this.body = new PIXI.Graphics();
    this.header = new PIXI.Graphics();
    this.headerIcons = new PIXI.Graphics();
    this.sockets = new PIXI.Graphics();
    this.titleText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif",
        fontSize: 11,
        fill: HEADER_TEXT,
      },
    });
    this.titleText.anchor.set(0, 0.5);
    this.toggleText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif",
        fontSize: 10,
        fill: HEADER_TEXT,
      },
    });
    this.toggleText.anchor.set(0.5);
    this.container.addChild(this.body);
    this.container.addChild(this.header);
    this.container.addChild(this.sockets);
    this.container.addChild(this.headerIcons);
    this.container.addChild(this.titleText);
    this.container.addChild(this.toggleText);
    this.layout = layout;
    this.update(node, layout);
  }

  update(
    node: GraphNode,
    layout: NodeLayout,
    state: NodeVisualState = DEFAULT_VISUAL_STATE,
  ): void {
    this.layout = layout;
    this.state = state;
    this.container.x = node.position.x;
    this.container.y = node.position.y;
    this.drawBody(node);
    this.drawHeader(node);
    this.drawSockets(node);
  }

  destroy(): void {
    this.container.removeChildren();
  }

  private drawBody(node: GraphNode): void {
    const { width, height } = getNodeSize(node, this.layout);
    const { fillColor, strokeColor, strokeWidth } = resolveBodyStyle(
      this.state,
    );
    this.body.clear();
    if (this.layout.isRerouteNode?.(node)) {
      const radius = Math.max(2, Math.min(width, height) / 2 - strokeWidth / 2);
      this.body.circle(width / 2, height / 2, radius);
      this.body.fill(fillColor);
      this.body.stroke({
        width: strokeWidth,
        color: strokeColor,
        alpha: 1,
      });
      return;
    }
    this.body.rect(0, 0, width, height);
    this.body.fill(fillColor);
    this.body.stroke({
      width: strokeWidth,
      color: strokeColor,
      alpha: 1,
    });
  }

  private drawSockets(node: GraphNode): void {
    if (this.layout.isRerouteNode?.(node)) {
      this.sockets.clear();
      return;
    }
    this.sockets.clear();
    const socketFill = this.state.bypassed ? SOCKET_BYPASSED_FILL : SOCKET_FILL;
    const socketStroke = this.state.bypassed
      ? SOCKET_BYPASSED_STROKE
      : SOCKET_STROKE;
    const { width } = getNodeSize(node, this.layout);
    const startY =
      this.layout.headerHeight +
      this.layout.bodyPadding +
      this.layout.socketSpacing / 2;
    for (let index = 0; index < node.inputs.length; index += 1) {
      const y = startY + index * this.layout.socketSpacing;
      this.drawSocket(this.layout.socketOffsetX, y, socketFill, socketStroke);
    }
    for (let index = 0; index < node.outputs.length; index += 1) {
      const y = startY + index * this.layout.socketSpacing;
      this.drawSocket(
        width - this.layout.socketOffsetX,
        y,
        socketFill,
        socketStroke,
      );
    }
  }

  private drawSocket(x: number, y: number, fill: number, stroke: number): void {
    this.sockets.circle(x, y, SOCKET_RADIUS);
    this.sockets.fill(fill);
    this.sockets.stroke({ width: 1, color: stroke, alpha: 1 });
  }

  private drawHeader(node: GraphNode): void {
    if (this.layout.isRerouteNode?.(node)) {
      this.header.visible = false;
      this.headerIcons.visible = false;
      this.titleText.visible = false;
      this.toggleText.visible = false;
      return;
    }
    this.header.visible = true;
    this.headerIcons.visible = true;
    this.titleText.visible = true;
    this.toggleText.visible = true;
    const { width } = getNodeSize(node, this.layout);
    const headerHeight = this.layout.headerHeight;
    const headerFill = this.state.bypassed ? HEADER_BYPASSED_FILL : HEADER_FILL;
    const textColor = this.state.bypassed ? HEADER_TEXT_MUTED : HEADER_TEXT;
    this.header.clear();
    this.header.rect(0, 0, width, headerHeight);
    this.header.fill(headerFill);

    const title = this.layout.getNodeTitle?.(node) ?? node.type;
    if (title !== this.lastTitle) {
      this.titleText.text = title;
      this.lastTitle = title;
    }
    this.titleText.style.fill = textColor;

    const toggleBounds = getNodeHeaderToggleBounds(this.layout);
    this.toggleText.text = this.state.collapsed ? ">" : "v";
    this.toggleText.style.fill = textColor;
    this.toggleText.x = toggleBounds.x + toggleBounds.size / 2;
    this.toggleText.y = headerHeight / 2;

    const titleX = toggleBounds.x + toggleBounds.size + 6;
    this.titleText.x = titleX;
    this.titleText.y = headerHeight / 2;

    this.headerIcons.clear();
    let badgeX = width - 8 - BADGE_RADIUS;
    const badgeY = headerHeight / 2;
    if (this.state.hasError) {
      this.headerIcons.circle(badgeX, badgeY, BADGE_RADIUS);
      this.headerIcons.fill(BADGE_ERROR);
      badgeX -= BADGE_RADIUS * 2 + 4;
    }
    if (this.state.bypassed) {
      this.headerIcons.circle(badgeX, badgeY, BADGE_RADIUS);
      this.headerIcons.fill(BADGE_BYPASS);
    }
  }
}

const resolveBodyStyle = (
  state: NodeVisualState,
): {
  fillColor: number;
  strokeColor: number;
  strokeWidth: number;
} => {
  if (state.hasError) {
    return {
      fillColor: state.bypassed ? NODE_BYPASSED_FILL : NODE_FILL,
      strokeColor: NODE_ERROR_STROKE,
      strokeWidth: 3,
    };
  }
  if (state.selected) {
    return {
      fillColor: state.bypassed ? NODE_BYPASSED_FILL : NODE_FILL,
      strokeColor: NODE_SELECTED_STROKE,
      strokeWidth: 3,
    };
  }
  if (state.hovered) {
    return {
      fillColor: state.bypassed ? NODE_BYPASSED_FILL : NODE_FILL,
      strokeColor: NODE_HOVER_STROKE,
      strokeWidth: 2,
    };
  }
  if (state.bypassed) {
    return {
      fillColor: NODE_BYPASSED_FILL,
      strokeColor: NODE_BYPASSED_STROKE,
      strokeWidth: 2,
    };
  }
  return {
    fillColor: NODE_FILL,
    strokeColor: NODE_STROKE,
    strokeWidth: 2,
  };
};
