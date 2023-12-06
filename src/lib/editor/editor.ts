import { Application, Container, Graphics, type IPointData } from 'pixi.js';
import { Grid } from './grid';
import type { EditorState } from './editor-state';
import { Node } from '$lib/nodes/node';

export class NodeEditor {
	private app: Application;
	private isDragging: boolean;
	private resizeTimeout: number;
	private container: Container;

	constructor(canvas: HTMLCanvasElement, editorState: EditorState) {
		const rect = canvas.getBoundingClientRect();
		this.app = new Application({
			view: canvas,
			width: rect.width,
			height: rect.height,
			autoDensity: true,
			antialias: true,
			backgroundColor: 0x1a1b1c,
			resolution: window.devicePixelRatio || 1
		});
		this.isDragging = false;
		this.resizeTimeout = 0;
		this.container = new Container();

		const grid = new Grid(this.app, editorState);
		this.app.stage.addChild(grid.get());
		this.app.stage.addChild(this.container);
		editorState.addNodeContainerPosCallback((pos) => {
			this.container.position.set(pos.x, pos.y);
		});

		this.onResize();
		this.addEventListeners();

		this.addNode(new Node(1, { x: 100, y: 100 }, { x: 100, y: 200 }));
	}

	addNode(node: Node) {
		this.container.addChild(node.get());
	}

	addEventListeners() {
		this.container.on('mousedown', this.onMouseDown.bind(this));
		this.container.on('mouseup', this.onMouseUp.bind(this));
		this.container.on('mousemove', this.onMouseMove.bind(this));
	}

	onMouseDown(event: Event) {
		const mousePosition = this.getMousePosition(event as MouseEvent);
	}

	onMouseUp() {
		this.isDragging = false;
	}

	onMouseMove(event: Event) {
		if (this.isDragging) {
			const newPosition: IPointData = this.getMousePosition(event as MouseEvent);
		}
	}

	onResize() {
		if (this.resizeTimeout) {
			clearTimeout(this.resizeTimeout);
		}
		this.resizeTimeout = setTimeout(() => {
			this.app.renderer.resize(window.innerWidth, window.innerHeight);
			this.app.view.width = window.innerWidth * window.devicePixelRatio;
			this.app.view.height = window.innerHeight * window.devicePixelRatio;
		}, 100);
	}

	getMousePosition(event: MouseEvent): IPointData {
		return { x: event.clientX, y: event.clientY };
	}
}
