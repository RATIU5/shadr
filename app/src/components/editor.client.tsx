import { initCanvas } from "@shadr/lib-editor";
import { onCleanup, onMount } from "solid-js";

export default function Editor() {
	let canvasRef: HTMLCanvasElement | undefined;

	onMount(async () => {
		if (!canvasRef) {
			return;
		}

		const app = await initCanvas(canvasRef);

		onCleanup(() => {
			app.destroy(true);
		});
	});

	return <canvas ref={canvasRef} id="editor-canvas" />;
}
