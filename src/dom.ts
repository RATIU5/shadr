import { Interactions } from "./events";

export function openNodeModel(i: Interactions) {
  const element = document.getElementById("addNodeModel");
  if (element) {
    element.classList.remove("hidden");
    // Get the current y coordinate of the mouse
    element.style.top = `${i.mouse.y}px`;
    element.style.left = `${i.mouse.x}px`;
  }
}
