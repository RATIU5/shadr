export type RawEvents = {
  "raw:keydown": KeyboardEvent;
  "raw:keyup": KeyboardEvent;
  "raw:mousemove": MouseEvent;
  "raw:mousedown": MouseEvent;
  "raw:mouseup": MouseEvent;
  "raw:mousewheel": WheelEvent;
};

export type InitOptions = {
  width: number;
  height: number;
};
