import type {
	NodeSocketUiSpec,
	NodeSocketValue,
	SocketEditorState,
} from "@shadr/lib-editor";
import { createMemo, createSignal, For, Show } from "solid-js";
import { FilterableSelect } from "./filterable-select";
import { NumberInput } from "./number-input";

type SocketEditorOverlayProps = {
	state: SocketEditorState | null;
	value: NodeSocketValue | null;
	onChange: (value: NodeSocketValue) => void;
	onClose: () => void;
};

const inputClass =
	"rounded border border-[#2a3342] bg-[#0f131b] px-2 py-1 text-[12px] text-[#f4f5f7] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]";

const labelClass = "text-[10px] uppercase tracking-[0.16em] text-[#7f8796]";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const formatHexColor = (color: { r: number; g: number; b: number }) => {
	const channel = (value: number) =>
		Math.min(255, Math.max(0, Math.round(value * 255)))
			.toString(16)
			.padStart(2, "0");
	return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
};

const parseHexColor = (value: string) => {
	const normalized = value.replace("#", "");
	if (normalized.length !== 6) {
		return null;
	}
	const parsed = Number.parseInt(normalized, 16);
	if (Number.isNaN(parsed)) {
		return null;
	}
	return {
		r: ((parsed >> 16) & 0xff) / 255,
		g: ((parsed >> 8) & 0xff) / 255,
		b: (parsed & 0xff) / 255,
	};
};

const rgbToHsv = (r: number, g: number, b: number) => {
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	let hue = 0;
	if (delta > 0) {
		if (max === r) {
			hue = ((g - b) / delta) % 6;
		} else if (max === g) {
			hue = (b - r) / delta + 2;
		} else {
			hue = (r - g) / delta + 4;
		}
		hue *= 60;
		if (hue < 0) {
			hue += 360;
		}
	}
	const saturation = max === 0 ? 0 : delta / max;
	return { h: hue, s: saturation, v: max };
};

const hsvToRgb = (h: number, s: number, v: number) => {
	const c = v * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = v - c;
	let r = 0;
	let g = 0;
	let b = 0;
	if (h >= 0 && h < 60) {
		r = c;
		g = x;
	} else if (h < 120) {
		r = x;
		g = c;
	} else if (h < 180) {
		g = c;
		b = x;
	} else if (h < 240) {
		g = x;
		b = c;
	} else if (h < 300) {
		r = x;
		b = c;
	} else {
		r = c;
		b = x;
	}
	return { r: r + m, g: g + m, b: b + m };
};

type EyeDropperResult = {
	sRGBHex: string;
};

type EyeDropperApi = {
	open: () => Promise<EyeDropperResult>;
};

const hasEyeDropper = () =>
	typeof window !== "undefined" && "EyeDropper" in window;

const requestEyeDropper = async () => {
	if (!hasEyeDropper()) {
		return null;
	}
	const EyeDropperConstructor = (
		window as Window & { EyeDropper?: new () => EyeDropperApi }
	).EyeDropper;
	if (!EyeDropperConstructor) {
		return null;
	}
	try {
		const dropper = new EyeDropperConstructor();
		const result = await dropper.open();
		return result.sRGBHex ?? null;
	} catch {
		return null;
	}
};

const isVectorValue = (
	value: NodeSocketValue | null,
): value is { x: number; y: number; z?: number; w?: number } =>
	typeof value === "object" && value !== null && "x" in value && "y" in value;

const isColorValue = (
	value: NodeSocketValue | null,
): value is { r: number; g: number; b: number; a: number } =>
	typeof value === "object" &&
	value !== null &&
	"r" in value &&
	"g" in value &&
	"b" in value &&
	"a" in value;

const getSocketAxes = (kind: NodeSocketUiSpec["kind"]) => {
	if (kind === "vec2") {
		return ["x", "y"] as const;
	}
	if (kind === "vec3") {
		return ["x", "y", "z"] as const;
	}
	if (kind === "vec4") {
		return ["x", "y", "z", "w"] as const;
	}
	return [] as const;
};

