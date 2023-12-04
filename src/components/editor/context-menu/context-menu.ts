export type ContextItem = {
	type: 'item' | 'separator';
	label?: string;
	action?: () => void;
	disabled?: boolean;
};

export function contextMenu(node: HTMLElement, items: ContextItem[]) {
	const menu = document.createElement('ul');
	menu.id = 'context-menu';
	menu.className =
		'absolute bg-neutral-800 shadow-xl rounded-md p-1 inset-border min-w-52 text-neutral-300 text-[13px] z-10';
	menu.style.display = 'none';
	document.body.appendChild(menu);

	function updateMenuItems() {
		menu.innerHTML = '';
		items.forEach((item) => {
			const li = document.createElement('li');
			li.className =
				'hover:bg-neutral-700 rounded cursor-pointer py-2 px-2 flex items-center gap-2';
			li.textContent = item.label ?? '';
			if (!item.disabled) {
				li.addEventListener('click', () => {
					item.action && item.action();
					menu.style.display = 'none';
				});
			}
			menu.appendChild(li);
		});
	}

	updateMenuItems();

	function handleOuterClick(event: MouseEvent) {
		if (!menu.contains(event.target as Node)) {
			menu.style.display = 'none';
			document.removeEventListener('click', handleOuterClick);
		}
	}

	node.addEventListener('contextmenu', function (e) {
		e.preventDefault();

		const x = e.clientX;
		const y = e.clientY;
		menu.style.top = `${y}px`;
		menu.style.left = `${x}px`;
		menu.style.display = 'block';

		document.addEventListener('click', handleOuterClick);
	});

	return {
		destroy() {
			document.body.removeChild(menu);
			node.removeEventListener('contextmenu', handleOuterClick);
		},
		update(newItems: Array<ContextItem>) {
			items = newItems;
			updateMenuItems();
		}
	};
}
