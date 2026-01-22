import type {
  GraphNode,
  GraphSocket,
  NodeId,
  SocketId,
} from "@shadr/graph-core";
import * as PIXI from "pixi.js";

import type { NodeLayout } from "./layout.js";
import { getNodeHeaderToggleBounds, getNodeSize } from "./layout.js";
import type { CanvasTheme } from "./theme.js";
const SOCKET_RADIUS = 4;
const SOCKET_TRIANGLE_HEIGHT_RATIO = 0.866;
const BADGE_RADIUS = 3;
const SOCKET_LABEL_FONT_SIZE = 9;
const SOCKET_LABEL_OFFSET = 8;
const SOCKET_LABEL_INNER_PADDING = 6;
const SOCKET_LABEL_CENTER_GUTTER = 10;
const SOCKET_LABEL_ELLIPSIS = "...";
const SOCKET_LABEL_CHAR_WIDTH_RATIO = 0.6;
const NODE_STROKE_WIDTH = 1;

export type NodeVisualState = Readonly<{
  selected: boolean;
  hovered: boolean;
  bypassed: boolean;
  hasError: boolean;
  collapsed: boolean;
}>;

export type NodeExecutionState = Readonly<{
  order: number;
  durationMs: number;
  maxDurationMs: number;
  cacheHit: boolean;
}>;

