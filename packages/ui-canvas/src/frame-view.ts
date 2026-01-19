import type { FrameId, GraphFrame, SocketId } from "@shadr/graph-core";
import * as PIXI from "pixi.js";

import {
  FRAME_IO_PADDING,
  FRAME_TITLE_HEIGHT,
  FRAME_TITLE_PADDING_X,
  FRAME_TITLE_PADDING_Y,
  getFrameSocketLayout,
} from "./frame-layout.js";
import type { CanvasTheme } from "./theme.js";

export type FrameIoLabel = Readonly<{
  socketId: SocketId;
  label: string;
}>;

export type FrameIoState = Readonly<{
  inputs: ReadonlyArray<FrameIoLabel>;
  outputs: ReadonlyArray<FrameIoLabel>;
}>;

export type FrameVisualState = Readonly<{
  selected: boolean;
  hovered: boolean;
  collapsed: boolean;
  io: FrameIoState | null;
}>;

const DEFAULT_VISUAL_STATE: FrameVisualState = {
  selected: false,
  hovered: false,
  collapsed: false,
  io: null,
};

const FRAME_FILL_ALPHA = 0.08;
const FRAME_STROKE_ALPHA = 0.7;
const TITLE_FILL_ALPHA = 0.22;
const DESCRIPTION_FONT_SIZE = 10;
const IO_LABEL_FONT_SIZE = 10;
const IO_LABEL_OFFSET = 12;
const IO_DOT_RADIUS = 3;
const HANDLE_SIZE = 8;

export class FrameView {
  readonly id: FrameId;
  readonly container: PIXI.Container;
  private readonly body: PIXI.Graphics;
  private readonly outline: PIXI.Graphics;
  private readonly titleBar: PIXI.Graphics;
  private readonly titleText: PIXI.Text;
  private readonly descriptionText: PIXI.Text;
  private readonly ioGraphics: PIXI.Graphics;
  private readonly ioLabels: PIXI.Container;
  private readonly handles: PIXI.Graphics;
  private theme: CanvasTheme;
  private lastTitle: string | null = null;
  private lastDescription: string | null = null;

