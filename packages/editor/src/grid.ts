import type { Application, Container, Graphics } from "pixi.js";
import { defaultVisualSettings, type GridSettings } from "./visual-settings";

type GridState = {
	width: number;
	height: number;
	pivotX: number;
	pivotY: number;
	scale: number;
	settingsKey: string;
};

const defaultGridSettings: GridSettings = defaultVisualSettings.grid;

export const createGridRenderer = ({
	app,
	camera,
	grid,
	getSettings,
}: {
	app: Application;
	camera: Container;
	grid: Graphics;
	getSettings?: () => Partial<GridSettings>;
}) => {
	const gridState: GridState = {
		width: 0,
		height: 0,
		pivotX: 0,
		pivotY: 0,
		scale: 1,
		settingsKey: "",
	};

	const resolveSettings = () => ({
		...defaultGridSettings,
		...(getSettings ? getSettings() : {}),
	});

	const buildSettingsKey = (settings: GridSettings) =>
		[
			settings.minorStep,
			settings.majorStep,
			settings.minScreenSpacing,
			settings.maxScreenSpacing,
			settings.minorColor,
			settings.majorColor,
			settings.axisColor,
			settings.minorAlpha,
			settings.majorAlpha,
			settings.axisAlpha,
		].join("|");

	const getMinorFade = (scale: number, settings: GridSettings) => {
		const screenSpacing = settings.minorStep * scale;
		const range = settings.maxScreenSpacing - settings.minScreenSpacing;
		const clamped =
			range > 0
				? Math.min(
						1,
						Math.max(0, (screenSpacing - settings.minScreenSpacing) / range),
					)
				: 1;
		const minFade = 0.15;
		return minFade + (1 - minFade) * clamped;
	};

	const drawGrid = (width: number, height: number, settings: GridSettings) => {
		const scale = camera.scale.x || 1;
		const minorStep = settings.minorStep;
		const majorStep = settings.majorStep;
		const minorFade = getMinorFade(scale, settings);
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
			color: settings.minorColor,
			alpha: settings.minorAlpha * minorFade,
			cap: "round",
			join: "round",
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
			color: settings.majorColor,
			alpha: settings.majorAlpha,
			cap: "round",
			join: "round",
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
			color: settings.axisColor,
			alpha: settings.axisAlpha,
			cap: "round",
			join: "round",
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
		const settings = resolveSettings();
		const settingsKey = buildSettingsKey(settings);

		if (width !== gridState.width || height !== gridState.height) {
			camera.position.set(width / 2, height / 2);
		}

		if (
			width !== gridState.width ||
			height !== gridState.height ||
			camera.pivot.x !== gridState.pivotX ||
			camera.pivot.y !== gridState.pivotY ||
			scale !== gridState.scale ||
			settingsKey !== gridState.settingsKey
		) {
			gridState.width = width;
			gridState.height = height;
			gridState.pivotX = camera.pivot.x;
			gridState.pivotY = camera.pivot.y;
			gridState.scale = scale;
			gridState.settingsKey = settingsKey;
			drawGrid(width, height, settings);
		}
	};

	return { updateScene };
};
