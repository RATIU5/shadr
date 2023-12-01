<script lang="ts">
	import { tick } from 'svelte';

	let mouseX = $state(0);
	let mouseY = $state(0);
	let showContextMenu = $state(false);
	let contextMenu: HTMLElement;
	let canvasElement: HTMLCanvasElement;

	async function handleContextMenu(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		showContextMenu = true;

		await tick();

		const contextRect = contextMenu.getBoundingClientRect();
		const canvasRect = canvasElement.getBoundingClientRect();
		if (contextRect.width + (e as MouseEvent).clientX > canvasRect.width) {
			mouseX = (e as MouseEvent).clientX - contextRect.width;
		} else {
			mouseX = (e as MouseEvent).clientX;
		}
		if (contextRect.height + (e as MouseEvent).clientY > canvasRect.height) {
			mouseY = (e as MouseEvent).clientY - contextRect.height;
		} else {
			mouseY = (e as MouseEvent).clientY;
		}

		document.addEventListener('click', handleOuterClick);
	}

	function handleOuterClick(e: Event) {
		let inside = (e.target! as HTMLElement).closest('#context-menu');
		if (!inside) {
			showContextMenu = false;
			document.removeEventListener('click', handleOuterClick);
		}
	}
</script>

<div
	bind:this={contextMenu}
	id="context-menu"
	class="absolute bg-neutral-800 shadow-xl rounded-md p-1 inset-border min-w-52"
	style="display: {showContextMenu ? 'block' : 'none'}; top:{mouseY}px; left:{mouseX}px;"
>
	<ul class="text-neutral-300 text-sm">
		<li class="hover:bg-neutral-700 rounded cursor-pointer py-2 px-3 flex items-center gap-2">
			<p>Select All</p>
		</li>
		<li class="hover:bg-neutral-700 rounded cursor-pointer py-2 px-3 flex items-center gap-2">
			<p>Copy</p>
		</li>
		<li class="hover:bg-neutral-700 rounded cursor-pointer py-2 px-3 flex items-center gap-2">
			<p>Cut</p>
		</li>
		<li class="hover:bg-neutral-700 rounded cursor-pointer py-2 px-3 flex items-center gap-2">
			<p>Paste</p>
		</li>
	</ul>
</div>
<canvas oncontextmenu={handleContextMenu} bind:this={canvasElement} class="w-screen h-screen"
></canvas>
