import { Application } from "pixi.js";
import { NodeEditor } from "./editor";

// Initialize the PIXI Application
const app = new Application<HTMLCanvasElement>({
  width: window.innerWidth,
  height: window.innerHeight,
  // other options
});

document.body.appendChild(app.view);

// Initialize the NodeEditor with the PIXI application
const nodeEditor = new NodeEditor(app);

// Main application loop or additional setup
app.ticker.add((delta) => {
  nodeEditor.update(delta);
});
