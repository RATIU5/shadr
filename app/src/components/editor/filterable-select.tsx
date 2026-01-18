import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

type SelectOption = {
	value: string;
	label: string;
};

type FilterableSelectProps = {
	value: string;
	options: SelectOption[];
	onChange: (value: string) => void;
	class?: string;
	placeholder?: string;
	disabled?: boolean;
	ariaLabel?: string;
	onKeyDown?: (event: KeyboardEvent) => void;
};

export const FilterableSelect = (props: FilterableSelectProps) => {
	const [isOpen, setIsOpen] = createSignal(false);
	const [query, setQuery] = createSignal("");
	const [activeIndex, setActiveIndex] = createSignal(0);
	let rootRef: HTMLDivElement | undefined;
	let triggerRef: HTMLButtonElement | undefined;
	let inputRef: HTMLInputElement | undefined;

	const selectedLabel = createMemo(() => {
		const match = props.options.find((option) => option.value === props.value);
		return match?.label ?? props.placeholder ?? "Select";
	});

	const filteredOptions = createMemo(() => {
		const needle = query().trim().toLowerCase();
		if (!needle) {
			return props.options;
		}
		return props.options.filter((option) =>
			option.label.toLowerCase().includes(needle),
		);
	});

	createEffect(() => {
		if (!isOpen()) {
			return;
		}
		query();
		filteredOptions();
		setActiveIndex(0);
	});

	const openMenu = (nextQuery = "") => {
		if (props.disabled) {
			return;
		}
		setQuery(nextQuery);
		setIsOpen(true);
		setActiveIndex(0);
		queueMicrotask(() => {
			inputRef?.focus();
			inputRef?.select();
		});
	};

	const closeMenu = () => {
		setIsOpen(false);
		setQuery("");
		queueMicrotask(() => triggerRef?.focus());
	};

	const selectOption = (value: string) => {
		props.onChange(value);
		closeMenu();
	};

	const handleTriggerKeyDown = (event: KeyboardEvent) => {
		props.onKeyDown?.(event);
		if (props.disabled) {
			return;
		}
		if (
			event.key === "ArrowDown" ||
			event.key === "Enter" ||
			event.key === " "
		) {
			event.preventDefault();
			openMenu();
			return;
		}
		if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
			event.preventDefault();
			openMenu(event.key);
		}
	};

	const handleListKeyDown = (event: KeyboardEvent) => {
		props.onKeyDown?.(event);
		if (event.key === "Escape") {
			event.preventDefault();
			closeMenu();
			return;
		}
		const options = filteredOptions();
		if (options.length === 0) {
			return;
		}
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((current) => Math.min(options.length - 1, current + 1));
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((current) => Math.max(0, current - 1));
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			selectOption(options[activeIndex()]?.value ?? options[0].value);
		}
	};

	createEffect(() => {
		if (!isOpen()) {
			return;
		}
		const handlePointerDown = (event: PointerEvent) => {
			if (!rootRef) {
				return;
			}
			if (!rootRef.contains(event.target as Node)) {
				closeMenu();
			}
		};
		window.addEventListener("pointerdown", handlePointerDown);
		return () => window.removeEventListener("pointerdown", handlePointerDown);
	});

	return (
		<div
			ref={(element) => {
				rootRef = element;
			}}
			class="relative"
		>
			<button
				ref={(element) => {
					triggerRef = element;
				}}
				type="button"
				class={props.class}
				disabled={props.disabled}
				aria-haspopup="listbox"
				aria-expanded={isOpen()}
				aria-label={props.ariaLabel}
				onClick={() => (isOpen() ? closeMenu() : openMenu())}
				onKeyDown={handleTriggerKeyDown}
			>
				<div class="flex items-center justify-between gap-2">
					<span class="truncate">{selectedLabel()}</span>
					<span class="text-[10px] text-[#6b7688]">▾</span>
				</div>
			</button>
			<Show when={isOpen()}>
				<div class="absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-lg border border-[#2a3342] bg-[#0f131b] p-2 shadow-[0_12px_24px_rgba(0,0,0,0.35)]">
					<input
						ref={(element) => {
							inputRef = element;
						}}
						type="text"
						class="w-full rounded border border-[#2a3342] bg-[#0b0f16] px-2 py-1 text-[12px] text-[#f4f5f7] focus:outline-none"
						placeholder="Type to filter..."
						value={query()}
						onInput={(event) =>
							setQuery((event.currentTarget as HTMLInputElement).value)
						}
						onKeyDown={handleListKeyDown}
					/>
					<div
						class="mt-2 max-h-40 overflow-auto rounded-lg border border-[#1f2430] bg-[#0b0f16]"
						role="listbox"
						tabindex="-1"
						onKeyDown={handleListKeyDown}
					>
						<Show when={filteredOptions().length > 0}>
							<For each={filteredOptions()}>
								{(option, index) => (
									<button
										type="button"
										role="option"
										class="flex w-full items-center justify-between px-2 py-1.5 text-left text-[12px] text-[#d7dde7] hover:bg-[#141b26]"
										classList={{
											"bg-[#152134]": index() === activeIndex(),
										}}
										onMouseEnter={() => setActiveIndex(index())}
										onClick={() => selectOption(option.value)}
									>
										<span>{option.label}</span>
										<Show when={option.value === props.value}>
											<span class="text-[10px] text-[#5fa8ff]">Selected</span>
										</Show>
									</button>
								)}
							</For>
						</Show>
						<Show when={filteredOptions().length === 0}>
							<div class="px-2 py-2 text-[11px] text-[#7f8796]">
								No matches found.
							</div>
						</Show>
					</div>
				</div>
			</Show>
		</div>
	);
};
