export type Events = {
  "raw:keydown": KeyboardEvent;
  "raw:keyup": KeyboardEvent;
  "raw:mousemove": MouseEvent;
  "raw:mousedown": MouseEvent;
  "raw:mouseup": MouseEvent;
  "raw:mousewheel": WheelEvent;

  "grid:drag": { x: number; y: number };
};

export type InitOptions = {
  width: number;
  height: number;
};
