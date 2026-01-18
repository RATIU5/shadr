import type { NodeRenameState } from "@shadr/lib-editor";
import { Show } from "solid-js";

type NodeRenameOverlayProps = {
	state: NodeRenameState | null;
	value: string;
	onChange: (value: string) => void;
	onApply: () => void;
	onKeyDown: (event: KeyboardEvent) => void;
	setInputRef: (element: HTMLInputElement) => void;
};

export const NodeRenameOverlay = (props: NodeRenameOverlayProps) => (
	<Show when={props.state}>
		{(state) => (
			<div
				class="absolute inset-0 z-[6]"
				onPointerDown={(event) => {
					if (event.target === event.currentTarget) {
						props.onApply();
					}
				}}
			>
				<div
					class="absolute min-w-[180px] bg-[#151924] border border-[#2a3342] rounded-lg p-2 shadow-[0_14px_30px_rgba(0,0,0,0.4)] flex flex-col gap-2"
					style={{
						left: `${state().screenX}px`,
						top: `${state().screenY}px`,
					}}
					onPointerDown={(event) => event.stopPropagation()}
				>
					<div class="text-[11px] uppercase tracking-[0.12em] text-[#9aa6b5]">
						Rename Node
					</div>
					<input
						ref={(element) => props.setInputRef(element)}
						type="text"
						value={props.value}
						class="w-48 px-2 py-1.5 rounded border border-[#2a3342] bg-[#0f131b] text-[#f4f5f7] text-[12px] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]"
						onInput={(event) => props.onChange(event.currentTarget.value)}
						onBlur={props.onApply}
						onKeyDown={props.onKeyDown}
					/>
				</div>
			</div>
		)}
	</Show>
);
