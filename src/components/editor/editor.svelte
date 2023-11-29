<script lang="ts">
	import { NodeEditor } from '$lib/editor/editor';

	let canvas: HTMLCanvasElement | null = null;
	if (canvas) {
		new NodeEditor(canvas);
	}
</script>

<canvas bind:this={canvas} id="editor" class="w-screen h-screen" />
