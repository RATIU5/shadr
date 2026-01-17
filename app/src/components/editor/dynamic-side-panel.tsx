import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";

type DynamicPanelValue = string | number | boolean;

type DynamicPanelItem =
	| {
			type: "section";
			label: string;
			description?: string;
	  }
	| {
			type: "paragraph";
			text: string;
	  }
	| {
			type: "input";
			id: string;
			label: string;
			inputType: "text" | "number" | "select" | "toggle" | "textarea";
			placeholder?: string;
			helperText?: string;
			defaultValue?: DynamicPanelValue;
			min?: number;
			max?: number;
			step?: number;
			rows?: number;
			options?: Array<{ value: string; label: string }>;
	  };

type DynamicPanelTab = {
	id: string;
	label: string;
	items: DynamicPanelItem[];
};

type DynamicSidePanelProps = {
	title: string;
	tabs: DynamicPanelTab[];
	initialTabId?: string;
	initialValues?: Record<string, DynamicPanelValue>;
	onValuesChange?: (values: Record<string, DynamicPanelValue>) => void;
	class?: string;
};

const inputClass =
	"w-full rounded-lg border border-[#2a3342] bg-[#0f131b] px-2 py-1.5 text-[12px] text-[#f4f5f7] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]";

const labelClass = "text-[10px] uppercase tracking-[0.16em] text-[#7f8796]";

const sectionClass = "rounded-xl border border-[#232b3a] bg-[#0f131c] p-3";

export const DynamicSidePanel = (props: DynamicSidePanelProps) => {
	const [activeTabId, setActiveTabId] = createSignal(
		props.initialTabId ?? props.tabs[0]?.id ?? "",
	);
	const [values, setValues] = createStore<Record<string, DynamicPanelValue>>(
		props.initialValues ?? {},
	);

	const defaults = createMemo(() => {
		const next: Record<string, DynamicPanelValue> = {};
		for (const tab of props.tabs) {
			for (const item of tab.items) {
				if (item.type === "input" && item.defaultValue !== undefined) {
					next[item.id] = item.defaultValue;
				}
			}
		}
		return next;
	});

	const activeTab = createMemo(
		() => props.tabs.find((tab) => tab.id === activeTabId()) ?? null,
	);

	createEffect(() => {
		if (!props.tabs.find((tab) => tab.id === activeTabId())) {
			setActiveTabId(props.tabs[0]?.id ?? "");
		}
	});

	createEffect(() => {
		if (!props.initialValues) {
			return;
		}
		setValues((current) => ({ ...current, ...props.initialValues }));
	});

	createEffect(() => {
		const seeded = defaults();
		setValues((current) => {
			const next = { ...current };
			for (const [key, value] of Object.entries(seeded)) {
				if (!Object.hasOwn(next, key)) {
					next[key] = value;
				}
			}
			return next;
		});
	});

	createEffect(() => {
		props.onValuesChange?.({ ...values });
	});

	const updateValue = (id: string, value: DynamicPanelValue) => {
		setValues(id, value);
	};

	return (
		<div
			class={`absolute z-[6] w-[min(360px,calc(100%-32px))] ${props.class ?? "right-4 top-4"}`}
		>
			<div class="flex max-h-[calc(100vh-140px)] flex-col gap-3 overflow-hidden rounded-2xl border border-[#2a3241] bg-[rgba(13,17,25,0.94)] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.45)] backdrop-blur">
				<div class="flex items-center justify-between gap-2">
					<div class="text-[11px] uppercase tracking-[0.18em] text-[#9aa6b5]">
						{props.title}
					</div>
				</div>
				<div class="flex flex-wrap gap-1 rounded-xl border border-[#1f2430] bg-[#0b0f16] p-1">
					<For each={props.tabs}>
						{(tab) => (
							<button
								type="button"
								class="rounded-lg px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#7f8796] transition"
								classList={{
									"bg-[#141b26] text-[#f4f5f7]": tab.id === activeTabId(),
									"hover:text-[#d7dde7]": tab.id !== activeTabId(),
								}}
								onClick={() => setActiveTabId(tab.id)}
							>
								{tab.label}
							</button>
						)}
					</For>
				</div>
				<div class="flex flex-col gap-3 overflow-y-auto pr-1">
					<Show when={activeTab()} keyed>
						{(tab) => (
							<For each={tab.items}>
								{(item) => {
									if (item.type === "section") {
										return (
											<div class={sectionClass}>
												<div class={labelClass}>{item.label}</div>
												<Show when={item.description}>
													<div class="mt-2 text-[12px] text-[#b9c2cf]">
														{item.description}
													</div>
												</Show>
											</div>
										);
									}

									if (item.type === "paragraph") {
										return (
											<div class="rounded-xl border border-[#1f2430] bg-[#0b0f16] p-3 text-[12px] leading-[1.5] text-[#b9c2cf]">
												{item.text}
											</div>
										);
									}

									const value = values[item.id];
									const displayValue =
										typeof value === "boolean"
											? ""
											: typeof value === "number"
												? String(value)
												: (value ?? "");

									if (item.inputType === "toggle") {
										return (
											<div class={sectionClass}>
												<label class="flex items-center justify-between gap-2 text-[12px] text-[#d7dde7]">
													<span>{item.label}</span>
													<input
														type="checkbox"
														class="h-4 w-4 accent-[#5fa8ff]"
														checked={Boolean(value)}
														onInput={(event) =>
															updateValue(item.id, event.currentTarget.checked)
														}
													/>
												</label>
												<Show when={item.helperText}>
													<div class="mt-2 text-[11px] text-[#7f8796]">
														{item.helperText}
													</div>
												</Show>
											</div>
										);
									}

									return (
										<div class={sectionClass}>
											<div class={labelClass}>{item.label}</div>
											<Show when={item.inputType === "select"}>
												<select
													class={`mt-2 ${inputClass}`}
													value={displayValue}
													onChange={(event) =>
														updateValue(item.id, event.currentTarget.value)
													}
												>
													<For each={item.options ?? []}>
														{(option) => (
															<option value={option.value}>
																{option.label}
															</option>
														)}
													</For>
												</select>
											</Show>
											<Show when={item.inputType === "textarea"}>
												<textarea
													class={`mt-2 ${inputClass} resize-none`}
													rows={item.rows ?? 3}
													value={displayValue}
													placeholder={item.placeholder}
													onInput={(event) =>
														updateValue(item.id, event.currentTarget.value)
													}
												/>
											</Show>
											<Show when={item.inputType === "text"}>
												<input
													type="text"
													class={`mt-2 ${inputClass}`}
													value={displayValue}
													placeholder={item.placeholder}
													onInput={(event) =>
														updateValue(item.id, event.currentTarget.value)
													}
												/>
											</Show>
											<Show when={item.inputType === "number"}>
												<input
													type="number"
													class={`mt-2 ${inputClass}`}
													value={displayValue}
													min={item.min}
													max={item.max}
													step={item.step}
													onInput={(event) =>
														updateValue(item.id, event.currentTarget.value)
													}
												/>
											</Show>
											<Show when={item.helperText}>
												<div class="mt-2 text-[11px] text-[#7f8796]">
													{item.helperText}
												</div>
											</Show>
										</div>
									);
								}}
							</For>
						)}
					</Show>
				</div>
			</div>
		</div>
	);
};

export type { DynamicPanelItem, DynamicPanelTab, DynamicPanelValue };
