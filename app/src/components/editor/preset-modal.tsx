import { Show } from "solid-js";

type PresetModalProps = {
	open: boolean;
	name: string;
	description: string;
	onNameChange: (value: string) => void;
	onDescriptionChange: (value: string) => void;
	onSave: () => void;
	onClose: () => void;
};

export const PresetModal = (props: PresetModalProps) => {
	const canSave = () => props.name.trim().length > 0;

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
					class="w-full max-w-lg max-h-[calc(100vh-80px)] overflow-y-auto rounded-lg border border-[#2a3241] bg-[#0f131c] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
					onPointerDown={(event) => event.stopPropagation()}
				>
					<div class="flex items-center justify-between gap-2">
						<div class="text-[12px] uppercase tracking-[0.2em] text-[#7f8796]">
							Save Preset
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
						<label class="grid gap-1 text-[11px] text-[#9aa6b5]">
							Preset name
							<input
								type="text"
								value={props.name}
								onInput={(event) =>
									props.onNameChange(event.currentTarget.value)
								}
								placeholder="e.g. Basic Lighting"
								class="w-full rounded border border-[#2a3342] bg-[#0f131b] px-2.5 py-2 text-[12px] text-[#f4f5f7] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]"
							/>
						</label>
						<label class="grid gap-1 text-[11px] text-[#9aa6b5]">
							Description (optional)
							<textarea
								value={props.description}
								onInput={(event) =>
									props.onDescriptionChange(event.currentTarget.value)
								}
								placeholder="What does this preset do?"
								rows={3}
								class="w-full resize-none rounded border border-[#2a3342] bg-[#0f131b] px-2.5 py-2 text-[12px] text-[#f4f5f7] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]"
							/>
						</label>
						<div class="flex justify-end gap-2">
							<button
								type="button"
								class="rounded-full border border-[#2c3445] bg-[#151b28] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#e4e9f2] hover:bg-[#1f2736]"
								onClick={props.onClose}
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={!canSave()}
								class="rounded-full border border-[#3a5a92] bg-[#1d2a3f] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#dbe8ff] hover:bg-[#23324b] disabled:cursor-not-allowed disabled:opacity-60"
								onClick={props.onSave}
							>
								Save Preset
							</button>
						</div>
					</div>
				</div>
			</div>
		</Show>
	);
};
