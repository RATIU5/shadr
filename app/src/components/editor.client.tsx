import { initCanvas } from "@shadr/lib-editor";
import { onMount } from "solid-js";

export default function Editor() {
	let canvasRef;

	onMount(async () => {
		await initCanvas(canvasRef);
	});

	return <canvas ref={canvasRef} id="editor-canvas" />;
}
