import { React } from '$lib/react';

export class EditorState {
	public static readonly MIN_GRID_ZOOM = 0.25;
	public static readonly MAX_GRID_ZOOM = 3.0;

	#_zoomFactor: React<number>;

	constructor() {
		this.#_zoomFactor = new React(1);
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

	public addZoomFactorCallback(callback: (value: number) => void) {
		this.#_zoomFactor.addZoomFactorCallback(callback);
	}
}
