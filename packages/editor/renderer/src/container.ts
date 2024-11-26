import { Container } from "pixi.js";
import { types } from "@shadr/common";

export const pixiContainerToShadrContainer = (
  pixiContainer: Container
): types.Editor.Renderer.Container => {
  return {};
};

export const createContainer = (
  options: ConstructorParameters<typeof Container>[0]
): types.Editor.Renderer.Container => {
  const pixiContainer = new Container(options);
  return {
    get x() {
      return pixiContainer.x;
    },
    get y() {
      return pixiContainer.y;
    },
    get width() {
      return pixiContainer.width;
    },
    get height() {
      return pixiContainer.height;
    },
    get children() {
      return pixiContainer.children.map((child) => pixiContainerToShadrContainer(child));
    },

    set x(value: number) {
      pixiContainer.x = value;
    },

    set y(value: number) {
      pixiContainer.y = value;
    },

    set width(value: number) {
      pixiContainer.width = value;
    },
    set height(value: number) {
      pixiContainer.height = value;
    },
    destroy: () => {
      pixiContainer.destroy();
    },
    addChild: (child: Container) => {},
  };
};
