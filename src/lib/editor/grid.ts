import { Application, Container, Geometry, type IPointData, Mesh, Polygon, Shader } from 'pixi.js';

import fGrid from '$lib/shaders/grid-frag.glsl';
import vGrid from '$lib/shaders/grid-vert.glsl';
import type { EditorState } from './editor-state';

export class Grid {
	private static readonly SCALE = 100;
	private static readonly ZOOM_SENSITIVITY = 0.05;
	private static readonly INITIAL_ZOOM_FACTOR = 1;
	private static readonly GRID_SPACING = 50.0;
	private static readonly DOT_SIZE = Grid.SCALE;

	private dragOffset: IPointData = { x: 0, y: 0 };
	private isDragging: boolean = false;
	private appSize: IPointData;
	private dragStart: IPointData = { x: 0, y: 0 };
	private container: Container;
	private state: EditorState;

	constructor(app: Application, editorState: EditorState) {
		this.state = editorState;
		this.state.addZoomFactorCallback((zoomFactor) => {
			this.setUniform('u_zoom', zoomFactor);
		});
		this.appSize = { x: app.renderer.width, y: app.renderer.height };
		this.container = new Container();
		this.setupMesh();
		this.setupEventHandlers();
	}

	private setupMesh() {
		const geometry = this.createGeometry(this.appSize.x, this.appSize.y);
		const shader = this.createShader();
		const mesh = new Mesh(geometry, shader);
		mesh.hitArea = new Polygon([
			0,
			0,
			this.appSize.x,
			0,
			this.appSize.x,
			this.appSize.y,
			0,
			this.appSize.y
		]);
		this.container.addChild(mesh);
		this.container.eventMode = 'static';
	}

	private createShader(): Shader {
		return Shader.from(vGrid, fGrid, {
			u_dotSize: Grid.DOT_SIZE,
			u_mousePos: [0, 0],
			u_dragOffset: [0, 0],
			u_zoom: Grid.INITIAL_ZOOM_FACTOR,
			u_gridSpacing: Grid.GRID_SPACING,
			u_size: [this.appSize.x, this.appSize.y]
		});
	}

	private setupEventHandlers() {
		this.container.on('pointerdown', this.onPointerDown.bind(this));
		this.container.on('pointerup', this.onPointerUp.bind(this));
		this.container.on('pointermove', this.onPointerMove.bind(this));
		this.container.on('wheel', this.onWheel.bind(this));
	}

	private onPointerDown(e: any) {
		if ((e as MouseEvent).button === 1) {
			this.isDragging = true;
			this.dragStart.x = e.clientX;
			this.dragStart.y = e.clientY;
		}
	}

	private onPointerUp() {
		this.isDragging = false;
	}

	private onPointerMove(e: any) {
		if (!this.isDragging) return;

		const deltaX = e.clientX - this.dragStart.x;
		const deltaY = e.clientY - this.dragStart.y;

		this.dragOffset.x += deltaX * this.state.zoomFactor;
		this.dragOffset.y += deltaY * this.state.zoomFactor;

		this.setUniform('u_dragOffset', [this.dragOffset.x, this.dragOffset.y]);
		this.dragStart = { x: e.clientX, y: e.clientY };
	}

	private onWheel(e: WheelEvent) {
		this.state.zoomFactor *= e.deltaY > 0 ? 1 - Grid.ZOOM_SENSITIVITY : 1 + Grid.ZOOM_SENSITIVITY;
		this.setUniform('u_zoom', this.state.zoomFactor);
	}

	private setUniform<T = any>(name: string, value: T) {
		const mesh = this.container.children[0] as Mesh;
		mesh.shader.uniforms[name] = value;
	}

	private createGeometry(width: number, height: number): Geometry {
		const positionalBuffer = new Float32Array([0, 0, width, 0, width, height, 0, height]);
		return new Geometry()
			.addAttribute('position', positionalBuffer, 2)
			.addIndex([0, 1, 2, 0, 2, 3]);
	}

	get(): Container {
		return this.container;
	}
}
