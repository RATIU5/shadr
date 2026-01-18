import { For, Show } from "solid-js";

import type { ActionMenuDefinition, ActionMenuId } from "./types";

type ActionBarProps = {
	actionMenus: ActionMenuDefinition[];
	openActionMenu: ActionMenuId | null;
	onOpenSearch: (query?: string) => void;
	onOpenSettings: () => void;
	onToggleActionMenu: (menu: ActionMenuId) => void;
	onRunMenuItem: (action: () => void) => void;
	setActionMenuRef: (element: HTMLDivElement) => void;
	searchValue: string;
	onSearchChange: (value: string) => void;
	onSearchBlur: () => void;
	onCompileShader: () => void;
	onExportShader: () => void;
	exportDisabled: boolean;
	activeMode: "edit" | "preview" | "debug";
	onModeChange: (mode: "edit" | "preview" | "debug") => void;
	compileStatus: "idle" | "compiling" | "success" | "failed";
	compileMs: number | null;
	lastCompileAt: string | null;
};

export const ActionBar = (props: ActionBarProps) => {
	const statusLabel = () => {
		switch (props.compileStatus) {
			case "compiling":
				return "Compiling";
			case "success":
				return "Success";
			case "failed":
				return "Failed";
			default:
				return "Idle";
		}
	};
	const statusClass = () => {
		switch (props.compileStatus) {
			case "compiling":
				return "border-[#234869] bg-[#0e1a2a] text-[#9cc4ff]";
			case "success":
				return "border-[#244a39] bg-[#0f1c16] text-[#98f5c3]";
			case "failed":
				return "border-[#4c2c2c] bg-[#201417] text-[#ff9a8a]";
			default:
				return "border-[#2c3445] bg-[#121822] text-[#9aa6b5]";
		}
	};
	const indicatorClass = () => {
		switch (props.compileStatus) {
			case "compiling":
				return "bg-[#5fa8ff] animate-pulse";
			case "success":
				return "bg-[#5fe0a1]";
			case "failed":
				return "bg-[#ff7b6b]";
			default:
				return "bg-[#6b7280]";
		}
	};

	return (
		<div class="fixed bottom-4 left-1/2 z-[7] w-[min(980px,calc(100%-32px))] -translate-x-1/2">
			<div
				ref={(element) => props.setActionMenuRef(element)}
				class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#2a3241] bg-[rgba(14,18,26,0.92)] px-4 py-2 shadow-[0_18px_42px_rgba(0,0,0,0.45)] backdrop-blur"
			>
				<div class="flex flex-1 flex-wrap items-center gap-2">
					<button
						type="button"
						class="flex items-center gap-2 rounded-full border border-[#2c3445] bg-[#171c26] px-3 py-1 text-[11px] text-[#e4e9f2] hover:bg-[#1f2736]"
						onClick={() => props.onOpenSearch()}
					>
						Add Node
					</button>
					<input
						type="text"
						value={props.searchValue}
						placeholder="Search all nodes..."
						class="h-7 w-[220px] rounded border border-[#2c3445] bg-[#101622] px-3 text-[11px] text-[#e4e9f2] placeholder:text-[#8c96a3] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]"
						onInput={(event) => props.onSearchChange(event.currentTarget.value)}
						onFocus={() => props.onOpenSearch(props.searchValue)}
						onBlur={() => props.onSearchBlur()}
					/>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<div class="flex items-center gap-1 rounded-full border border-[#2c3445] bg-[#121822] p-1">
						<button
							type="button"
							class="rounded-full px-3 py-1 text-[11px] text-[#d7dde7] hover:bg-[#1f2736]"
							classList={{
								"bg-[#1f2736] text-[#f4f5f7]": props.activeMode === "edit",
							}}
							aria-pressed={props.activeMode === "edit"}
							onClick={() => props.onModeChange("edit")}
						>
							Edit
						</button>
						<button
							type="button"
							class="rounded-full px-3 py-1 text-[11px] text-[#d7dde7] hover:bg-[#1f2736]"
							classList={{
								"bg-[#1f2736] text-[#f4f5f7]": props.activeMode === "preview",
							}}
							aria-pressed={props.activeMode === "preview"}
							onClick={() => props.onModeChange("preview")}
						>
							Preview
						</button>
						<button
							type="button"
							class="rounded-full px-3 py-1 text-[11px] text-[#d7dde7] hover:bg-[#1f2736]"
							classList={{
								"bg-[#1f2736] text-[#f4f5f7]": props.activeMode === "debug",
							}}
							aria-pressed={props.activeMode === "debug"}
							onClick={() => props.onModeChange("debug")}
						>
							Debug
						</button>
					</div>
					<div
						class={`flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${statusClass()}`}
					>
						<span class={`h-2 w-2 rounded-full ${indicatorClass()}`} />
						<span>{statusLabel()}</span>
						<Show when={props.compileMs !== null}>
							<span class="text-[10px] normal-case tracking-normal text-[#9aa6b5]">
								{props.compileMs?.toFixed(1)}ms
							</span>
						</Show>
						<Show when={props.lastCompileAt}>
							<span class="text-[10px] normal-case tracking-normal text-[#9aa6b5]">
								@ {props.lastCompileAt}
							</span>
						</Show>
					</div>
				</div>
				<div class="flex flex-1 flex-wrap items-center justify-end gap-2">
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
									<div class="absolute bottom-full left-1/2 z-[8] mb-2 w-[200px] -translate-x-1/2 rounded-lg border border-[#2a3241] bg-[#0f131c] p-1 shadow-[0_18px_32px_rgba(0,0,0,0.35)]">
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
					<button
						type="button"
						class="flex items-center gap-2 rounded-full border border-[#2c3445] bg-[#171c26] px-3 py-1 text-[11px] text-[#e4e9f2] hover:bg-[#1f2736]"
						onClick={props.onCompileShader}
					>
						Compile
					</button>
					<button
						type="button"
						disabled={props.exportDisabled}
						class="flex items-center gap-2 rounded-full border border-[#2c3445] bg-[#171c26] px-3 py-1 text-[11px] text-[#e4e9f2] hover:bg-[#1f2736] disabled:cursor-not-allowed disabled:opacity-50"
						onClick={props.onExportShader}
					>
						Export
					</button>
					<button
						type="button"
						class="flex items-center gap-2 rounded-full border border-[#2c3445] bg-[#171c26] px-3 py-1 text-[11px] text-[#e4e9f2] hover:bg-[#1f2736]"
						onClick={props.onOpenSettings}
					>
						Settings
					</button>
				</div>
			</div>
		</div>
	);
};
