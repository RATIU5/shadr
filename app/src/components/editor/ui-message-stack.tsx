import type { UiMessageTone } from "@shadr/lib-editor";
import { For, Show } from "solid-js";

import type { UiMessageItem } from "./types";

type UiMessageStackProps = {
	items: UiMessageItem[];
	getToneClass: (tone: UiMessageTone) => string;
	getToneLabel: (tone: UiMessageTone) => string;
	onDismiss: (id: number) => void;
};

export const UiMessageStack = (props: UiMessageStackProps) => (
	<Show when={props.items.length > 0}>
		<div class="absolute right-4 top-4 z-[6] flex w-[min(340px,90%)] flex-col gap-2 pointer-events-none">
			<For each={props.items}>
				{(item) => (
					<div
						class={`pointer-events-auto rounded-lg border px-3 py-2 text-[12px] shadow-[0_12px_28px_rgba(0,0,0,0.45)] ${props.getToneClass(item.tone)}`}
					>
						<div class="flex items-start justify-between gap-3">
							<div class="flex flex-col gap-1">
								<div class="text-[11px] uppercase tracking-[0.12em] text-[#9aa6b5]">
									{props.getToneLabel(item.tone)}
								</div>
								<div class="whitespace-pre-line text-[12px] text-[#d7dde7]">
									{item.message}
								</div>
							</div>
							<button
								type="button"
								class="rounded-md border border-transparent px-1 text-[12px] text-[#8c96a3] hover:text-[#f4f5f7]"
								onClick={() => props.onDismiss(item.id)}
							>
								Close
							</button>
						</div>
					</div>
				)}
			</For>
		</div>
	</Show>
);
