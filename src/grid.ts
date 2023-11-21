import {
  Application,
  Container,
  Geometry,
  IPointData,
  Mesh,
  Polygon,
  Shader,
} from "pixi.js";

import fGrid from "./shaders/fGrid.glsl";
import vGrid from "./shaders/vGrid.glsl";

export class Grid {
  private scale = 100;
  private minZoom = 0.25;
  private maxZoom = 3.0;
  private zoomSensitivity = 0.05;
  private zoomFactor: number;
  private dotSize: number;
  private dragOffset: IPointData;
  private isDragging: boolean;
  private appSize: IPointData;
  private dragStart: IPointData;
  private container: Container;

  constructor(app: Application) {
    this.appSize = { x: app.renderer.width, y: app.renderer.height };
    this.dotSize = 1 * this.scale;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.dragStart = { x: 0, y: 0 };
    this.zoomFactor = 1;

    this.container = new Container();
    const geometry = this.createGeometry(this.appSize.x, this.appSize.y);
    const shader = Shader.from(vGrid, fGrid, {
      u_dotSize: this.dotSize,
      u_mousePos: [0, 0],
      u_dragOffset: [0, 0],
      u_zoom: 1.0,
      u_gridSpacing: 50.0,
      u_size: [this.appSize.x, this.appSize.y],
    });
    const mesh = new Mesh(geometry, shader);
    mesh.hitArea = new Polygon([
      0,
      0,
      this.appSize.x,
      0,
      this.appSize.x,
      this.appSize.y,
      0,
      this.appSize.y,
    ]);
    this.container.addChild(mesh);
    this.container.eventMode = "static";

    this.container.on("pointerdown", (e) => {
      console.log("test");
      this.isDragging = true;
      this.dragStart.x = e.clientX;
      this.dragStart.y = e.clientY;
    });

    this.container.on("pointerup", (e) => {
      this.isDragging = false;
    });

    this.container.on("pointermove", (e) => {
      if (this.isDragging) {
        const deltaX = e.clientX - this.dragStart.x;
        const deltaY = e.clientY - this.dragStart.y;

        this.dragOffset.x += deltaX * this.zoomFactor;
        this.dragOffset.y += deltaY * this.zoomFactor;

        this.setUniform("u_dragOffset", [this.dragOffset.x, this.dragOffset.y]);

        this.dragStart.x = e.clientX;
        this.dragStart.y = e.clientY;
      }
    });

    this.container.on("wheel", (e) => {
      this.zoomFactor *=
        e.deltaY > 0 ? 1 - this.zoomSensitivity : 1 + this.zoomSensitivity;

      this.zoomFactor = Math.max(
        this.minZoom,
        Math.min(this.maxZoom, this.zoomFactor),
      );
      this.setUniform("u_zoom", this.zoomFactor);
    });
  }

  private setUniform<T = any>(name: string, value: T) {
    (this.container.children[0] as Mesh).shader.uniforms[name] = value;
  }

  createGeometry(width: number, height: number) {
    let positionalBuffer = new Float32Array([
      0,
      0,
      width,
      0,
      width,
      height,
      0,
      height,
    ]);
    return new Geometry()
      .addAttribute("position", positionalBuffer, 2)
      .addIndex([0, 1, 2, 0, 2, 3]);
  }

  getMesh() {
    return this.container;
  }
}
