import type { EditorSelectionState, SelectionBounds } from "@shadr/lib-editor";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

type FloatingSelectionToolbarProps = {
	selection: EditorSelectionState;
	bounds: SelectionBounds | null;
	stageRef?: HTMLDivElement;
	isBypassed: boolean;
	canCopy: boolean;
	canCreateGroup: boolean;
	canChangeColor: boolean;
	canSavePreset: boolean;
	onCopy: () => void;
	onCreateGroup: () => void;
	onConvertToGroup: () => void;
	onDelete: () => void;
	onSavePreset: () => void;
	onReplaceNode: () => void;
	onToggleBypass: () => void;
	onChangeColorTag: (value: string | null) => void;
};

const colorTags = [
	{ id: "none", label: "None", color: "#334155" },
	{ id: "sky", label: "Sky", color: "#38bdf8" },
	{ id: "mint", label: "Mint", color: "#34d399" },
	{ id: "amber", label: "Amber", color: "#f59e0b" },
	{ id: "rose", label: "Rose", color: "#fb7185" },
	{ id: "violet", label: "Violet", color: "#a855f7" },
];

export const FloatingSelectionToolbar = (
	props: FloatingSelectionToolbarProps,
) => {
	let toolbarRef: HTMLDivElement | undefined;
	const [position, setPosition] = createSignal({
		x: 0,
		y: 0,
		visible: false,
	});

	const hasNodeSelection = createMemo(() => {
		const selection = props.selection;
		if (selection.kind === "node") {
			return true;
		}
		if (selection.kind === "multi") {
			return selection.nodes.length > 0;
		}
		return false;
	});

	const isSingleNode = createMemo(() => props.selection.kind === "node");

	createEffect(() => {
		const bounds = props.bounds;
		if (!bounds || !hasNodeSelection()) {
			setPosition({ x: 0, y: 0, visible: false });
			return;
		}

		const offset = 12;
		const padding = 12;
		const baseX = (bounds.screen.minX + bounds.screen.maxX) / 2;
		const baseY = bounds.screen.minY - offset;
		let nextX = baseX;
		let nextY = baseY;

		const width = toolbarRef?.offsetWidth ?? 0;
		const height = toolbarRef?.offsetHeight ?? 0;
		const stageRect = props.stageRef?.getBoundingClientRect();
		if (stageRect && width > 0 && height > 0) {
			const minX = width / 2 + padding;
			const maxX = stageRect.width - width / 2 - padding;
			nextX = Math.min(maxX, Math.max(minX, nextX));

			const minY = height + padding;
			const maxY = stageRect.height - padding;
			nextY = Math.min(maxY, Math.max(minY, nextY));
		}

		setPosition({ x: nextX, y: nextY, visible: true });
	});

	const actionButtonClass =
		"rounded-full border border-[#2b3445] bg-[#141b28] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[#d8e0ee] transition hover:bg-[#1d2637] disabled:cursor-not-allowed disabled:opacity-40";

	return (
		<Show when={position().visible}>
			<div class="pointer-events-none absolute left-0 top-0 z-[7] h-full w-full">
				<div
					ref={(element) => {
						toolbarRef = element;
					}}
					class="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-[#232c3a] bg-[rgba(12,16,23,0.92)] px-3 py-2 text-[11px] text-[#d8e0ee] shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur"
					style={{
						left: `${position().x}px`,
						top: `${position().y}px`,
						transform: "translate(-50%, -100%)",
						position: "absolute",
					}}
				>
					<Show when={props.canChangeColor}>
						<div class="flex items-center gap-2">
							<span class="text-[10px] uppercase tracking-[0.18em] text-[#8d98ab]">
								Tag
							</span>
							<div class="flex items-center gap-1">
								<For each={colorTags}>
									{(tag) => (
										<button
											type="button"
											title={tag.label}
											class="h-5 w-5 rounded-full border border-[#2b3445] bg-[#111723] transition hover:scale-105"
											onClick={() =>
												props.onChangeColorTag(
													tag.id === "none" ? null : tag.color,
												)
											}
										>
											<span
												class="block h-full w-full rounded-full"
												style={{ "background-color": tag.color }}
											/>
										</button>
									)}
								</For>
							</div>
						</div>
					</Show>
					<button
						type="button"
						class={actionButtonClass}
						disabled={!props.canCopy}
						onClick={props.onCopy}
					>
						Copy
					</button>
					<button
						type="button"
						class={actionButtonClass}
						disabled={!props.canSavePreset}
						onClick={props.onSavePreset}
					>
						Save Preset
					</button>
					<Show when={isSingleNode()}>
						<button
							type="button"
							class={actionButtonClass}
							classList={{
								"border-[#5fa8ff] text-[#cfe6ff]": props.isBypassed,
							}}
							onClick={props.onToggleBypass}
						>
							{props.isBypassed ? "Bypassed" : "Bypass"}
						</button>
						<button
							type="button"
							class={actionButtonClass}
							onClick={props.onConvertToGroup}
						>
							Convert to Group
						</button>
						<button
							type="button"
							class={actionButtonClass}
							onClick={props.onReplaceNode}
						>
							Replace
						</button>
					</Show>
					<Show when={!isSingleNode()}>
						<button
							type="button"
							class={actionButtonClass}
							disabled={!props.canCreateGroup}
							onClick={props.onCreateGroup}
						>
							Create Group
						</button>
					</Show>
					<button
						type="button"
						class={actionButtonClass}
						onClick={props.onDelete}
					>
						Delete
					</button>
				</div>
			</div>
		</Show>
	);
};
