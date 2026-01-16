import { Application } from "pixi.js";

export async function initCanvas(canvas: HTMLCanvasElement) {
	const app = new Application();

	await app.init({
		canvas,
		resizeTo: canvas.parentElement ?? undefined,
	});

	return app;
}
