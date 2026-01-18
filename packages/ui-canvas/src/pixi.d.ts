/* eslint-disable no-unused-vars */
declare module "pixi.js" {
  export type MutablePoint = Readonly<{
    x: number;
    y: number;
    set: (x: number, y?: number) => void;
  }>;

  export type TextStyleOptions = {
    fontFamily?: string;
    fontSize?: number;
    fill?: number | string;
  };

  export class Container {
    addChild(...children: Container[]): this;
    removeChild(child: Container): this;
    removeChildren(): Container[];
    x: number;
    y: number;
    position: MutablePoint;
    scale: MutablePoint;
    visible: boolean;
  }

  export class Text extends Container {
    constructor(options: Readonly<{ text: string; style?: TextStyleOptions }>);
    text: string;
    style: TextStyleOptions;
    anchor: MutablePoint;
  }

  export type StrokeStyle = Readonly<{
    width?: number;
    color?: number;
    alpha?: number;
  }>;

  export class Graphics extends Container {
    clear(): this;
    rect(x: number, y: number, width: number, height: number): this;
    circle(x: number, y: number, radius: number): this;
    fill(color?: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    bezierCurveTo(
      cp1x: number,
      cp1y: number,
      cp2x: number,
      cp2y: number,
      x: number,
      y: number,
    ): this;
    stroke(style?: StrokeStyle): this;
  }
}
