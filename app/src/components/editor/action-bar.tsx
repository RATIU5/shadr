import { For, Show } from "solid-js";

import type { ActionMenuDefinition, ActionMenuId } from "./types";

type ActionBarProps = {
	actionMenus: ActionMenuDefinition[];
	openActionMenu: ActionMenuId | null;
	onOpenSearch: () => void;
	onOpenSettings: () => void;
	onToggleActionMenu: (menu: ActionMenuId) => void;
	onRunMenuItem: (action: () => void) => void;
	setActionMenuRef: (element: HTMLDivElement) => void;
};

export const ActionBar = (props: ActionBarProps) => (
	<div class="fixed bottom-4 left-1/2 z-[7] w-[min(980px,calc(100%-32px))] -translate-x-1/2">
		<div
			ref={(element) => props.setActionMenuRef(element)}
			class="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-[#2a3241] bg-[rgba(14,18,26,0.92)] px-4 py-2 shadow-[0_18px_42px_rgba(0,0,0,0.45)] backdrop-blur"
		>
			<button
				type="button"
				class="flex items-center gap-2 rounded-full border border-[#2c3445] bg-[#171c26] px-3 py-1 text-[11px] text-[#e4e9f2] hover:bg-[#1f2736]"
				onClick={props.onOpenSearch}
			>
				Add Node
			</button>
			<button
				type="button"
				class="flex items-center gap-2 rounded-full border border-[#2c3445] bg-[#171c26] px-3 py-1 text-[11px] text-[#e4e9f2] hover:bg-[#1f2736]"
				onClick={props.onOpenSettings}
			>
				Settings
			</button>
			<For each={props.actionMenus}>
				{(menu) => (
					<div class="relative">
						<button
							type="button"
							class="flex items-center gap-2 rounded-full border border-[#2c3445] bg-[#171c26] px-3 py-1 text-[11px] text-[#e4e9f2] hover:bg-[#1f2736]"
							classList={{
								"bg-[#1f2736]": props.openActionMenu === menu.id,
							}}
							onClick={() => props.onToggleActionMenu(menu.id)}
						>
							{menu.label}
						</button>
						<Show when={props.openActionMenu === menu.id}>
							<div class="absolute bottom-full left-1/2 z-[8] mb-2 w-[200px] -translate-x-1/2 rounded-xl border border-[#2a3241] bg-[#0f131c] p-1 shadow-[0_18px_32px_rgba(0,0,0,0.35)]">
								<For each={menu.items}>
									{(item) => (
										<button
											type="button"
											class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-[#d7dde7] hover:bg-[#1b2230]"
											classList={{
												"cursor-not-allowed opacity-50": item.disabled,
											}}
											disabled={item.disabled}
											aria-disabled={item.disabled}
											onClick={() => {
												if (item.disabled) {
													return;
												}
												props.onRunMenuItem(item.action);
											}}
										>
											<span>{item.label}</span>
										</button>
									)}
								</For>
							</div>
						</Show>
					</div>
				)}
			</For>
		</div>
	</div>
);
