<script lang="ts">
	import { contextMenu, type ContextItem } from './context-menu/context-menu';
	import { editor } from './editor';
	import { EditorState } from '../../lib/editor/editor-state';

	const editorState = new EditorState();

	const items: ContextItem[] = [
		{
			type: 'item',
			label: 'Add new node',
			items: [
				{ type: 'item', label: 'Input&nbsp;node', action: () => console.log('i') },
				{ type: 'item', label: 'Output&nbsp;node', action: () => console.log('o') }
			]
		},
		{ type: 'item', label: 'Select all', action: () => console.log('a'), disabled: true },
		{ type: 'separator' },
		{ type: 'item', label: 'Zoom in', action: () => (editorState.zoomFactor -= 0.5) },
		{ type: 'item', label: 'Zoom out', action: () => (editorState.zoomFactor += 0.5) },
		{
			type: 'item',
			label: 'Reset view',
			action: () => {
				editorState.dragOffset = { x: 0, y: 0 };
				editorState.zoomFactor = 1;
			}
		}
	];
</script>

<canvas use:contextMenu={items} use:editor={editorState} class="w-screen h-screen"></canvas>
