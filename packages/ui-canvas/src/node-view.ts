import type { GraphNode, NodeId } from "@shadr/graph-core";
import * as PIXI from "pixi.js";

import type { NodeLayout } from "./layout.js";
import { getNodeHeaderToggleBounds, getNodeSize } from "./layout.js";
import type { CanvasTheme } from "./theme.js";
const SOCKET_RADIUS = 4;
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
  private theme: CanvasTheme;
  private state: NodeVisualState = DEFAULT_VISUAL_STATE;
  private lastTitle: string | null = null;

  constructor(node: GraphNode, layout: NodeLayout, theme: CanvasTheme) {
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
        fill: theme.node.headerText,
      },
    });
    this.titleText.anchor.set(0, 0.5);
    this.toggleText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif",
        fontSize: 10,
        fill: theme.node.headerText,
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
    this.theme = theme;
    this.update(node, layout, DEFAULT_VISUAL_STATE, theme);
  }

  update(
    node: GraphNode,
    layout: NodeLayout,
    state: NodeVisualState = DEFAULT_VISUAL_STATE,
    theme: CanvasTheme = this.theme,
  ): void {
    this.layout = layout;
    this.state = state;
    this.theme = theme;
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
      this.theme,
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
    const socketFill = this.state.bypassed
      ? this.theme.node.socketBypassedFill
      : this.theme.node.socketFill;
    const socketStroke = this.state.bypassed
      ? this.theme.node.socketBypassedStroke
      : this.theme.node.socketStroke;
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
    const headerFill = this.state.bypassed
      ? this.theme.node.headerBypassedFill
      : this.theme.node.headerFill;
    const textColor = this.state.bypassed
      ? this.theme.node.headerTextMuted
      : this.theme.node.headerText;
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
      this.headerIcons.fill(this.theme.node.badgeError);
      badgeX -= BADGE_RADIUS * 2 + 4;
    }
    if (this.state.bypassed) {
      this.headerIcons.circle(badgeX, badgeY, BADGE_RADIUS);
      this.headerIcons.fill(this.theme.node.badgeBypass);
    }
  }
}

const resolveBodyStyle = (
  state: NodeVisualState,
  theme: CanvasTheme,
): {
  fillColor: number;
  strokeColor: number;
  strokeWidth: number;
} => {
  if (state.hasError) {
    return {
      fillColor: state.bypassed ? theme.node.bypassedFill : theme.node.fill,
      strokeColor: theme.node.errorStroke,
      strokeWidth: 3,
    };
  }
  if (state.selected) {
    return {
      fillColor: state.bypassed ? theme.node.bypassedFill : theme.node.fill,
      strokeColor: theme.node.selectedStroke,
      strokeWidth: 3,
    };
  }
  if (state.hovered) {
    return {
      fillColor: state.bypassed ? theme.node.bypassedFill : theme.node.fill,
      strokeColor: theme.node.hoveredStroke,
      strokeWidth: 2,
    };
  }
  if (state.bypassed) {
    return {
      fillColor: theme.node.bypassedFill,
      strokeColor: theme.node.bypassedStroke,
      strokeWidth: 2,
    };
  }
  return {
    fillColor: theme.node.fill,
    strokeColor: theme.node.stroke,
    strokeWidth: 2,
  };
};