  constructor(frame: GraphFrame, theme: CanvasTheme) {
    this.id = frame.id;
    this.container = new PIXI.Container();
    this.body = new PIXI.Graphics();
    this.outline = new PIXI.Graphics();
    this.titleBar = new PIXI.Graphics();
    this.titleText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif",
        fontSize: 12,
        fill: theme.frame.titleText,
      },
    });
    this.descriptionText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif",
        fontSize: DESCRIPTION_FONT_SIZE,
        fill: theme.frame.titleText,
      },
    });
    this.ioGraphics = new PIXI.Graphics();
    this.ioLabels = new PIXI.Container();
    this.handles = new PIXI.Graphics();
    this.container.addChild(this.body);
    this.container.addChild(this.outline);
    this.container.addChild(this.titleBar);
    this.container.addChild(this.titleText);
    this.container.addChild(this.descriptionText);
    this.container.addChild(this.ioGraphics);
    this.container.addChild(this.ioLabels);
    this.container.addChild(this.handles);
    this.theme = theme;
    this.update(frame, DEFAULT_VISUAL_STATE, theme);
  }

  update(
    frame: GraphFrame,
    state: FrameVisualState = DEFAULT_VISUAL_STATE,
    theme: CanvasTheme = this.theme,
  ): void {
    this.theme = theme;
    this.container.x = frame.position.x;
    this.container.y = frame.position.y;
    this.drawFrame(frame, state);
  }

  destroy(): void {
    this.container.removeChildren();
  }

  private drawFrame(frame: GraphFrame, state: FrameVisualState): void {
    const strokeColor = state.selected
      ? this.theme.frame.selectedStroke
      : state.hovered
        ? this.theme.frame.hoveredStroke
        : this.theme.frame.stroke;
    const fillColor = frame.color ?? this.theme.frame.fill;
    const titleFill = frame.color ?? this.theme.frame.titleFill;
    const { width, height } = frame.size;
    const collapsed = state.collapsed;
    this.body.clear();
    this.body.rect(0, 0, width, height);
    this.body.fill(fillColor);
    this.body.alpha = collapsed ? FRAME_FILL_ALPHA * 0.4 : FRAME_FILL_ALPHA;

    this.outline.clear();
    this.outline.rect(0, 0, width, height);
    this.outline.stroke({
      width: 1,
      color: strokeColor,
      alpha: FRAME_STROKE_ALPHA,
    });

    this.titleBar.clear();
    this.titleBar.rect(0, 0, width, FRAME_TITLE_HEIGHT);
    this.titleBar.fill(titleFill);
    this.titleBar.alpha = TITLE_FILL_ALPHA;

    const title = frame.title;
    if (title !== this.lastTitle) {
      this.titleText.text = title;
      this.lastTitle = title;
    }
    this.titleText.style.fill = this.theme.frame.titleText;
    this.titleText.x = FRAME_TITLE_PADDING_X;
    this.titleText.y = FRAME_TITLE_PADDING_Y;

    const description = frame.description ?? "";
    if (description !== this.lastDescription) {
      this.descriptionText.text = description;
      this.lastDescription = description;
    }
    this.descriptionText.visible = description.length > 0 && !collapsed;
    this.descriptionText.style.fill = this.theme.frame.titleText;
    this.descriptionText.x = FRAME_TITLE_PADDING_X;
    this.descriptionText.y =
      FRAME_TITLE_HEIGHT + Math.max(4, FRAME_IO_PADDING * 0.5);

    this.ioGraphics.clear();
    this.ioLabels.removeChildren();
    if (collapsed && state.io) {
      const inputIds = state.io.inputs.map((entry) => entry.socketId);
      const outputIds = state.io.outputs.map((entry) => entry.socketId);
      const layout = getFrameSocketLayout(frame, inputIds, outputIds);
      for (const entry of layout.inputs) {
        this.ioGraphics.circle(entry.x, entry.y, IO_DOT_RADIUS);
        const label = state.io.inputs.find(
          (input) => input.socketId === entry.socketId,
        );
        if (label && label.label.trim().length > 0) {
          const text = new PIXI.Text({
            text: label.label,
            style: {
              fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif",
              fontSize: IO_LABEL_FONT_SIZE,
              fill: this.theme.frame.titleText,
            },
          });
          text.x = entry.x + IO_LABEL_OFFSET;
          text.y = entry.y - IO_LABEL_FONT_SIZE / 2;
          this.ioLabels.addChild(text);
        }
      }
      for (const entry of layout.outputs) {
        this.ioGraphics.circle(entry.x, entry.y, IO_DOT_RADIUS);
        const label = state.io.outputs.find(
          (output) => output.socketId === entry.socketId,
        );
        if (label && label.label.trim().length > 0) {
          const text = new PIXI.Text({
            text: label.label,
            style: {
              fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif",
              fontSize: IO_LABEL_FONT_SIZE,
              fill: this.theme.frame.titleText,
            },
          });
          text.anchor.set(1, 0);
          text.x = entry.x - IO_LABEL_OFFSET;
          text.y = entry.y - IO_LABEL_FONT_SIZE / 2;
          this.ioLabels.addChild(text);
        }
      }
      this.ioGraphics.fill(this.theme.frame.titleText);
      this.ioGraphics.alpha = 0.8;
    }

    this.handles.clear();
    if (state.selected || state.hovered) {
      const handleColor = strokeColor;
      const handleHalf = HANDLE_SIZE / 2;
      const corners = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: 0, y: height },
        { x: width, y: height },
      ];
      for (const corner of corners) {
        this.handles.rect(
          corner.x - handleHalf,
          corner.y - handleHalf,
          HANDLE_SIZE,
          HANDLE_SIZE,
        );
      }
      this.handles.fill(handleColor);
      this.handles.alpha = 0.8;
    }
  }
}
