import { React } from '$lib/utils/react';
import type { IPointData } from 'pixi.js';

export class EditorState {
	public static readonly MIN_GRID_ZOOM = 0.25;
	public static readonly MAX_GRID_ZOOM = 3.0;

	#_zoomFactor: React<number>;
	#_dragOffset: React<IPointData>;

	constructor() {
		this.#_zoomFactor = new React(1);
		this.#_dragOffset = new React({ x: 0, y: 0 });
	}

	get zoomFactor(): number {
		return this.#_zoomFactor.value;
	}

	set zoomFactor(val: number) {
		this.#_zoomFactor.value = Math.max(
			EditorState.MIN_GRID_ZOOM,
			Math.min(EditorState.MAX_GRID_ZOOM, val)
		);
	}

	get dragOffset(): IPointData {
		return this.#_dragOffset.value;
	}

	set dragOffset(val: IPointData) {
		this.#_dragOffset.value = val;
	}

	public addZoomFactorCallback(callback: (value: number) => void) {
		this.#_zoomFactor.addValueCallback(callback);
	}

	public addDragOffsetCallback(callback: (value: IPointData) => void) {
		this.#_dragOffset.addValueCallback(callback);
	}
}
