import { NodeEditor } from "./editor";
import {
  MouseDownEvent,
  MouseMoveEvent,
  MouseScrollEvent,
  MouseUpEvent,
  ResizeEvent,
} from "./events";

const canvas = document.querySelector("#editor");
if (!canvas) {
  console.error("failed to locate canvas to render editor");
} else {
  MouseDownEvent.attachElement(canvas as HTMLElement);
  MouseUpEvent.attachElement(canvas as HTMLElement);
  MouseMoveEvent.attachElement(canvas as HTMLElement);
  MouseScrollEvent.attachElement(window);
  ResizeEvent.attachElement(window);
  new NodeEditor(canvas as HTMLCanvasElement);
}
