import type { Application, Container, Graphics } from "pixi.js";

type GridSettings = {
	minorStep: number;
	majorStep: number;
	minScreenSpacing: number;
	maxScreenSpacing: number;
	minorColor: number;
	majorColor: number;
	axisColor: number;
	minorAlpha: number;
	majorAlpha: number;
	axisAlpha: number;
};

type GridState = {
	width: number;
	height: number;
	pivotX: number;
	pivotY: number;
	scale: number;
};

const defaultGridSettings: GridSettings = {
	minorStep: 32,
	majorStep: 160,
	minScreenSpacing: 12,
	maxScreenSpacing: 96,
	minorColor: 0xd6d6d6,
	majorColor: 0xb0b0b0,
	axisColor: 0x8a8a8a,
	minorAlpha: 0.35,
	majorAlpha: 0.6,
	axisAlpha: 0.9,
};

export const createGridRenderer = ({
	app,
	camera,
	grid,
	settings,
}: {
	app: Application;
	camera: Container;
	grid: Graphics;
	settings?: Partial<GridSettings>;
}) => {
	const resolvedSettings = { ...defaultGridSettings, ...settings };
	const gridState: GridState = {
		width: 0,
		height: 0,
		pivotX: 0,
		pivotY: 0,
		scale: 1,
	};

	const getScaledSteps = (scale: number) => {
		const ratio = resolvedSettings.majorStep / resolvedSettings.minorStep;
		let minorStep = resolvedSettings.minorStep;
		let majorStep = resolvedSettings.majorStep;
		let screenSpacing = minorStep * scale;

		while (screenSpacing < resolvedSettings.minScreenSpacing) {
			minorStep *= 2;
			majorStep = minorStep * ratio;
			screenSpacing = minorStep * scale;
		}

		while (screenSpacing > resolvedSettings.maxScreenSpacing && minorStep > 1) {
			minorStep /= 2;
			majorStep = minorStep * ratio;
			screenSpacing = minorStep * scale;
		}

		return { minorStep, majorStep };
	};

	const drawGrid = (width: number, height: number) => {
		const scale = camera.scale.x || 1;
		const { minorStep, majorStep } = getScaledSteps(scale);
		const halfWidth = width / (2 * scale);
		const halfHeight = height / (2 * scale);
		const left = camera.pivot.x - halfWidth;
		const right = camera.pivot.x + halfWidth;
		const top = camera.pivot.y - halfHeight;
		const bottom = camera.pivot.y + halfHeight;

		const minorStartX = Math.floor(left / minorStep) * minorStep;
		const minorEndX = Math.ceil(right / minorStep) * minorStep;
		const minorStartY = Math.floor(top / minorStep) * minorStep;
		const minorEndY = Math.ceil(bottom / minorStep) * minorStep;
		const majorStartX = Math.floor(left / majorStep) * majorStep;
		const majorEndX = Math.ceil(right / majorStep) * majorStep;
		const majorStartY = Math.floor(top / majorStep) * majorStep;
		const majorEndY = Math.ceil(bottom / majorStep) * majorStep;

		grid.clear();

		grid.setStrokeStyle({
			width: 1 / scale,
			color: resolvedSettings.minorColor,
			alpha: resolvedSettings.minorAlpha,
		});

		for (let x = minorStartX; x <= minorEndX; x += minorStep) {
			grid.moveTo(x, top);
			grid.lineTo(x, bottom);
		}

		for (let y = minorStartY; y <= minorEndY; y += minorStep) {
			grid.moveTo(left, y);
			grid.lineTo(right, y);
		}

		grid.stroke();

		grid.setStrokeStyle({
			width: 1 / scale,
			color: resolvedSettings.majorColor,
			alpha: resolvedSettings.majorAlpha,
		});

		for (let x = majorStartX; x <= majorEndX; x += majorStep) {
			grid.moveTo(x, top);
			grid.lineTo(x, bottom);
		}

		for (let y = majorStartY; y <= majorEndY; y += majorStep) {
			grid.moveTo(left, y);
			grid.lineTo(right, y);
		}

		grid.stroke();

		grid.setStrokeStyle({
			width: 2 / scale,
			color: resolvedSettings.axisColor,
			alpha: resolvedSettings.axisAlpha,
		});
		grid.moveTo(0, top);
		grid.lineTo(0, bottom);
		grid.moveTo(left, 0);
		grid.lineTo(right, 0);
		grid.stroke();
	};

	const updateScene = () => {
		const screen = app.renderer.screen;
		const width = screen.width;
		const height = screen.height;
		const scale = camera.scale.x || 1;

		if (width !== gridState.width || height !== gridState.height) {
			camera.position.set(width / 2, height / 2);
		}

		if (
			width !== gridState.width ||
			height !== gridState.height ||
			camera.pivot.x !== gridState.pivotX ||
			camera.pivot.y !== gridState.pivotY ||
			scale !== gridState.scale
		) {
			gridState.width = width;
			gridState.height = height;
			gridState.pivotX = camera.pivot.x;
			gridState.pivotY = camera.pivot.y;
			gridState.scale = scale;
			drawGrid(width, height);
		}
	};

	return { updateScene };
};
