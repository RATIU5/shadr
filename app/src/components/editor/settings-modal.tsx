import type { EditorVisualSettings } from "@shadr/lib-editor";
import { Show } from "solid-js";

type SettingsModalProps = {
	open: boolean;
	visualSettings: EditorVisualSettings;
	settingsSelectClass: string;
	settingsRangeClass: string;
	textureName: string;
	setTextureInputRef: (element: HTMLInputElement) => void;
	formatPortColor: (value: number) => string;
	parseHexColorNumber: (value: string) => number | null;
	parseNumberInput: (value: string, fallback: number) => number;
	clamp01: (value: number) => number;
	clampNumber: (value: number, min: number, max: number) => number;
	onClose: () => void;
	onResetVisualSettings: () => void;
	onUpdateVisualSettings: (
		update: (current: EditorVisualSettings) => EditorVisualSettings,
	) => void;
	onTextureChange: (event: Event) => void;
	onClearTexture: () => void;
};

export const SettingsModal = (props: SettingsModalProps) => (
	<Show when={props.open}>
		<div
			class="fixed inset-0 z-[8] flex items-start justify-center bg-[rgba(8,10,14,0.72)] px-4 py-10"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) {
					props.onClose();
				}
			}}
		>
			<div
				class="w-full max-w-3xl max-h-[calc(100vh-80px)] overflow-y-auto rounded-2xl border border-[#2a3241] bg-[#0f131c] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
				onPointerDown={(event) => event.stopPropagation()}
			>
				<div class="flex items-center justify-between gap-2">
					<div class="text-[12px] uppercase tracking-[0.2em] text-[#7f8796]">
						Settings
					</div>
					<button
						type="button"
						class="rounded-full border border-[#2c3445] bg-[#171c26] px-3 py-1 text-[11px] text-[#e4e9f2] hover:bg-[#1f2736]"
						onClick={props.onClose}
					>
						Close
					</button>
				</div>
				<div class="mt-4 flex flex-col gap-3">
					<div class="grid gap-2 rounded-[10px] border border-[#1f2430] bg-[#0b0f16] p-2.5">
						<div class="text-[11px] uppercase tracking-[0.14em] text-[#8c96a3]">
							Canvas
						</div>
						<label class="flex items-center justify-between gap-2 text-[11px] text-[#b9c2cf]">
							<span>Background</span>
							<input
								type="color"
								value={props.formatPortColor(
									props.visualSettings.backgroundColor,
								)}
								class="h-8 w-[42px] border-0 bg-transparent p-0"
								onInput={(event) => {
									const value = props.parseHexColorNumber(
										event.currentTarget.value,
									);
									if (value === null) {
										return;
									}
									props.onUpdateVisualSettings((current) => ({
										...current,
										backgroundColor: value,
									}));
								}}
							/>
						</label>
						<label class="flex items-center justify-between gap-2 text-[11px] text-[#b9c2cf]">
							<span>Debug overlay</span>
							<input
								type="checkbox"
								checked={props.visualSettings.debugOverlay}
								class="h-4 w-4 accent-[#5fa8ff]"
								onInput={(event) => {
									const target = event.currentTarget;
									props.onUpdateVisualSettings((current) => ({
										...current,
										debugOverlay: target.checked,
									}));
								}}
							/>
						</label>
					</div>
					<div class="grid gap-2 rounded-[10px] border border-[#1f2430] bg-[#0b0f16] p-2.5">
						<div class="text-[11px] uppercase tracking-[0.14em] text-[#8c96a3]">
							Grid
						</div>
						<div class="grid gap-2 text-[11px] text-[#b9c2cf]">
							<label class="flex items-center justify-between gap-2">
								<span>Minor color</span>
								<input
									type="color"
									value={props.formatPortColor(
										props.visualSettings.grid.minorColor,
									)}
									class="h-7 w-[36px] border-0 bg-transparent p-0"
									onInput={(event) => {
										const value = props.parseHexColorNumber(
											event.currentTarget.value,
										);
										if (value === null) {
											return;
										}
										props.onUpdateVisualSettings((current) => ({
											...current,
											grid: {
												...current.grid,
												minorColor: value,
											},
										}));
									}}
								/>
							</label>
							<label class="flex items-center justify-between gap-2">
								<span>Major color</span>
								<input
									type="color"
									value={props.formatPortColor(
										props.visualSettings.grid.majorColor,
									)}
									class="h-7 w-[36px] border-0 bg-transparent p-0"
									onInput={(event) => {
										const value = props.parseHexColorNumber(
											event.currentTarget.value,
										);
										if (value === null) {
											return;
										}
										props.onUpdateVisualSettings((current) => ({
											...current,
											grid: {
												...current.grid,
												majorColor: value,
											},
										}));
									}}
								/>
							</label>
							<label class="flex items-center justify-between gap-2">
								<span>Axis color</span>
								<input
									type="color"
									value={props.formatPortColor(
										props.visualSettings.grid.axisColor,
									)}
									class="h-7 w-[36px] border-0 bg-transparent p-0"
									onInput={(event) => {
										const value = props.parseHexColorNumber(
											event.currentTarget.value,
										);
										if (value === null) {
											return;
										}
										props.onUpdateVisualSettings((current) => ({
											...current,
											grid: {
												...current.grid,
												axisColor: value,
											},
										}));
									}}
								/>
							</label>
						</div>
						<label class="flex flex-col gap-1 text-[11px] text-[#b9c2cf]">
							<span>Minor alpha</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={props.visualSettings.grid.minorAlpha}
								class={props.settingsRangeClass}
								onInput={(event) => {
									const value = props.clamp01(
										props.parseNumberInput(
											event.currentTarget.value,
											props.visualSettings.grid.minorAlpha,
										),
									);
									props.onUpdateVisualSettings((current) => ({
										...current,
										grid: { ...current.grid, minorAlpha: value },
									}));
								}}
							/>
						</label>
						<label class="flex flex-col gap-1 text-[11px] text-[#b9c2cf]">
							<span>Major alpha</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={props.visualSettings.grid.majorAlpha}
								class={props.settingsRangeClass}
								onInput={(event) => {
									const value = props.clamp01(
										props.parseNumberInput(
											event.currentTarget.value,
											props.visualSettings.grid.majorAlpha,
										),
									);
									props.onUpdateVisualSettings((current) => ({
										...current,
										grid: { ...current.grid, majorAlpha: value },
									}));
								}}
							/>
						</label>
						<label class="flex flex-col gap-1 text-[11px] text-[#b9c2cf]">
							<span>Axis alpha</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={props.visualSettings.grid.axisAlpha}
								class={props.settingsRangeClass}
								onInput={(event) => {
									const value = props.clamp01(
										props.parseNumberInput(
											event.currentTarget.value,
											props.visualSettings.grid.axisAlpha,
										),
									);
									props.onUpdateVisualSettings((current) => ({
										...current,
										grid: { ...current.grid, axisAlpha: value },
									}));
								}}
							/>
						</label>
					</div>
					<div class="grid gap-2 rounded-[10px] border border-[#1f2430] bg-[#0b0f16] p-2.5">
						<div class="text-[11px] uppercase tracking-[0.14em] text-[#8c96a3]">
							Groups
						</div>
						<div class="grid gap-2 text-[11px] text-[#b9c2cf]">
							<label class="flex items-center justify-between gap-2">
								<span>Fill</span>
								<input
									type="color"
									value={props.formatPortColor(
										props.visualSettings.groups.fillColor,
									)}
									class="h-7 w-[36px] border-0 bg-transparent p-0"
									onInput={(event) => {
										const value = props.parseHexColorNumber(
											event.currentTarget.value,
										);
										if (value === null) {
											return;
										}
										props.onUpdateVisualSettings((current) => ({
											...current,
											groups: { ...current.groups, fillColor: value },
										}));
									}}
								/>
							</label>
							<label class="flex items-center justify-between gap-2">
								<span>Collapsed fill</span>
								<input
									type="color"
									value={props.formatPortColor(
										props.visualSettings.groups.collapsedFillColor,
									)}
									class="h-7 w-[36px] border-0 bg-transparent p-0"
									onInput={(event) => {
										const value = props.parseHexColorNumber(
											event.currentTarget.value,
										);
										if (value === null) {
											return;
										}
										props.onUpdateVisualSettings((current) => ({
											...current,
											groups: {
												...current.groups,
												collapsedFillColor: value,
											},
										}));
									}}
								/>
							</label>
							<label class="flex items-center justify-between gap-2">
								<span>Border</span>
								<input
									type="color"
									value={props.formatPortColor(
										props.visualSettings.groups.borderColor,
									)}
									class="h-7 w-[36px] border-0 bg-transparent p-0"
									onInput={(event) => {
										const value = props.parseHexColorNumber(
											event.currentTarget.value,
										);
										if (value === null) {
											return;
										}
										props.onUpdateVisualSettings((current) => ({
											...current,
											groups: { ...current.groups, borderColor: value },
										}));
									}}
								/>
							</label>
						</div>
						<label class="flex flex-col gap-1 text-[11px] text-[#b9c2cf]">
							<span>Fill alpha</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={props.visualSettings.groups.fillAlpha}
								class={props.settingsRangeClass}
								onInput={(event) => {
									const value = props.clamp01(
										props.parseNumberInput(
											event.currentTarget.value,
											props.visualSettings.groups.fillAlpha,
										),
									);
									props.onUpdateVisualSettings((current) => ({
										...current,
										groups: { ...current.groups, fillAlpha: value },
									}));
								}}
							/>
						</label>
						<label class="flex flex-col gap-1 text-[11px] text-[#b9c2cf]">
							<span>Collapsed alpha</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={props.visualSettings.groups.collapsedFillAlpha}
								class={props.settingsRangeClass}
								onInput={(event) => {
									const value = props.clamp01(
										props.parseNumberInput(
											event.currentTarget.value,
											props.visualSettings.groups.collapsedFillAlpha,
										),
									);
									props.onUpdateVisualSettings((current) => ({
										...current,
										groups: {
											...current.groups,
											collapsedFillAlpha: value,
										},
									}));
								}}
							/>
						</label>
					</div>
					<div class="grid gap-2 rounded-[10px] border border-[#1f2430] bg-[#0b0f16] p-2.5">
						<div class="text-[11px] uppercase tracking-[0.14em] text-[#8c96a3]">
							Connections
						</div>
						<label class="flex flex-col gap-1 text-[11px] text-[#b9c2cf]">
							<span>Style</span>
							<select
								value={props.visualSettings.connections.style}
								class={props.settingsSelectClass}
								onChange={(event) => {
									const value =
										event.currentTarget.value === "straight"
											? "straight"
											: "curved";
									props.onUpdateVisualSettings((current) => ({
										...current,
										connections: {
											...current.connections,
											style: value,
										},
									}));
								}}
							>
								<option value="curved">Curved</option>
								<option value="straight">Straight</option>
							</select>
						</label>
						<label class="flex flex-col gap-1 text-[11px] text-[#b9c2cf]">
							<span>Width</span>
							<input
								type="range"
								min="1"
								max="8"
								step="0.5"
								value={props.visualSettings.connections.width}
								class={props.settingsRangeClass}
								onInput={(event) => {
									const value = props.clampNumber(
										props.parseNumberInput(
											event.currentTarget.value,
											props.visualSettings.connections.width,
										),
										1,
										8,
									);
									props.onUpdateVisualSettings((current) => ({
										...current,
										connections: {
											...current.connections,
											width: value,
										},
									}));
								}}
							/>
						</label>
					</div>
					<div class="grid gap-2 rounded-[10px] border border-[#1f2430] bg-[#0b0f16] p-2.5">
						<div class="text-[11px] uppercase tracking-[0.14em] text-[#8c96a3]">
							Preview Texture
						</div>
						<label class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#b9c2cf]">
							<span>Image</span>
							<input
								ref={(element) => props.setTextureInputRef(element)}
								type="file"
								accept="image/*"
								class="flex-1 text-[11px] text-[#b9c2cf]"
								onChange={props.onTextureChange}
							/>
						</label>
						<div class="flex items-center justify-between gap-2 text-[11px] text-[#8c96a3]">
							<span>{props.textureName}</span>
							<button
								type="button"
								class="rounded-lg border border-[#2c3445] bg-[#171c26] px-2 py-1 text-[11px] text-[#d7dde7] hover:bg-[#1f2736]"
								onClick={props.onClearTexture}
							>
								Clear
							</button>
						</div>
					</div>
					<div class="flex items-center justify-between gap-2 text-[10px] text-[#7f8796]">
						<span>Preferences are saved locally.</span>
						<button
							type="button"
							class="rounded-full border border-[#2c3445] bg-[#171c26] px-2 py-1 text-[10px] text-[#d7dde7] hover:bg-[#1f2736]"
							onClick={props.onResetVisualSettings}
						>
							Reset visuals
						</button>
					</div>
				</div>
			</div>
		</div>
	</Show>
);
