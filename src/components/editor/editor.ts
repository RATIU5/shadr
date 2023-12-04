import { NodeEditor } from '$lib/editor/editor';

export function editor(node: HTMLElement) {
	const editor = new NodeEditor(node as HTMLCanvasElement);
	return {
		destroy() {}
	};
}
