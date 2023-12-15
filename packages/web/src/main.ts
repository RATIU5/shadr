import { Editor } from "@shadr/editor/src";

const editor = new Editor({
  canvas: document.getElementById("node-editor") as HTMLCanvasElement,
});
editor.start();
