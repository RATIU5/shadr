<script lang="ts">
	import { contextMenu, type ContextItem } from './context-menu/context-menu';
	import { editor } from './editor';

	// State will exist here

	const items: ContextItem[] = [
		{
			type: 'item',
			label: 'Create new node',
			items: [
				{ type: 'item', label: 'Input', action: () => console.log('i') },
				{
					type: 'item',
					label: 'Output',
					items: [
						{ type: 'item', label: 'Output', action: () => console.log('o') },
						{ type: 'item', label: 'Output', action: () => console.log('o') },
						{ type: 'item', label: 'Output', action: () => console.log('o') },
						{ type: 'item', label: 'Output', action: () => console.log('o') },
						{ type: 'item', label: 'Output', action: () => console.log('o') },
						{ type: 'item', label: 'Output', action: () => console.log('o') },
						{ type: 'item', label: 'Output', action: () => console.log('o') },
						{ type: 'item', label: 'Output', action: () => console.log('o') },
						{ type: 'item', label: 'Output', action: () => console.log('o') }
					]
				},
				{ type: 'item', label: 'Process', action: () => console.log('p') }
			]
		},
		{ type: 'item', label: 'Select all', action: () => console.log('a'), disabled: true },
		{ type: 'separator' },
		{ type: 'item', label: 'Zoom in', action: () => console.log('+') },
		{ type: 'item', label: 'Zoom out', action: () => console.log('-') },
		{ type: 'item', label: 'Reset zoom', action: () => console.log('z') }
	];
</script>

<canvas use:contextMenu={items} use:editor class="w-screen h-screen"></canvas>
