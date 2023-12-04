<script lang="ts">
	import { contextMenu, type ContextItem } from './context-menu/context-menu';
	import { editor } from './editor';

	const items: ContextItem[] = [
		{ type: 'item', label: 'Create new node', action: () => console.log('n') },
		{ type: 'item', label: 'Select all', action: () => console.log('a') },
		{ type: 'separator' },
		{ type: 'item', label: 'Zoom in', action: () => console.log('+') },
		{ type: 'item', label: 'Zoom out', action: () => console.log('-') },
		{ type: 'item', label: 'Reset zoom', action: () => console.log('z') }
	];
</script>

<canvas use:contextMenu={items} use:editor class="w-screen h-screen"></canvas>