const ColorControl = (props: {
	value: { r: number; g: number; b: number; a: number };
	onChange: (value: { r: number; g: number; b: number; a: number }) => void;
	onClose: () => void;
}) => {
	const [mode, setMode] = createSignal<"rgb" | "hsv">("rgb");
	const channels = ["r", "g", "b"] as const;
	const colorValue = () => props.value;
	const hexValue = createMemo(() => formatHexColor(colorValue()));
	const hsvValue = createMemo(() =>
		rgbToHsv(colorValue().r, colorValue().g, colorValue().b),
	);
	const updateColor = (next: {
		r: number;
		g: number;
		b: number;
		a: number;
	}) => {
		props.onChange({
			r: clamp01(next.r),
			g: clamp01(next.g),
			b: clamp01(next.b),
			a: clamp01(next.a),
		});
	};
	const handleCloseKey = (
		event: KeyboardEvent & { currentTarget: HTMLInputElement },
	) => {
		if (event.key === "Enter" || event.key === "Escape") {
			props.onClose();
		}
	};

	return (
		<div class="flex flex-col gap-2">
			<div class="flex items-center gap-2">
				<input
					type="color"
					class="h-8 w-[42px] rounded border border-[#2a3342] bg-transparent p-0"
					value={hexValue()}
					onInput={(event) => {
						const rgb = parseHexColor(event.currentTarget.value);
						if (!rgb) {
							return;
						}
						updateColor({
							r: rgb.r,
							g: rgb.g,
							b: rgb.b,
							a: colorValue().a,
						});
					}}
				/>
				<input
					type="text"
					class={`flex-1 ${inputClass}`}
					value={hexValue()}
					onInput={(event) => {
						const rgb = parseHexColor(event.currentTarget.value);
						if (!rgb) {
							return;
						}
						updateColor({
							r: rgb.r,
							g: rgb.g,
							b: rgb.b,
							a: colorValue().a,
						});
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === "Escape") {
							props.onClose();
						}
					}}
				/>
				<button
					type="button"
					class="rounded border border-[#2a3342] bg-[#101622] px-2 py-1 text-[11px] text-[#d7dde7]"
					disabled={!hasEyeDropper()}
					onClick={async () => {
						const picked = await requestEyeDropper();
						if (!picked) {
							return;
						}
						const rgb = parseHexColor(picked);
						if (!rgb) {
							return;
						}
						updateColor({
							r: rgb.r,
							g: rgb.g,
							b: rgb.b,
							a: colorValue().a,
						});
					}}
				>
					Pick
				</button>
			</div>
			<div class="flex items-center gap-2 text-[11px] text-[#9aa6b5]">
				<span>Mode</span>
				<button
					type="button"
					class={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${
						mode() === "rgb"
							? "border-[#5fa8ff] bg-[#0f1a2a] text-[#e8effa]"
							: "border-[#2a3342] bg-[#0b0f16] text-[#8c96a3]"
					}`}
					onClick={() => setMode("rgb")}
				>
					RGB
				</button>
				<button
					type="button"
					class={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${
						mode() === "hsv"
							? "border-[#5fa8ff] bg-[#0f1a2a] text-[#e8effa]"
							: "border-[#2a3342] bg-[#0b0f16] text-[#8c96a3]"
					}`}
					onClick={() => setMode("hsv")}
				>
					HSV
				</button>
			</div>
			<Show when={mode() === "rgb"}>
				<div class="grid gap-2 text-[11px] text-[#d7dde7]">
					<For each={channels}>
						{(channel) => {
							const value = Math.round(colorValue()[channel] * 255);
							return (
								<label class="grid grid-cols-[42px,1fr,64px] items-center gap-2">
									<span class="uppercase tracking-[0.12em] text-[#8c96a3]">
										{channel}
									</span>
									<input
										type="range"
										min="0"
										max="255"
										step="1"
										value={value}
										class="h-2 w-full accent-[#5fa8ff]"
										onInput={(event) => {
											const nextValue = Number.parseInt(
												event.currentTarget.value,
												10,
											);
											const next = {
												...colorValue(),
												[channel]: clamp01(nextValue / 255),
											};
											updateColor(next);
										}}
									/>
									<NumberInput
										value={value}
										min={0}
										max={255}
										step={1}
										class={inputClass}
										ariaLabel={`${channel} channel`}
										onChange={(nextValue) => {
											updateColor({
												...colorValue(),
												[channel]: clamp01(nextValue / 255),
											});
										}}
										onKeyDown={handleCloseKey}
									/>
								</label>
							);
						}}
					</For>
				</div>
			</Show>
			<Show when={mode() === "hsv"}>
				<div class="grid gap-2 text-[11px] text-[#d7dde7]">
					<label class="grid grid-cols-[42px,1fr,64px] items-center gap-2">
						<span class="uppercase tracking-[0.12em] text-[#8c96a3]">H</span>
						<input
							type="range"
							min="0"
							max="360"
							step="1"
							value={Math.round(hsvValue().h)}
							class="h-2 w-full accent-[#5fa8ff]"
							onInput={(event) => {
								const nextH = Number.parseFloat(event.currentTarget.value);
								const nextRgb = hsvToRgb(nextH, hsvValue().s, hsvValue().v);
								updateColor({ ...nextRgb, a: colorValue().a });
							}}
						/>
						<NumberInput
							value={Math.round(hsvValue().h)}
							min={0}
							max={360}
							step={1}
							class={inputClass}
							ariaLabel="Hue"
							onChange={(nextValue) => {
								const nextRgb = hsvToRgb(nextValue, hsvValue().s, hsvValue().v);
								updateColor({ ...nextRgb, a: colorValue().a });
							}}
							onKeyDown={handleCloseKey}
						/>
					</label>
					<label class="grid grid-cols-[42px,1fr,64px] items-center gap-2">
						<span class="uppercase tracking-[0.12em] text-[#8c96a3]">S</span>
						<input
							type="range"
							min="0"
							max="100"
							step="1"
							value={Math.round(hsvValue().s * 100)}
							class="h-2 w-full accent-[#5fa8ff]"
							onInput={(event) => {
								const nextS =
									Number.parseFloat(event.currentTarget.value) / 100;
								const nextRgb = hsvToRgb(hsvValue().h, nextS, hsvValue().v);
								updateColor({ ...nextRgb, a: colorValue().a });
							}}
						/>
						<NumberInput
							value={Math.round(hsvValue().s * 100)}
							min={0}
							max={100}
							step={1}
							class={inputClass}
							ariaLabel="Saturation"
							onChange={(nextValue) => {
								const nextRgb = hsvToRgb(
									hsvValue().h,
									nextValue / 100,
									hsvValue().v,
								);
								updateColor({ ...nextRgb, a: colorValue().a });
							}}
							onKeyDown={handleCloseKey}
						/>
					</label>
					<label class="grid grid-cols-[42px,1fr,64px] items-center gap-2">
						<span class="uppercase tracking-[0.12em] text-[#8c96a3]">V</span>
						<input
							type="range"
							min="0"
							max="100"
							step="1"
							value={Math.round(hsvValue().v * 100)}
							class="h-2 w-full accent-[#5fa8ff]"
							onInput={(event) => {
								const nextV =
									Number.parseFloat(event.currentTarget.value) / 100;
								const nextRgb = hsvToRgb(hsvValue().h, hsvValue().s, nextV);
								updateColor({ ...nextRgb, a: colorValue().a });
							}}
						/>
						<NumberInput
							value={Math.round(hsvValue().v * 100)}
							min={0}
							max={100}
							step={1}
							class={inputClass}
							ariaLabel="Value"
							onChange={(nextValue) => {
								const nextRgb = hsvToRgb(
									hsvValue().h,
									hsvValue().s,
									nextValue / 100,
								);
								updateColor({ ...nextRgb, a: colorValue().a });
							}}
							onKeyDown={handleCloseKey}
						/>
					</label>
				</div>
			</Show>
			<div class="grid grid-cols-[42px,1fr,64px] items-center gap-2 text-[11px] text-[#d7dde7]">
				<span class="uppercase tracking-[0.12em] text-[#8c96a3]">A</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={clamp01(colorValue().a)}
					class="h-2 w-full accent-[#5fa8ff]"
					onInput={(event) => {
						const nextA = Number.parseFloat(event.currentTarget.value);
						updateColor({ ...colorValue(), a: clamp01(nextA) });
					}}
				/>
				<NumberInput
					value={clamp01(colorValue().a)}
					min={0}
					max={1}
					step={0.01}
					class={inputClass}
					ariaLabel="Alpha"
					onChange={(nextValue) =>
						updateColor({ ...colorValue(), a: clamp01(nextValue) })
					}
					onKeyDown={handleCloseKey}
				/>
			</div>
		</div>
	);
};

