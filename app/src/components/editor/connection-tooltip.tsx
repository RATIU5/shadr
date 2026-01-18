import type { EditorHoverState } from "@shadr/lib-editor";
import { Show } from "solid-js";

type ConnectionHoverState = Extract<EditorHoverState, { kind: "connection" }>;

type ConnectionTooltipProps = {
	state: ConnectionHoverState | null;
	expression: string | null;
	stage: "vertex" | "fragment" | null;
};

export const ConnectionTooltip = (props: ConnectionTooltipProps) => (
	<Show when={props.state}>
		{(state) => (
			<div
				class="pointer-events-none absolute z-[8] rounded-lg border border-[#2a3342] bg-[#101621] px-2.5 py-2 text-[11px] text-[#d7dde7] shadow-[0_12px_26px_rgba(0,0,0,0.35)]"
				style={{
					left: `${state().screenX + 12}px`,
					top: `${state().screenY + 12}px`,
				}}
			>
				<div class="text-[10px] uppercase tracking-[0.14em] text-[#7f8aa1]">
					Connection Value
				</div>
				<div class="mt-1 grid gap-1.5">
					<div class="flex items-center justify-between gap-4">
						<span class="text-[#9aa6b5]">Stage</span>
						<span class="text-right">
							{props.stage ? props.stage.toUpperCase() : "--"}
						</span>
					</div>
					<div class="flex items-center justify-between gap-4">
						<span class="text-[#9aa6b5]">Value</span>
						<span class="max-w-[220px] truncate text-right">
							{props.expression ?? "Unavailable"}
						</span>
					</div>
				</div>
			</div>
		)}
	</Show>
);