/* eslint-disable no-unused-vars -- type-only signature in PixiTextMetrics */
type SocketShape = "circle" | "triangle" | "square";
type PixiTextMetrics = Readonly<{
  measureText: (
    text: string,
    style: PIXI.TextStyleOptions,
  ) => { width: number };
}>;
/* eslint-enable no-unused-vars */

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
  private readonly executionBadge: PIXI.Graphics;
  private readonly sockets: PIXI.Graphics;
  private readonly socketLabels: PIXI.Container;
  private readonly socketLabelTexts = new Map<SocketId, PIXI.Text>();
  private readonly titleText: PIXI.Text;
  private readonly toggleIcon: PIXI.Graphics;
  private readonly executionText: PIXI.Text;
  private readonly executionBar: PIXI.Graphics;
  private layout: NodeLayout;
  private theme: CanvasTheme;
  private state: NodeVisualState = DEFAULT_VISUAL_STATE;
  private lastTitle: string | null = null;
  private headerBadgeRight = 0;

  constructor(
    node: GraphNode,
    sockets: ReadonlyArray<GraphSocket>,
    layout: NodeLayout,
    theme: CanvasTheme,
  ) {
    this.id = node.id;
    this.container = new PIXI.Container();
    this.body = new PIXI.Graphics();
    this.header = new PIXI.Graphics();
    this.headerIcons = new PIXI.Graphics();
    this.executionBadge = new PIXI.Graphics();
    this.sockets = new PIXI.Graphics();
    this.socketLabels = new PIXI.Container();
    this.titleText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif",
        fontSize: 11,
        fill: theme.node.headerText,
      },
    });
    this.titleText.anchor.set(0, 0.5);
    this.toggleIcon = new PIXI.Graphics();
    this.executionText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif",
        fontSize: 9,
        fill: theme.node.executionBadgeText,
      },
    });
    this.executionText.anchor.set(0.5);
    this.executionBar = new PIXI.Graphics();
    this.container.addChild(this.body);
    this.container.addChild(this.header);
    this.container.addChild(this.sockets);
    this.container.addChild(this.socketLabels);
    this.container.addChild(this.headerIcons);
    this.container.addChild(this.executionBadge);
    this.container.addChild(this.titleText);
    this.container.addChild(this.toggleIcon);
    this.container.addChild(this.executionText);
    this.container.addChild(this.executionBar);
    this.layout = layout;
    this.theme = theme;
    this.update(node, sockets, layout, DEFAULT_VISUAL_STATE, theme);
  }

  update(
    node: GraphNode,
    sockets: ReadonlyArray<GraphSocket>,
    layout: NodeLayout,
    state: NodeVisualState = DEFAULT_VISUAL_STATE,
    theme: CanvasTheme = this.theme,
    execution?: NodeExecutionState,
  ): void {
    this.layout = layout;
    this.state = state;
    this.theme = theme;
    this.container.x = node.position.x;
    this.container.y = node.position.y;
    this.drawBody(node);
    this.drawHeader(node);
    this.drawSockets(node, sockets);
    this.drawSocketLabels(node, sockets);
    this.drawExecution(node, execution);
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

  private drawSockets(
    node: GraphNode,
    sockets: ReadonlyArray<GraphSocket>,
  ): void {
    if (this.layout.isRerouteNode?.(node)) {
      this.sockets.clear();
      return;
    }
    this.sockets.clear();
    const socketsById = new Map<SocketId, GraphSocket>(
      sockets.map((socket) => [socket.id, socket]),
    );
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
    for (const [index, socketId] of node.inputs.entries()) {
      const y = startY + index * this.layout.socketSpacing;
      const socket = socketsById.get(socketId);
      const shape = socket ? getSocketShape(socket.dataType) : "circle";
      this.drawSocket(
        this.layout.socketOffsetX,
        y,
        socketFill,
        socketStroke,
        shape,
      );
    }
    for (const [index, socketId] of node.outputs.entries()) {
      const y = startY + index * this.layout.socketSpacing;
      const socket = socketsById.get(socketId);
      const shape = socket ? getSocketShape(socket.dataType) : "circle";
      this.drawSocket(
        width - this.layout.socketOffsetX,
        y,
        socketFill,
        socketStroke,
        shape,
      );
    }
  }

  private drawSocketLabels(
    node: GraphNode,
    sockets: ReadonlyArray<GraphSocket>,
  ): void {
    if (this.layout.isRerouteNode?.(node)) {
      this.socketLabels.removeChildren();
      this.socketLabelTexts.clear();
      return;
    }
    const { width } = getNodeSize(node, this.layout);
    const startY =
      this.layout.headerHeight +
      this.layout.bodyPadding +
      this.layout.socketSpacing / 2;
    const seen = new Set<SocketId>();
    const labelColor = this.state.bypassed
      ? this.theme.node.headerTextMuted
      : this.theme.node.headerTextMuted;
    const labelStyle = {
      fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif",
      fontSize: SOCKET_LABEL_FONT_SIZE,
      fill: labelColor,
    } as const;
    for (const socket of sockets) {
      const socketIndex =
        socket.direction === "input"
          ? node.inputs.indexOf(socket.id)
          : node.outputs.indexOf(socket.id);
      if (socketIndex < 0) {
        continue;
      }
      const labelText = socket.label?.trim().length
        ? socket.label
        : socket.name;
      const labelSettings = socket.labelSettings;
      if (labelSettings?.visible === false || labelText.trim().length === 0) {
        continue;
      }
      const socketX =
        socket.direction === "input"
          ? this.layout.socketOffsetX
          : width - this.layout.socketOffsetX;
      const socketY = startY + socketIndex * this.layout.socketSpacing;
      const position =
        labelSettings?.position === "auto" || !labelSettings?.position
          ? socket.direction === "input"
            ? "left"
            : "right"
          : labelSettings.position;
      let anchorX = 0.5;
      let anchorY = 0.5;
      let x = socketX;
      let y = socketY;
      switch (position) {
        case "left":
          anchorX = 0;
          anchorY = 0.5;
          x = Math.max(
            this.layout.bodyPadding + SOCKET_LABEL_INNER_PADDING,
            socketX + SOCKET_LABEL_OFFSET,
          );
          break;
        case "right":
          anchorX = 1;
          anchorY = 0.5;
          x = Math.min(
            width - this.layout.bodyPadding - SOCKET_LABEL_INNER_PADDING,
            socketX - SOCKET_LABEL_OFFSET,
          );
          break;
        case "top":
          anchorX = 0.5;
          anchorY = 1;
          y = socketY - SOCKET_LABEL_OFFSET;
          break;
        case "bottom":
          anchorX = 0.5;
          anchorY = 0;
          y = socketY + SOCKET_LABEL_OFFSET;
          break;
        default:
          break;
      }
      if (labelSettings?.offset) {
        x += labelSettings.offset.x;
        y += labelSettings.offset.y;
      }
      const maxWidth = resolveSocketLabelMaxWidth(
        width,
        x,
        position,
        this.layout.bodyPadding,
      );
      const fittedText =
        maxWidth > 0 ? fitSocketLabelText(labelText, maxWidth, labelStyle) : "";
      let text = this.socketLabelTexts.get(socket.id);
      if (!text) {
        text = new PIXI.Text({
          text: fittedText,
          style: labelStyle,
        });
        this.socketLabelTexts.set(socket.id, text);
        this.socketLabels.addChild(text);
      } else {
        text.text = fittedText;
        text.style.fill = labelColor;
      }
      text.anchor.set(anchorX, anchorY);
      text.x = x;
      text.y = y;
      seen.add(socket.id);
    }
    for (const [socketId, text] of this.socketLabelTexts.entries()) {
      if (seen.has(socketId)) {
        continue;
      }
      this.socketLabels.removeChild(text);
      this.socketLabelTexts.delete(socketId);
    }
  }

  private drawSocket(
    x: number,
    y: number,
    fill: number,
    stroke: number,
    shape: SocketShape,
  ): void {
    switch (shape) {
      case "triangle": {
        const side = SOCKET_RADIUS * 2;
        const height = side * SOCKET_TRIANGLE_HEIGHT_RATIO;
        const halfSide = side / 2;
        const halfHeight = height / 2;
        this.sockets.poly(
          [
            x,
            y - halfHeight,
            x - halfSide,
            y + halfHeight,
            x + halfSide,
            y + halfHeight,
          ],
          true,
        );
        break;
      }
      case "square": {
        this.sockets.rect(
          x - SOCKET_RADIUS,
          y - SOCKET_RADIUS,
          SOCKET_RADIUS * 2,
          SOCKET_RADIUS * 2,
        );
        break;
      }
      case "circle":
      default:
        this.sockets.circle(x, y, SOCKET_RADIUS);
        break;
    }
    this.sockets.fill(fill);
    this.sockets.stroke({ width: 1, color: stroke, alpha: 1 });
  }

  private drawHeader(node: GraphNode): void {
    if (this.layout.isRerouteNode?.(node)) {
      this.header.visible = false;
      this.headerIcons.visible = false;
      this.executionBadge.visible = false;
      this.titleText.visible = false;
      this.toggleIcon.visible = false;
      this.executionText.visible = false;
      return;
    }
    this.header.visible = true;
    this.headerIcons.visible = true;
    this.executionBadge.visible = true;
    this.titleText.visible = true;
    this.toggleIcon.visible = true;
    this.executionText.visible = true;
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
    const toggleCenterX = toggleBounds.x + toggleBounds.size / 2;
    const toggleCenterY = headerHeight / 2;
    const toggleHalf = Math.max(2, toggleBounds.size / 2 - 2);
    this.toggleIcon.clear();
    this.toggleIcon.stroke({ width: 1.5, color: textColor, alpha: 1 });
    if (this.state.collapsed) {
      this.toggleIcon.poly(
        [
          toggleCenterX - toggleHalf / 2,
          toggleCenterY - toggleHalf,
          toggleCenterX + toggleHalf / 2,
          toggleCenterY,
          toggleCenterX - toggleHalf / 2,
          toggleCenterY + toggleHalf,
        ],
        false,
      );
    } else {
      this.toggleIcon.poly(
        [
          toggleCenterX - toggleHalf,
          toggleCenterY - toggleHalf / 2,
          toggleCenterX,
          toggleCenterY + toggleHalf / 2,
          toggleCenterX + toggleHalf,
          toggleCenterY - toggleHalf / 2,
        ],
        false,
      );
    }

    const titleX = toggleBounds.x + toggleBounds.size + 6;
    this.titleText.x = titleX;
    this.titleText.y = headerHeight / 2;

    this.headerIcons.clear();
    let badgeRight = width - 8;
    const badgeY = headerHeight / 2;
    if (this.state.hasError) {
      this.headerIcons.circle(badgeRight - BADGE_RADIUS, badgeY, BADGE_RADIUS);
      this.headerIcons.fill(this.theme.node.badgeError);
      badgeRight -= BADGE_RADIUS * 2 + 4;
    }
    if (this.state.bypassed) {
      this.headerIcons.circle(badgeRight - BADGE_RADIUS, badgeY, BADGE_RADIUS);
      this.headerIcons.fill(this.theme.node.badgeBypass);
      badgeRight -= BADGE_RADIUS * 2 + 4;
    }
    this.executionBadge.clear();
    this.headerBadgeRight = badgeRight;
  }

  private drawExecution(node: GraphNode, execution?: NodeExecutionState): void {
    if (this.layout.isRerouteNode?.(node)) {
      this.executionBar.visible = false;
      return;
    }
    const { width, height } = getNodeSize(node, this.layout);
    if (!execution || execution.maxDurationMs <= 0) {
      this.executionBadge.visible = false;
      this.executionText.visible = false;
      this.executionBar.visible = false;
      return;
    }
    const headerHeight = this.layout.headerHeight;
    const badgeText = `${execution.order}`;
    this.executionText.text = badgeText;
    const fontSizeRaw = this.executionText.style.fontSize;
    const fontSize =
      typeof fontSizeRaw === "number"
        ? fontSizeRaw
        : Number.parseFloat(String(fontSizeRaw)) || 9;
    const estimatedWidth = badgeText.length * fontSize * 0.6;
    const paddingX = 4;
    const paddingY = 2;
    const badgeWidth = Math.max(
      BADGE_RADIUS * 2,
      estimatedWidth + paddingX * 2,
    );
    const badgeHeight = Math.max(BADGE_RADIUS * 2, fontSize + paddingY * 2);
    const badgeX = Math.max(6, this.headerBadgeRight - badgeWidth);
    const badgeY = (headerHeight - badgeHeight) / 2;
    this.executionBadge.clear();
    this.executionBadge.rect(badgeX, badgeY, badgeWidth, badgeHeight);
    this.executionBadge.fill(this.theme.node.executionBadgeFill);
    this.executionText.style.fill = this.theme.node.executionBadgeText;
    this.executionText.x = badgeX + badgeWidth / 2;
    this.executionText.y = badgeY + badgeHeight / 2;
    this.executionBadge.visible = true;
    this.executionText.visible = true;

    const barHeight = 4;
    const barPadding = 6;
    const barWidth = Math.max(0, width - barPadding * 2);
    const barY = height - barHeight - 4;
    const ratio = Math.min(
      1,
      Math.max(0, execution.durationMs / execution.maxDurationMs),
    );
    this.executionBar.clear();
    this.executionBar.rect(barPadding, barY, barWidth, barHeight);
    this.executionBar.fill(this.theme.node.executionBarTrack);
    const fillWidth = barWidth * ratio;
    if (fillWidth > 0.5) {
      this.executionBar.rect(barPadding, barY, fillWidth, barHeight);
      this.executionBar.fill(
        execution.cacheHit
          ? this.theme.node.executionBarCacheHit
          : this.theme.node.executionBarFill,
      );
    }
    this.executionBar.visible = true;
  }
}

