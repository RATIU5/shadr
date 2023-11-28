import { openNodeModel } from "./dom";
import { NodeEditor } from "./editor";
import { KeyDownEvent, MouseDownEvent, MouseMoveEvent } from "./events";

const canvas = document.querySelector("#editor");
if (canvas) {
  new NodeEditor(canvas as HTMLCanvasElement);
  MouseMoveEvent.attachElement(canvas);
} else {
  console.error("failed to locate canvas to render editor");
}

KeyDownEvent.attachElement(document);
KeyDownEvent.addCallback((e, i) => {
  if (e.keyCode === 27) {
    this.interactions.isDragging = false;
  }

  if (e.keyCode === 78) {
    openNodeModel(i);
  }
});
