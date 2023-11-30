<script>
	import ContextMenuItem from '../components/editor/context-menu/context-menu-item.svelte';
	import ContextMenu from '../components/editor/context-menu/context-menu.svelte';
	import { IconBoxMultiple, IconGridDots, IconSquarePlus2 } from '@tabler/icons-svelte';
</script>

<ContextMenu>
	<ContextMenuItem>
		<IconSquarePlus2 slot="icon" size={18} stroke={1.5} />
		<p class="select-none">Add new node</p>
	</ContextMenuItem>
	<ContextMenuItem>
		<IconBoxMultiple slot="icon" size={18} stroke={1.5} />
		<p class="select-none">Select all</p>
	</ContextMenuItem>
	<ContextMenuItem>
		<IconGridDots slot="icon" size={18} stroke={1.5} />
		<p class="select-none">Toggle Grid</p>
	</ContextMenuItem>
</ContextMenu>