const resolveSocketLabelMaxWidth = (
  nodeWidth: number,
  x: number,
  position: "left" | "right" | "top" | "bottom",
  bodyPadding: number,
): number => {
  if (position === "left") {
    const centerLimit = nodeWidth / 2 - SOCKET_LABEL_CENTER_GUTTER;
    return Math.max(0, centerLimit - x);
  }
  if (position === "right") {
    const centerLimit = nodeWidth / 2 + SOCKET_LABEL_CENTER_GUTTER;
    return Math.max(0, x - centerLimit);
  }
  const leftLimit = bodyPadding + SOCKET_LABEL_INNER_PADDING;
  const rightLimit = nodeWidth - bodyPadding - SOCKET_LABEL_INNER_PADDING;
  const leftSpace = x - leftLimit;
  const rightSpace = rightLimit - x;
  return Math.max(0, Math.min(leftSpace, rightSpace) * 2);
};

const fitSocketLabelText = (
  text: string,
  maxWidth: number,
  style: PIXI.TextStyleOptions,
): string => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const fullWidth = measureLabelWidth(trimmed, style);
  if (fullWidth <= maxWidth) {
    return trimmed;
  }
  const ellipsisWidth = measureLabelWidth(SOCKET_LABEL_ELLIPSIS, style);
  if (ellipsisWidth >= maxWidth) {
    return SOCKET_LABEL_ELLIPSIS;
  }
  let start = 1;
  let end = 1;
  let best = trimmed[0] + SOCKET_LABEL_ELLIPSIS + trimmed.at(-1);
  while (start + end < trimmed.length - 1) {
    const nextStart = start <= end ? start + 1 : start;
    const nextEnd = end < start ? end + 1 : end;
    const candidate =
      trimmed.slice(0, nextStart) +
      SOCKET_LABEL_ELLIPSIS +
      trimmed.slice(trimmed.length - nextEnd);
    const width = measureLabelWidth(candidate, style);
    if (width > maxWidth) {
      break;
    }
    start = nextStart;
    end = nextEnd;
    best = candidate;
  }
  return best;
};

