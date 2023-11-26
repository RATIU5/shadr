import { NodeEditor } from "./editor";

const canvas = document.querySelector("#editor");
if (canvas) {
  new NodeEditor(canvas as HTMLCanvasElement);
} else {
  console.error("failed to locate canvas to render editor");
}
