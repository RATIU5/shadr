import type { FrameId, GraphFrame } from "@shadr/graph-core";
import * as PIXI from "pixi.js";

import type { CanvasTheme } from "./theme.js";

export type FrameVisualState = Readonly<{
  selected: boolean;
  hovered: boolean;
}>;

const DEFAULT_VISUAL_STATE: FrameVisualState = {
  selected: false,
  hovered: false,
};

const TITLE_HEIGHT = 22;
const TITLE_PADDING_X = 10;
const TITLE_PADDING_Y = 6;
const FRAME_FILL_ALPHA = 0.08;
const FRAME_STROKE_ALPHA = 0.7;
const TITLE_FILL_ALPHA = 0.22;

export class FrameView {
  readonly id: FrameId;
  readonly container: PIXI.Container;
  private readonly body: PIXI.Graphics;
  private readonly outline: PIXI.Graphics;
  private readonly titleBar: PIXI.Graphics;
  private readonly titleText: PIXI.Text;
  private theme: CanvasTheme;
  private lastTitle: string | null = null;

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
    this.container.addChild(this.body);
    this.container.addChild(this.outline);
    this.container.addChild(this.titleBar);
    this.container.addChild(this.titleText);
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
    const { width, height } = frame.size;
    this.body.clear();
    this.body.rect(0, 0, width, height);
    this.body.fill(this.theme.frame.fill);
    this.body.alpha = FRAME_FILL_ALPHA;

    this.outline.clear();
    this.outline.rect(0, 0, width, height);
    this.outline.stroke({
      width: 1,
      color: strokeColor,
      alpha: FRAME_STROKE_ALPHA,
    });

    this.titleBar.clear();
    this.titleBar.rect(0, 0, width, TITLE_HEIGHT);
    this.titleBar.fill(this.theme.frame.titleFill);
    this.titleBar.alpha = TITLE_FILL_ALPHA;

    const title = frame.title;
    if (title !== this.lastTitle) {
      this.titleText.text = title;
      this.lastTitle = title;
    }
    this.titleText.style.fill = this.theme.frame.titleText;
    this.titleText.x = TITLE_PADDING_X;
    this.titleText.y = TITLE_PADDING_Y;
  }
}
