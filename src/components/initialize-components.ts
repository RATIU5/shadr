import { Application } from "pixi.js";
import { initializeGridComponent } from "./grid/grid";
import { initializeContextComponent } from "./context/context-menu";
import { state } from "../state/editor-state";

export function initializeComponents(app: Application) {
  initializeGridComponent(app);
  initializeContextComponent(app.view, state.contextMenu);
}
