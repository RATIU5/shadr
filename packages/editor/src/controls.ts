export type CameraState = {
	pivotX: number;
	pivotY: number;
	scale: number;
};

export type PanInput = {
	deltaX: number;
	deltaY: number;
};

export type ZoomLimits = {
	min: number;
	max: number;
};

export type ZoomInput = {
	cursorX: number;
	cursorY: number;
	deltaY: number;
	screenHeight: number;
	screenWidth: number;
	limits: ZoomLimits;
};

export const applyPan = (state: CameraState, input: PanInput): CameraState => {
	const scale = state.scale || 1;

	return {
		pivotX: state.pivotX - input.deltaX / scale,
		pivotY: state.pivotY - input.deltaY / scale,
		scale: state.scale,
	};
};

export const applyZoom = (
	state: CameraState,
	input: ZoomInput,
): CameraState => {
	const scale = state.scale || 1;
	const zoomFactor = Math.exp(-input.deltaY * 0.0015);
	const nextScale = Math.min(
		input.limits.max,
		Math.max(input.limits.min, scale * zoomFactor),
	);

	if (nextScale === scale) {
		return state;
	}

	const offsetX = input.cursorX - input.screenWidth / 2;
	const offsetY = input.cursorY - input.screenHeight / 2;
	const worldX = state.pivotX + offsetX / scale;
	const worldY = state.pivotY + offsetY / scale;

	return {
		pivotX: worldX - offsetX / nextScale,
		pivotY: worldY - offsetY / nextScale,
		scale: nextScale,
	};
};
