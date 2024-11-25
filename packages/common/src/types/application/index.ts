export type SetupOptions = {
  width: number;
  height: number;
};

/**
 * The events for the entire Shadr application.
 *
 * Events indicated with `raw:` are the raw events that are emitted directly from the browser.
 * These events are not modified in any way and are emitted as they are received.
 */
export type Events = {
  "raw:keydown": KeyboardEvent;
  "raw:keyup": KeyboardEvent;
  "raw:mousemove": MouseEvent;
  "raw:mousedown": MouseEvent;
  "raw:mouseup": MouseEvent;
  "raw:mousewheel": WheelEvent;
};
