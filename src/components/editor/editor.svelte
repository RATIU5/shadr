<script lang="ts">
	import { contextMenu, type ContextItem } from './context-menu/context-menu';
	import { editor } from './editor';
	import { grid } from './grid/grid';

	const items: ContextItem[] = [
		{ label: 'Select All', action: () => console.log('Select All') },
		{ label: 'Copy', action: () => console.log('Copy') },
		{ label: 'Cut', action: () => console.log('Cut') },
		{ label: 'Paste', action: () => console.log('Paste') }
	];
</script>

<canvas use:contextMenu={items} use:editor class="w-screen h-screen"></canvas>
