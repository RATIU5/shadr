import { NodeEditor } from '$lib/editor/editor';
import type { EditorState } from '$lib/editor/editor-state';

export function editor(node: HTMLCanvasElement, editorState: EditorState) {
	new NodeEditor(node, editorState);
	return {
		destroy() {}
	};
}
