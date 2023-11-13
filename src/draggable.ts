import { Container, Graphics, IPointData } from "pixi.js";

export interface Draggable {
  updatePosition: (newPosition: IPointData) => void;
  getGraphics: () => Container | Graphics;
}
