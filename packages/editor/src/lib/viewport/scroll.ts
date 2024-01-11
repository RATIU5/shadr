import { Drag, Plugin, Viewport, Wheel } from "pixi-viewport";

export class CustomWheelDrag extends Plugin {
  private wheelPlugin: Wheel;
  private dragPlugin: Drag;

  constructor(parent: Viewport) {
    super(parent);
    this.wheelPlugin = new Wheel(parent);
    this.dragPlugin = new Drag(parent);
  }

  public override wheel(event: WheelEvent): boolean | undefined {
    // if (event.ctrlKey || event.metaKey) {
    //   return this.wheelPlugin.wheel(event);
    // }

    return this.dragPlugin.wheel(event);
  }
}
