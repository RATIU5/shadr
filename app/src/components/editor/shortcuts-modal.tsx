import { For, Show } from "solid-js";

import type { ShortcutGroup } from "./types";

type ShortcutsModalProps = {
	open: boolean;
	groups: ShortcutGroup[];
	onClose: () => void;
};

export const ShortcutsModal = (props: ShortcutsModalProps) => (
	<Show when={props.open}>
		<div
			class="fixed inset-0 z-[9] flex items-start justify-center bg-transparent px-4 py-10"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) {
					props.onClose();
				}
			}}
		>
			<div
				class="w-full max-w-3xl max-h-[calc(100vh-80px)] overflow-y-auto rounded-lg border border-[#2a3241] bg-[#0f131c] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
				onPointerDown={(event) => event.stopPropagation()}
			>
				<div class="flex items-center justify-between gap-2">
					<div class="text-[12px] uppercase tracking-[0.2em] text-[#7f8796]">
						Shortcuts
					</div>
					<button
						type="button"
						class="rounded-full border border-[#2c3445] bg-[#171c26] px-3 py-1 text-[11px] text-[#e4e9f2] hover:bg-[#1f2736]"
						onClick={props.onClose}
					>
						Close
					</button>
				</div>
				<div class="mt-4 grid gap-4">
					<For each={props.groups}>
						{(group) => (
							<div class="rounded-lg border border-[#1f2430] bg-[#0c1018] p-3">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<div class="text-[12px] uppercase tracking-[0.12em] text-[#b9c2cf]">
										{group.label}
									</div>
									<div class="text-[10px] uppercase tracking-[0.16em] text-[#6f7786]">
										{group.hint}
									</div>
								</div>
								<div class="mt-3 grid gap-2">
									<For each={group.entries}>
										{(entry) => (
											<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1b2230] bg-[#0f141f] px-2.5 py-2">
												<div class="flex min-w-[160px] flex-col gap-0.5">
													<div class="text-[12px] text-[#d7dde7]">
														{entry.description}
													</div>
													<Show when={entry.detail}>
														{(detail) => (
															<div class="text-[10px] text-[#7f8796]">
																{detail()}
															</div>
														)}
													</Show>
												</div>
												<div class="flex flex-wrap items-center justify-end gap-1.5 text-[10px] uppercase tracking-[0.12em] text-[#c0cad8]">
													<For each={entry.keys}>
														{(key) => (
															<span class="rounded-full border border-[#2b3546] bg-[#151b28] px-2 py-1 text-[10px] uppercase tracking-[0.12em]">
																{key}
															</span>
														)}
													</For>
												</div>
											</div>
										)}
									</For>
								</div>
							</div>
						)}
					</For>
				</div>
			</div>
		</div>
	</Show>
);
