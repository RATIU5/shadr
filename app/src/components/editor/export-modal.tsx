import type { ShaderCompileResult } from "@shadr/lib-editor";
import { For, Show } from "solid-js";

type ExportModalProps = {
	open: boolean;
	result: ShaderCompileResult | null;
	onClose: () => void;
	onDownload: (payload: string, filename: string) => void;
};

export const ExportModal = (props: ExportModalProps) => {
	const warnings = () =>
		props.result?.messages.filter((message) => message.kind === "warning") ??
		[];

	const hasResult = () =>
		Boolean(props.result?.vertexSource && props.result?.fragmentSource);

	const formatShader = (source: string) => {
		const trimmed = source.trimEnd();
		return trimmed ? `${trimmed}\n` : "";
	};

	const buildCombinedPayload = () => {
		if (!props.result) {
			return "";
		}
		return [
			"// Vertex Shader",
			props.result.vertexSource.trimEnd(),
			"",
			"// Fragment Shader",
			props.result.fragmentSource.trimEnd(),
			"",
		].join("\n");
	};

	return (
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
					class="w-full max-w-xl max-h-[calc(100vh-80px)] overflow-y-auto rounded-lg border border-[#2a3241] bg-[#0f131c] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
					onPointerDown={(event) => event.stopPropagation()}
				>
					<div class="flex items-center justify-between gap-2">
						<div class="text-[12px] uppercase tracking-[0.2em] text-[#7f8796]">
							Export GLSL
						</div>
						<button
							type="button"
							class="rounded-full border border-[#2c3445] bg-[#171c26] px-3 py-1 text-[11px] text-[#e4e9f2] hover:bg-[#1f2736]"
							onClick={props.onClose}
						>
							Close
						</button>
					</div>
					<div class="mt-4 grid gap-3">
						<div class="rounded-lg border border-[#1f2430] bg-[#0c1018] p-3">
							<div class="text-[12px] text-[#b9c2cf]">
								Choose the shader files you want to download.
							</div>
							<div class="mt-3 flex flex-wrap gap-2">
								<button
									type="button"
									disabled={!hasResult()}
									class="rounded-full border border-[#2c3445] bg-[#151b28] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#e4e9f2] hover:bg-[#1f2736] disabled:cursor-not-allowed disabled:opacity-50"
									onClick={() => {
										if (!props.result) {
											return;
										}
										props.onDownload(
											formatShader(props.result.vertexSource),
											"shadr-vertex.glsl",
										);
									}}
								>
									Download Vertex
								</button>
								<button
									type="button"
									disabled={!hasResult()}
									class="rounded-full border border-[#2c3445] bg-[#151b28] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#e4e9f2] hover:bg-[#1f2736] disabled:cursor-not-allowed disabled:opacity-50"
									onClick={() => {
										if (!props.result) {
											return;
										}
										props.onDownload(
											formatShader(props.result.fragmentSource),
											"shadr-fragment.glsl",
										);
									}}
								>
									Download Fragment
								</button>
								<button
									type="button"
									disabled={!hasResult()}
									class="rounded-full border border-[#3a5a92] bg-[#1d2a3f] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#dbe8ff] hover:bg-[#23324b] disabled:cursor-not-allowed disabled:opacity-50"
									onClick={() => {
										props.onDownload(
											buildCombinedPayload(),
											"shadr-shader.glsl",
										);
									}}
								>
									Download Combined
								</button>
							</div>
						</div>
						<Show when={!hasResult()}>
							<div class="rounded-lg border border-[#412328] bg-[#1a0f12] px-3 py-2 text-[11px] text-[#f1b5b9]">
								Export data is unavailable. Compile the graph before exporting.
							</div>
						</Show>
						<Show when={warnings().length > 0}>
							<div class="rounded-lg border border-[#3f3522] bg-[#17130c] p-3">
								<div class="text-[11px] uppercase tracking-[0.14em] text-[#d9c38b]">
									Warnings
								</div>
								<div class="mt-2 grid gap-2 text-[11px] text-[#f0d7a3]">
									<For each={warnings()}>
										{(warning) => (
											<div class="rounded-lg border border-[#4a3a20] bg-[#1b1409] px-2 py-1.5">
												{warning.message}
											</div>
										)}
									</For>
								</div>
							</div>
						</Show>
					</div>
				</div>
			</div>
		</Show>
	);
};
