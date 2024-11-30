import type { utils } from "@shadr/common";

export type EventState = {
  spaceDown: utils.Signal<boolean>;
  leftMouseDown: utils.Signal<boolean>;
  middleMouseDown: utils.Signal<boolean>;
  rightMouseDown: utils.Signal<boolean>;
  isDragging: boolean;
  zoom: number;
};

export type Events = {
  "raw:keydown": KeyboardEvent;
  "raw:keyup": KeyboardEvent;
  "raw:mousemove": MouseEvent;
  "raw:mousedown": MouseEvent;
  "raw:mouseup": MouseEvent;
  "raw:mousewheel": WheelEvent;
  "raw:touchstart": TouchEvent;
  "raw:touchmove": TouchEvent;
  "raw:touchend": TouchEvent;

  "editor:drag": { x: number; y: number };
  "editor:zoom": { scale: number; position: { x: number; y: number } };
};
