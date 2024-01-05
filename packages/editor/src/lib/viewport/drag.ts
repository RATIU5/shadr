import { Drag, Plugin, Viewport } from "pixi-viewport";
import { FederatedPointerEvent } from "pixi.js";

export class CustomDragPlugin extends Plugin {
  private spacePressed: boolean;
  private dragPlugin: Drag;
  private windowEventHandlers: Array<{ event: string; handler: (e: any) => void }> = [];

  constructor(viewport: Viewport) {
    super(viewport);
    this.spacePressed = false;
    this.dragPlugin = new Drag(viewport);

    this.handleKeyPresses();
  }

  public override down(event: FederatedPointerEvent): boolean {
    if (event.button === 1) {
      return this.dragPlugin.down(event);
    }
    if (this.spacePressed && event.button === 0) {
      return this.dragPlugin.down(event);
    }
    return false;
  }

  public override move(event: FederatedPointerEvent): boolean {
    return this.dragPlugin.move(event);
  }

  public override up(event: FederatedPointerEvent): boolean {
    return this.dragPlugin.up(event);
  }

  private handleKeyPresses(): void {
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        this.spacePressed = true;
      }
    };

    const keyupHandler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        this.spacePressed = false;
      }
    };

    this.addWindowEventHandler("keyup", keyupHandler);
    this.addWindowEventHandler("keydown", keydownHandler);
  }

  private addWindowEventHandler(event: string, handler: (e: any) => void): void {
    if (typeof window === "undefined") return;
    window.addEventListener(event, handler);
    this.windowEventHandlers.push({ event, handler });
  }

  public override destroy(): void {
    if (typeof window === "undefined") return;
    for (const { event, handler } of this.windowEventHandlers) {
      window.removeEventListener(event, handler);
    }
  }
}
