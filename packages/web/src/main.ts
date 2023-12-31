import { Editor } from "@shadr/editor/src";
import { initializeContextComponent } from "./components/context-menu";

const nodeEditor = document.getElementById("node-editor") as HTMLCanvasElement;
const editor = new Editor({
  canvas: nodeEditor,
});

initializeContextComponent(nodeEditor, [
  {
    type: "item",
    label: "Add new node",
    items: [
      {
        type: "item",
        label: "Input&nbsp;node",
        action: () => console.log("i"),
      },
      {
        type: "item",
        label: "Output&nbsp;node",
        action: () => console.log("o"),
      },
    ],
  },
  {
    type: "item",
    label: "Select all",
    action: () => console.log("a"),
    disabled: true,
  },
  { type: "separator" },
  {
    type: "item",
    label: "Zoom in",
    action: () => {
      editor.setZoom(editor.getZoom() - 0.5);
    },
  },
  {
    type: "item",
    label: "Zoom out",
    action: () => {
      editor.setZoom(editor.getZoom() + 0.5);
    },
  },
  {
    type: "item",
    label: "Reset view",
    action: () => {
      editor.setZoom(1);
      editor.setOffset(0, 0);
    },
  },
]);

editor.start();
