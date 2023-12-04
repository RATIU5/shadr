<script lang="ts">
	import { contextMenu, type ContextItem } from './context-menu/context-menu';

	const items: ContextItem[] = [
		{ label: 'Select All', action: () => console.log('Select All') },
		{ label: 'Copy', action: () => console.log('Copy') },
		{ label: 'Cut', action: () => console.log('Cut') },
		{ label: 'Paste', action: () => console.log('Paste') }
	];
</script>

<canvas use:contextMenu={items} class="w-screen h-screen"></canvas>