const measureLabelWidth = (
  text: string,
  style: PIXI.TextStyleOptions,
): number => {
  let pixiMetrics: unknown = null;
  try {
    pixiMetrics = (PIXI as unknown as { TextMetrics?: unknown }).TextMetrics;
  } catch {
    pixiMetrics = null;
  }
  if (
    pixiMetrics &&
    typeof pixiMetrics === "object" &&
    "measureText" in pixiMetrics
  ) {
    return (pixiMetrics as PixiTextMetrics).measureText(text, style).width;
  }
  const isJsdom =
    typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom");
  if (!isJsdom && typeof document !== "undefined") {
    const canvas = getLabelMeasureCanvas();
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas.getContext("2d");
    } catch {
      context = null;
    }
    if (context) {
      context.font = buildLabelFont(style);
      return context.measureText(text).width;
    }
  }
  const fontSize = typeof style.fontSize === "number" ? style.fontSize : 10;
  return text.length * fontSize * SOCKET_LABEL_CHAR_WIDTH_RATIO;
};

let labelMeasureCanvas: HTMLCanvasElement | null = null;

const getLabelMeasureCanvas = (): HTMLCanvasElement => {
  if (!labelMeasureCanvas) {
    labelMeasureCanvas = document.createElement("canvas");
  }
  return labelMeasureCanvas;
};

