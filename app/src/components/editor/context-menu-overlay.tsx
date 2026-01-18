import type { ContextMenuItem, ContextMenuState } from "@shadr/lib-editor";
import { For, Show } from "solid-js";

type ContextMenuOverlayProps = {
	state: ContextMenuState | null;
	position: { x: number; y: number };
	onClose: () => void;
	onItem: (item: ContextMenuItem) => void;
	setMenuRef: (element: HTMLDivElement) => void;
};

export const ContextMenuOverlay = (props: ContextMenuOverlayProps) => (
	<Show when={props.state}>
		{(state) => (
			<div
				class="absolute inset-0 z-[5]"
				onPointerDown={(event) => {
					if (event.target === event.currentTarget) {
						props.onClose();
					}
				}}
			>
				<div
					class="absolute min-w-[180px] max-h-[60vh] overflow-y-auto bg-[#151924] border border-[#262d3a] rounded-lg p-2 shadow-[0_16px_36px_rgba(0,0,0,0.45)] flex flex-col gap-1"
					ref={(element) => props.setMenuRef(element)}
					style={{
						left: `${props.position.x}px`,
						top: `${props.position.y}px`,
					}}
					onPointerDown={(event) => event.stopPropagation()}
				>
					<For each={state().items}>
						{(item) => (
							<button
								type="button"
								class="text-left rounded-lg border border-transparent bg-transparent py-1.5 px-2.5 text-[12px] text-[#d7dde7] hover:bg-[#1f2736] disabled:opacity-45 disabled:cursor-default disabled:hover:bg-transparent"
								disabled={!item.enabled}
								onClick={() => props.onItem(item)}
							>
								{item.label}
							</button>
						)}
					</For>
				</div>
			</div>
		)}
	</Show>
);
