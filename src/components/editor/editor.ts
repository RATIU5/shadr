import { NodeEditor } from '$lib/editor/editor';

export function editor(node: HTMLCanvasElement) {
	new NodeEditor(node);
	return {
		destroy() {}
	};
}
