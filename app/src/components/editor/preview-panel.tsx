import { For, Show } from "solid-js";

import type { PreviewStatus } from "./types";

type PreviewPanelProps = {
	status: PreviewStatus;
	textureName: string;
	setPreviewRef: (element: HTMLCanvasElement) => void;
};

export const PreviewPanel = (props: PreviewPanelProps) => (
	<div class="absolute bottom-24 right-4 z-[5] w-[min(360px,calc(100%-32px))]">
		<div class="flex flex-col gap-2 rounded-lg border border-[#2a3241] bg-[rgba(13,17,25,0.94)] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.45)] backdrop-blur">
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#9aa6b5]">
					<span>Shader Preview</span>
					<span
						class="rounded-full border border-[#2a3241] bg-[#121822] px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[#9aa6b5]"
						classList={{
							"border-[#244a39] bg-[#0f1c16] text-[#98f5c3]":
								props.status.tone === "ready",
							"border-[#4c3a20] bg-[#201a12] text-[#ffd07a]":
								props.status.tone === "warning",
							"border-[#4c2c2c] bg-[#201417] text-[#ff9a8a]":
								props.status.tone === "error",
						}}
					>
						{props.status.tone}
					</span>
				</div>
				<div class="flex flex-col items-end text-[10px] text-[#7f8796]">
					<span>{props.textureName}</span>
					<Show when={typeof props.status.compileMs === "number"}>
						<span class="text-[#6b7688]">
							Compile {props.status.compileMs?.toFixed(1)}
							ms
						</span>
					</Show>
				</div>
			</div>
			<div class="h-[190px] overflow-hidden rounded-lg border border-[#1f2430] bg-[#0b0d12]">
				<canvas
					ref={(element) => props.setPreviewRef(element)}
					id="preview-canvas"
					class="block h-full w-full"
				/>
			</div>
			<div
				class="text-[12px] leading-[1.4] text-[#b9c2cf]"
				classList={{
					"text-[#98f5c3]": props.status.tone === "ready",
					"text-[#ffd07a]": props.status.tone === "warning",
					"text-[#ff9a8a]": props.status.tone === "error",
				}}
			>
				<span>{props.status.message}</span>
				<Show when={props.status.details && props.status.details.length > 0}>
					<ul class="mt-1.5 grid list-disc gap-1 pl-5">
						<For each={props.status.details}>
							{(detail) => <li>{detail}</li>}
						</For>
					</ul>
				</Show>
				<Show when={props.status.tone === "error"}>
					<div class="mt-1 text-[11px] text-[#ff7b6b]">
						Export is disabled until errors are resolved.
					</div>
				</Show>
			</div>
		</div>
	</div>
);