export const SocketEditorOverlay = (props: SocketEditorOverlayProps) => (
	<Show when={props.state}>
		{(state) => {
			const current = state();
			const handleKeyDown = (event: KeyboardEvent) => {
				if (event.isComposing) {
					return;
				}
				if (event.key === "Enter" || event.key === "Escape") {
					props.onClose();
				}
			};

			const renderControl = () => {
				const uiSpec = current.uiSpec;
				switch (uiSpec.kind) {
					case "boolean":
						return (
							<label class="flex items-center gap-2 text-[12px] text-[#d7dde7]">
								<input
									type="checkbox"
									class="h-4 w-4 accent-[#5fa8ff]"
									checked={Boolean(props.value)}
									onInput={(event) =>
										props.onChange(event.currentTarget.checked)
									}
									onKeyDown={handleKeyDown}
								/>
								<span>{uiSpec.label ?? current.label}</span>
							</label>
						);
					case "enum": {
						const options: Array<{ value: string; label: string }> =
							uiSpec.options ?? [];
						const fallback = options[0]?.value ?? "";
						const currentValue =
							typeof props.value === "string" ? props.value : fallback;
						const resolvedValue = options.some(
							(option) => option.value === currentValue,
						)
							? currentValue
							: fallback;
						return (
							<FilterableSelect
								value={resolvedValue}
								options={options}
								onChange={(value) => props.onChange(value)}
								class={`w-full ${inputClass}`}
								ariaLabel={uiSpec.label ?? current.label}
								onKeyDown={handleKeyDown}
							/>
						);
					}
					case "vec2":
					case "vec3":
					case "vec4": {
						const vectorValue = isVectorValue(props.value)
							? props.value
							: { x: 0, y: 0, z: 0, w: 0 };
						const axes = getSocketAxes(uiSpec.kind);
						return (
							<div class="grid grid-cols-2 gap-2">
								<For each={axes}>
									{(axis) => (
										<NumberInput
											value={vectorValue[axis] ?? 0}
											step={uiSpec.step ?? 0.01}
											class={`w-full ${inputClass}`}
											ariaLabel={`${current.label} ${axis}`}
											onChange={(nextValue) => {
												const next = {
													...vectorValue,
													[axis]: Number.isFinite(nextValue) ? nextValue : 0,
												};
												props.onChange(next);
											}}
											onKeyDown={handleKeyDown}
										/>
									)}
								</For>
							</div>
						);
					}
					case "color": {
						const fallback = { r: 1, g: 1, b: 1, a: 1 };
						const colorValue = isColorValue(props.value)
							? props.value
							: fallback;
						return (
							<ColorControl
								value={colorValue}
								onChange={(value) => props.onChange(value)}
								onClose={props.onClose}
							/>
						);
					}
					case "float":
					case "int": {
						const numericValue =
							typeof props.value === "number" && Number.isFinite(props.value)
								? props.value
								: 0;
						const step = uiSpec.kind === "int" ? 1 : (uiSpec.step ?? 0.01);
						return (
							<NumberInput
								value={numericValue}
								min={uiSpec.min}
								max={uiSpec.max}
								step={step}
								class={`w-full ${inputClass}`}
								ariaLabel={uiSpec.label ?? current.label}
								onChange={(nextValue) => {
									const rounded =
										uiSpec.kind === "int" ? Math.round(nextValue) : nextValue;
									props.onChange(rounded);
								}}
								onKeyDown={handleKeyDown}
							/>
						);
					}
					default:
						return (
							<input
								type="text"
								class={`w-full ${inputClass}`}
								value={
									typeof props.value === "string"
										? props.value
										: Array.isArray(props.value)
											? props.value.join(", ")
											: ""
								}
								onInput={(event) => props.onChange(event.currentTarget.value)}
								onKeyDown={handleKeyDown}
							/>
						);
				}
			};

			return (
				<div
					class="absolute inset-0 z-[7]"
					onPointerDown={(event) => {
						if (event.target === event.currentTarget) {
							props.onClose();
						}
					}}
				>
					<div
						class="absolute min-w-[160px] rounded-lg border border-[#2a3342] bg-[#151924] p-2 shadow-[0_14px_30px_rgba(0,0,0,0.4)]"
						style={{
							left: `${current.screenX}px`,
							top: `${current.screenY}px`,
						}}
						onPointerDown={(event) => event.stopPropagation()}
						onFocusOut={(event) => {
							const nextTarget = event.relatedTarget as Node | null;
							if (!event.currentTarget.contains(nextTarget)) {
								props.onClose();
							}
						}}
					>
						<div class={labelClass}>{current.label}</div>
						<div class="mt-2">{renderControl()}</div>
					</div>
				</div>
			);
		}}
	</Show>
);
