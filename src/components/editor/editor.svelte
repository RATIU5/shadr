<script lang="ts">
	let canvas: HTMLCanvasElement;

	$effect(() => {
		canvas.addEventListener('contextmenu', (e) => {
			e.preventDefault();
		});
	});
</script>

<canvas bind:this={canvas} class="w-full h-full"></canvas>
