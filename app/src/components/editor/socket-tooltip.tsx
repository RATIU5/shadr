import type {
	NodeSocketValue,
	PortType,
	SocketHoverState,
} from "@shadr/lib-editor";
import { Show } from "solid-js";

type SocketTooltipProps = {
	state: SocketHoverState | null;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const formatNumber = (value: number) => {
	if (!Number.isFinite(value)) {
		return "0";
	}
	const rounded = Math.round(value * 1000) / 1000;
	return rounded.toString();
};

const formatColor = (color: { r: number; g: number; b: number }) => {
	const channel = (value: number) =>
		Math.min(255, Math.max(0, Math.round(clamp01(value) * 255)))
			.toString(16)
			.padStart(2, "0");
	return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
};

const formatSocketValue = (
	value: NodeSocketValue | null,
	portType: PortType,
) => {
	if (value === null || value === undefined) {
		return "Computed";
	}
	if (typeof value === "number") {
		return portType === "int"
			? Math.round(value).toString()
			: formatNumber(value);
	}
	if (typeof value === "boolean") {
		return value ? "On" : "Off";
	}
	if (typeof value === "string") {
		return value;
	}
	if (Array.isArray(value)) {
		return value.join(", ");
	}
	if (
		typeof value === "object" &&
		value !== null &&
		"x" in value &&
		"y" in value
	) {
		const vector = value as { x: number; y: number; z?: number; w?: number };
		const axes = [
			formatNumber(vector.x),
			formatNumber(vector.y),
			...(vector.z !== undefined ? [formatNumber(vector.z)] : []),
			...(vector.w !== undefined ? [formatNumber(vector.w)] : []),
		];
		return `(${axes.join(", ")})`;
	}
	if (
		typeof value === "object" &&
		value !== null &&
		"r" in value &&
		"g" in value &&
		"b" in value
	) {
		return formatColor(value as { r: number; g: number; b: number });
	}
	return "Computed";
};

export const SocketTooltip = (props: SocketTooltipProps) => (
	<Show
		when={props.state?.isConnected && props.state.upstream ? props.state : null}
	>
		{(state) => {
			const resolvedType =
				state().connectionType ??
				state().upstream?.portType ??
				state().portType;
			const value = formatSocketValue(
				state().upstream?.value ?? null,
				resolvedType,
			);
			return (
				<div
					class="pointer-events-none absolute z-[8] rounded-lg border border-[#2a3342] bg-[#101621] px-2.5 py-2 text-[11px] text-[#d7dde7] shadow-[0_12px_26px_rgba(0,0,0,0.35)]"
					style={{
						left: `${state().screenX + 12}px`,
						top: `${state().screenY + 12}px`,
					}}
				>
					<div class="text-[10px] uppercase tracking-[0.14em] text-[#7f8aa1]">
						Upstream Socket
					</div>
					<div class="mt-1 flex items-center justify-between gap-4">
						<span class="text-[#9aa6b5]">Type</span>
						<span>{resolvedType}</span>
					</div>
					<div class="mt-1 flex items-center justify-between gap-4">
						<span class="text-[#9aa6b5]">Value</span>
						<span>{value}</span>
					</div>
				</div>
			);
		}}
	</Show>
);
