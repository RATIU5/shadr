/* eslint-disable no-unused-vars */
declare module "pixi.js" {
  export class Container {
    addChild(...children: Container[]): this;
    removeChild(child: Container): this;
    removeChildren(): Container[];
    x: number;
    y: number;
    visible: boolean;
  }

  export type StrokeStyle = Readonly<{
    width?: number;
    color?: number;
    alpha?: number;
  }>;

  export class Graphics extends Container {
    clear(): this;
    rect(x: number, y: number, width: number, height: number): this;
    fill(color?: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    stroke(style?: StrokeStyle): this;
  }
}