const buildLabelFont = (style: PIXI.TextStyleOptions): string => {
  const fontSize = typeof style.fontSize === "number" ? style.fontSize : 10;
  const fontFamily = Array.isArray(style.fontFamily)
    ? style.fontFamily.join(", ")
    : (style.fontFamily ?? "sans-serif");
  return `${fontSize}px ${fontFamily}`;
};

const resolveBodyStyle = (
  state: NodeVisualState,
  theme: CanvasTheme,
): {
  fillColor: number;
  strokeColor: number;
  strokeWidth: number;
} => {
  const strokeWidth = NODE_STROKE_WIDTH;
  if (state.hasError) {
    return {
      fillColor: state.bypassed ? theme.node.bypassedFill : theme.node.fill,
      strokeColor: theme.node.errorStroke,
      strokeWidth,
    };
  }
  if (state.selected) {
    return {
      fillColor: state.bypassed ? theme.node.bypassedFill : theme.node.fill,
      strokeColor: theme.node.selectedStroke,
      strokeWidth,
    };
  }
  if (state.hovered) {
    return {
      fillColor: state.bypassed ? theme.node.bypassedFill : theme.node.fill,
      strokeColor: theme.node.hoveredStroke,
      strokeWidth,
    };
  }
  if (state.bypassed) {
    return {
      fillColor: theme.node.bypassedFill,
      strokeColor: theme.node.bypassedStroke,
      strokeWidth,
    };
  }
  return {
    fillColor: theme.node.fill,
    strokeColor: theme.node.stroke,
    strokeWidth,
  };
};

const getSocketShape = (dataType: GraphSocket["dataType"]): SocketShape => {
  switch (dataType) {
    case "vec2":
    case "vec3":
    case "vec4":
      return "triangle";
    case "bool":
    case "mat3":
    case "mat4":
    case "sampler2D":
      return "square";
    case "float":
    case "int":
    default:
      return "circle";
  }
};
