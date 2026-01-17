import { Show } from "solid-js";

type StatusBarProps = {
	text: string | null;
};

export const StatusBar = (props: StatusBarProps) => (
	<Show when={props.text}>
		<div class="pointer-events-none fixed bottom-20 left-1/2 z-[6] -translate-x-1/2">
			<div class="rounded-full border border-[#2a3241] bg-[rgba(12,16,24,0.9)] px-4 py-1 text-[11px] text-[#d7dde7] shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur">
				{props.text}
			</div>
		</div>
	</Show>
);
