import { Application } from "pixi.js";
import { initializeEventBus } from "./events/event-bus";
import { initializeComponents } from "./components/initialize-components";
import { initializeCanvasManager } from "./ui/canvas-manager";

function initializeApplicaton() {
  const canvas = document.getElementById("editor") as HTMLCanvasElement;
  const app = new Application({
    view: canvas,
    autoDensity: true,
    antialias: true,
    backgroundColor: 0x1a1b1c,
    resolution: window.devicePixelRatio || 1,
  });

  initializeEventBus();
  initializeCanvasManager(canvas);
  initializeComponents(app);
}

function main() {
  try {
    initializeApplicaton();
  } catch (err) {
    console.error("Error initializing application:", err);
  }
}

main();
