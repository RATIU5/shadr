import { NodeEditor } from "./editor";

const canvas = document.querySelector("#editor");
if (!canvas) {
  console.error("failed to locate canvas to render editor");
} else {
  new NodeEditor(canvas as HTMLCanvasElement);
}
