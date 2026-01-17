import {
	type EditorSelectionState,
	getDefaultNodeState,
	getInputSelection,
	getInputSelectOptions,
	getNodeDefinition,
	type NodeParamSpec,
	type NodeParamValue,
	type NodeState,
} from "@shadr/lib-editor";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";

type SelectionPanelProps = {
	selection: EditorSelectionState;
	nodeTitle: string;
	onNodeTitleChange: (value: string) => void;
	onNodeTitleCommit: () => void;
	onNodeStateUpdate: (
		params: Record<string, NodeParamValue>,
		ui?: NodeState["ui"],
	) => void;
	onDeleteSelection: () => void;
	portDefaults: Record<string, string>;
	onPortNameCommit: (portId: string, name: string) => void;
	onPortNameReset: (portId: string) => void;
};

type ParamRow = {
	id: string;
	label: string;
	description?: string;
	inline: boolean;
	specs: NodeParamSpec[];
};

type TabSection = {
	label: string;
	rows: ParamRow[];
};

type TabConfig = {
	id: string;
	label: string;
	sections: TabSection[];
};

const inputClass =
	"w-full rounded-lg border border-[#2a3342] bg-[#0f131b] px-2 py-1.5 text-[12px] text-[#f4f5f7] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]";

const labelClass = "text-[10px] uppercase tracking-[0.16em] text-[#7f8796]";

const rowClass = "flex items-center justify-between text-[12px] text-[#d7dde7]";

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

const isVectorValue = (
	value: NodeParamValue,
): value is { x: number; y: number; z?: number; w?: number } =>
	typeof value === "object" && value !== null && "x" in value && "y" in value;

const isColorValue = (
	value: NodeParamValue,
): value is { r: number; g: number; b: number; a: number } =>
	typeof value === "object" &&
	value !== null &&
	"r" in value &&
	"g" in value &&
	"b" in value &&
	"a" in value;

const buildTabLabel = (tabId: string) => {
	if (!tabId) {
		return "Details";
	}
	return tabId;
};

export const SelectionPanel = (props: SelectionPanelProps) => {
	const [activeTabId, setActiveTabId] = createSignal("");
	const [paramValues, setParamValues] = createStore<
		Record<string, NodeParamValue>
	>({});
	const [portNames, setPortNames] = createStore<Record<string, string>>({});

	const selectionNode = createMemo(() =>
		props.selection.kind === "node" ? props.selection.node : null,
	);

	const nodeDefinition = createMemo(() => {
		const node = selectionNode();
		return node?.typeId ? getNodeDefinition(node.typeId) : null;
	});

	const normalizedState = createMemo<NodeState | null>(() => {
		const node = selectionNode();
		const definition = nodeDefinition();
		if (!node || !definition) {
			return null;
		}
		const defaults = getDefaultNodeState(definition.id) ?? {
			version: 1,
			params: {},
		};
		const params = { ...defaults.params, ...(node.state?.params ?? {}) };
		return {
			version: node.state?.version ?? defaults.version,
			params,
			ui: { ...defaults.ui, ...(node.state?.ui ?? {}) },
		};
	});

	const currentState = createMemo<NodeState | null>(() => {
		const base = normalizedState();
		if (!base) {
			return null;
		}
		return {
			version: base.version,
			params: { ...base.params, ...paramValues },
			ui: base.ui,
		};
	});

	const tabConfigs = createMemo<TabConfig[]>(() => {
		const definition = nodeDefinition();
		const state = currentState();
		if (!definition || !state) {
			return [];
		}

		const tabIds = new Set<string>();
		definition.uiTabs?.forEach((tab) => {
			if (tab.id) {
				tabIds.add(tab.id);
			}
		});
		definition.parameters.forEach((spec) => {
			const tabId = spec.ui?.tab ?? "Details";
			tabIds.add(tabId);
		});

		const tabs = Array.from(tabIds).map((id) => {
			const tabLabel =
				definition.uiTabs?.find((entry) => entry.id === id)?.label ??
				buildTabLabel(id);
			return { id, label: tabLabel };
		});

		const byTab = new Map<string, Map<string, NodeParamSpec[]>>();
		definition.parameters.forEach((spec) => {
			if (spec.isVisible && !spec.isVisible(state)) {
				return;
			}
			const tabId = spec.ui?.tab ?? "Details";
			const sectionLabel = spec.ui?.section ?? "Parameters";
			if (!byTab.has(tabId)) {
				byTab.set(tabId, new Map());
			}
			const sections = byTab.get(tabId);
			if (!sections) {
				return;
			}
			if (!sections.has(sectionLabel)) {
				sections.set(sectionLabel, []);
			}
			sections.get(sectionLabel)?.push(spec);
		});

		return tabs.map((tab) => {
			const sections = byTab.get(tab.id) ?? new Map();
			const sectionEntries = Array.from(sections.entries()).map(
				([label, specs]) => {
					const ordered = [...specs].sort(
						(a, b) => (a.ui?.order ?? 0) - (b.ui?.order ?? 0),
					);
					const rows: ParamRow[] = [];
					ordered.forEach((spec) => {
						const inline = Boolean(spec.ui?.inline);
						const currentRow = rows[rows.length - 1];
						if (inline && currentRow && currentRow.inline) {
							currentRow.specs.push(spec);
							return;
						}
						rows.push({
							id: `${label}:${spec.id}`,
							label,
							description: spec.description,
							inline,
							specs: [spec],
						});
					});
					return { label, rows };
				},
			);
			return {
				id: tab.id,
				label: tab.label,
				sections: sectionEntries,
			};
		});
	});

	createEffect(() => {
		const state = normalizedState();
		if (!state) {
			setParamValues({});
			setActiveTabId("");
			return;
		}
		setParamValues(state.params);
		const tabs = tabConfigs();
		const candidate = state.ui?.lastTabId ?? tabs[0]?.id ?? "";
		const tabIds = new Set(tabs.map((tab) => tab.id));
		const next =
			candidate === "io" || tabIds.has(candidate)
				? candidate
				: (tabs[0]?.id ?? "");
		setActiveTabId(next);
	});

	createEffect(() => {
		const selection = props.selection;
		if (selection.kind !== "node") {
			setPortNames({});
			return;
		}
		const next: Record<string, string> = {};
		selection.node.ports.forEach((port) => {
			next[port.id] = port.name;
		});
		setPortNames(next);
	});

	const setActiveTab = (tabId: string) => {
		setActiveTabId(tabId);
		props.onNodeStateUpdate({}, { lastTabId: tabId });
	};

	const getParamValue = (spec: NodeParamSpec) => {
		const value = paramValues[spec.id];
		return value ?? spec.defaultValue;
	};

	const getVectorAxes = (spec: NodeParamSpec, state: NodeState) => {
		if (spec.kind === "vec2") {
			return ["x", "y"] as const;
		}
		if (spec.kind === "vec3") {
			return ["x", "y", "z"] as const;
		}
		if (spec.kind === "vec4") {
			const type =
				typeof state.params.type === "string" ? state.params.type : null;
			if (type === "vec2") {
				return ["x", "y"] as const;
			}
			if (type === "vec3") {
				return ["x", "y", "z"] as const;
			}
			return ["x", "y", "z", "w"] as const;
		}
		return [] as const;
	};

	const updateParam = (spec: NodeParamSpec, value: NodeParamValue) => {
		setParamValues(spec.id, value);
		if (!selectionNode()) {
			return;
		}
		const nextParams: Record<string, NodeParamValue> = {
			[spec.id]: value,
		};
		if (spec.id === "options") {
			const state = currentState();
			if (state) {
				const nextState: NodeState = {
					version: state.version,
					params: { ...state.params, options: value },
					ui: state.ui,
				};
				const selection = getInputSelection(nextState);
				if (selection !== state.params.selection) {
					nextParams.selection = selection;
					setParamValues("selection", selection);
				}
			}
		}
		props.onNodeStateUpdate(nextParams);
	};

	const renderControl = (spec: NodeParamSpec) => {
		const state = currentState();
		if (!state) {
			return null;
		}
		const value = getParamValue(spec);
		const description = spec.description;

		if (spec.kind === "boolean") {
			return (
				<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
					<label class="flex items-center justify-between gap-2 text-[12px] text-[#d7dde7]">
						<span>{spec.label}</span>
						<input
							type="checkbox"
							class="h-4 w-4 accent-[#5fa8ff]"
							checked={Boolean(value)}
							onInput={(event) =>
								updateParam(spec, event.currentTarget.checked)
							}
						/>
					</label>
					<Show when={description}>
						<div class="mt-2 text-[11px] text-[#7f8796]">{description}</div>
					</Show>
				</div>
			);
		}

		if (spec.kind === "enum") {
			const rawOptions =
				spec.options ??
				(spec.id === "selection"
					? getInputSelectOptions(state).map((option) => ({
							value: option,
							label: option,
						}))
					: []);
			const fallback = rawOptions[0]?.value ?? "";
			const currentValue = typeof value === "string" ? value : fallback;
			const resolvedValue =
				spec.id === "selection" ? getInputSelection(state) : currentValue;
			return (
				<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
					<div class={labelClass}>{spec.label}</div>
					<select
						class={`mt-2 ${inputClass}`}
						value={resolvedValue}
						onChange={(event) => updateParam(spec, event.currentTarget.value)}
					>
						<For each={rawOptions}>
							{(option) => <option value={option.value}>{option.label}</option>}
						</For>
					</select>
					<Show when={description}>
						<div class="mt-2 text-[11px] text-[#7f8796]">{description}</div>
					</Show>
				</div>
			);
		}

		if (spec.kind === "color") {
			const colorValue = isColorValue(value)
				? value
				: isColorValue(spec.defaultValue)
					? spec.defaultValue
					: { r: 1, g: 1, b: 1, a: 1 };
			const hex = formatHexColor(colorValue);
			return (
				<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
					<div class={labelClass}>{spec.label}</div>
					<div class="mt-2 flex items-center gap-2">
						<input
							type="color"
							class="h-8 w-[42px] rounded-md border border-[#2a3342] bg-transparent p-0"
							value={hex}
							onInput={(event) => {
								const rgb = parseHexColor(event.currentTarget.value);
								if (!rgb) {
									return;
								}
								updateParam(spec, {
									r: rgb.r,
									g: rgb.g,
									b: rgb.b,
									a: clamp01(colorValue.a),
								});
							}}
						/>
						<input
							type="number"
							min="0"
							max="1"
							step="0.01"
							class={inputClass}
							value={clamp01(colorValue.a).toString()}
							onInput={(event) => {
								const parsed = Number.parseFloat(event.currentTarget.value);
								updateParam(spec, {
									r: colorValue.r,
									g: colorValue.g,
									b: colorValue.b,
									a: clamp01(Number.isFinite(parsed) ? parsed : 0),
								});
							}}
						/>
					</div>
					<Show when={description}>
						<div class="mt-2 text-[11px] text-[#7f8796]">{description}</div>
					</Show>
				</div>
			);
		}

		if (spec.kind === "vec2" || spec.kind === "vec3" || spec.kind === "vec4") {
			const defaultVector = isVectorValue(spec.defaultValue)
				? spec.defaultValue
				: { x: 0, y: 0, z: 0, w: 0 };
			const vectorValue = isVectorValue(value) ? value : defaultVector;
			const axes = getVectorAxes(spec, state);
			return (
				<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
					<div class={labelClass}>{spec.label}</div>
					<div class="mt-2 grid grid-cols-2 gap-2">
						<For each={axes}>
							{(axis) => (
								<input
									type="number"
									step={spec.step ?? 0.01}
									class={inputClass}
									value={String(vectorValue[axis] ?? 0)}
									onInput={(event) => {
										const parsed = Number.parseFloat(event.currentTarget.value);
										const next = {
											...vectorValue,
											[axis]: Number.isFinite(parsed) ? parsed : 0,
										};
										updateParam(spec, next);
									}}
								/>
							)}
						</For>
					</div>
					<Show when={description}>
						<div class="mt-2 text-[11px] text-[#7f8796]">{description}</div>
					</Show>
				</div>
			);
		}

		const numericKinds = spec.kind === "float" || spec.kind === "int";
		if (numericKinds) {
			const numericValue =
				typeof value === "number" && Number.isFinite(value)
					? value
					: typeof spec.defaultValue === "number"
						? spec.defaultValue
						: 0;
			const step = spec.step ?? (spec.kind === "int" ? 1 : 0.01);
			return (
				<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
					<div class={labelClass}>{spec.label}</div>
					<input
						type="number"
						class={`mt-2 ${inputClass}`}
						value={numericValue}
						min={spec.min}
						max={spec.max}
						step={step}
						onInput={(event) => {
							const parsed = Number.parseFloat(event.currentTarget.value);
							const next = Number.isFinite(parsed)
								? spec.kind === "int"
									? Math.round(parsed)
									: parsed
								: 0;
							updateParam(spec, next);
						}}
					/>
					<Show when={description}>
						<div class="mt-2 text-[11px] text-[#7f8796]">{description}</div>
					</Show>
				</div>
			);
		}

		const displayValue =
			typeof value === "string"
				? value
				: Array.isArray(value)
					? value.join(", ")
					: "";
		return (
			<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
				<div class={labelClass}>{spec.label}</div>
				<input
					type="text"
					class={`mt-2 ${inputClass}`}
					value={displayValue}
					onInput={(event) => updateParam(spec, event.currentTarget.value)}
				/>
				<Show when={description}>
					<div class="mt-2 text-[11px] text-[#7f8796]">{description}</div>
				</Show>
			</div>
		);
	};

	const renderNodeDetails = () => {
		const selection = props.selection;
		if (selection.kind === "none") {
			return null;
		}

		if (selection.kind === "multi") {
			return (
				<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
					<div class={labelClass}>Multi-Select</div>
					<div class="mt-2 flex flex-col gap-1">
						<div class={rowClass}>
							<span class="text-[#7f8796]">Nodes</span>
							<span>{selection.nodes.length}</span>
						</div>
						<div class={rowClass}>
							<span class="text-[#7f8796]">Groups</span>
							<span>{selection.groups.length}</span>
						</div>
						<div class={rowClass}>
							<span class="text-[#7f8796]">Connections</span>
							<span>{selection.connections.length}</span>
						</div>
					</div>
				</div>
			);
		}

		if (selection.kind === "connection") {
			return (
				<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
					<div class={labelClass}>Connection</div>
					<div class="mt-2 text-[12px] text-[#7f8796]">
						Details shown in the status bar.
					</div>
				</div>
			);
		}

		if (selection.kind === "group") {
			return (
				<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
					<div class={labelClass}>Group</div>
					<div class="mt-2 flex flex-col gap-1">
						<div class={rowClass}>
							<span class="text-[#7f8796]">Name</span>
							<span>{selection.group.title}</span>
						</div>
						<div class={rowClass}>
							<span class="text-[#7f8796]">Nodes</span>
							<span>{selection.group.nodeIds.length}</span>
						</div>
						<div class={rowClass}>
							<span class="text-[#7f8796]">Collapsed</span>
							<span>{selection.group.collapsed ? "Yes" : "No"}</span>
						</div>
					</div>
				</div>
			);
		}

		const definition = nodeDefinition();
		const state = currentState();
		const tabs = tabConfigs();
		const inputs = selection.node.ports.filter(
			(port) => port.direction === "input",
		);
		const outputs = selection.node.ports.filter(
			(port) => port.direction === "output",
		);

		return (
			<div class="flex flex-col gap-3">
				<div class="flex flex-wrap gap-1 rounded-xl border border-[#1f2430] bg-[#0b0f16] p-1">
					<For each={tabs}>
						{(tab) => (
							<button
								type="button"
								class="rounded-lg px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#7f8796] transition"
								classList={{
									"bg-[#141b26] text-[#f4f5f7]": tab.id === activeTabId(),
									"hover:text-[#d7dde7]": tab.id !== activeTabId(),
								}}
								onClick={() => setActiveTab(tab.id)}
							>
								{tab.label}
							</button>
						)}
					</For>
					<button
						type="button"
						class="rounded-lg px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#7f8796] transition"
						classList={{
							"bg-[#141b26] text-[#f4f5f7]": activeTabId() === "io",
							"hover:text-[#d7dde7]": activeTabId() !== "io",
						}}
						onClick={() => setActiveTab("io")}
					>
						IO
					</button>
				</div>
				<Show when={activeTabId() !== "io"} fallback={null}>
					<div class="flex flex-col gap-3">
						<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
							<div class={labelClass}>Name</div>
							<input
								type="text"
								class={`mt-2 ${inputClass}`}
								value={props.nodeTitle}
								onInput={(event) =>
									props.onNodeTitleChange(event.currentTarget.value)
								}
								onBlur={() => props.onNodeTitleCommit()}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										props.onNodeTitleCommit();
										event.currentTarget.blur();
									}
								}}
							/>
						</div>
						<Show when={definition && state && tabs.length > 0}>
							<Show when={tabs.find((tab) => tab.id === activeTabId())} keyed>
								{(tab) => (
									<For each={tab.sections}>
										{(section) => (
											<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
												<div class={labelClass}>{section.label}</div>
												<For each={section.rows}>
													{(row) => (
														<div
															classList={{
																"mt-2 grid gap-2":
																	row.inline && row.specs.length > 1,
																"grid-cols-2":
																	row.inline && row.specs.length > 1,
																"mt-2 flex flex-col gap-2": !row.inline,
															}}
														>
															<For each={row.specs}>
																{(spec) => renderControl(spec)}
															</For>
														</div>
													)}
												</For>
											</div>
										)}
									</For>
								)}
							</Show>
						</Show>
					</div>
				</Show>
				<Show when={activeTabId() === "io"}>
					<div class="flex flex-col gap-3">
						<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
							<div class={labelClass}>Inputs</div>
							<Show when={inputs.length === 0}>
								<div class="mt-2 text-[12px] text-[#7f8796]">
									No input ports.
								</div>
							</Show>
							<For each={inputs}>
								{(port) => {
									const fallbackName = props.portDefaults[port.id] ?? port.name;
									const value = portNames[port.id] ?? port.name;
									const canReset = value.trim() !== fallbackName;
									return (
										<div class="mt-3 rounded-lg border border-[#1f2430] bg-[#0b0f16] p-2">
											<div class="flex items-center justify-between text-[11px] text-[#7f8796]">
												<span>{port.id}</span>
												<span>{port.type}</span>
											</div>
											<div class="mt-2 flex items-center gap-2">
												<input
													type="text"
													class={inputClass}
													value={value}
													onInput={(event) =>
														setPortNames(port.id, event.currentTarget.value)
													}
													onBlur={() => props.onPortNameCommit(port.id, value)}
													onKeyDown={(event) => {
														if (event.key === "Enter") {
															event.preventDefault();
															props.onPortNameCommit(port.id, value);
															event.currentTarget.blur();
														}
													}}
												/>
												<button
													type="button"
													class="rounded-lg border border-[#2b3445] bg-[#121823] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#9aa6b5] transition hover:border-[#41506a] hover:text-[#e3e9f3]"
													classList={{
														"opacity-40": !canReset,
													}}
													disabled={!canReset}
													onClick={() => {
														setPortNames(port.id, fallbackName);
														props.onPortNameReset(port.id);
													}}
												>
													Reset
												</button>
											</div>
										</div>
									);
								}}
							</For>
						</div>
						<div class="rounded-xl border border-[#232b3a] bg-[#0f131c] p-3">
							<div class={labelClass}>Outputs</div>
							<Show when={outputs.length === 0}>
								<div class="mt-2 text-[12px] text-[#7f8796]">
									No output ports.
								</div>
							</Show>
							<For each={outputs}>
								{(port) => {
									const fallbackName = props.portDefaults[port.id] ?? port.name;
									const value = portNames[port.id] ?? port.name;
									const canReset = value.trim() !== fallbackName;
									return (
										<div class="mt-3 rounded-lg border border-[#1f2430] bg-[#0b0f16] p-2">
											<div class="flex items-center justify-between text-[11px] text-[#7f8796]">
												<span>{port.id}</span>
												<span>{port.type}</span>
											</div>
											<div class="mt-2 flex items-center gap-2">
												<input
													type="text"
													class={inputClass}
													value={value}
													onInput={(event) =>
														setPortNames(port.id, event.currentTarget.value)
													}
													onBlur={() => props.onPortNameCommit(port.id, value)}
													onKeyDown={(event) => {
														if (event.key === "Enter") {
															event.preventDefault();
															props.onPortNameCommit(port.id, value);
															event.currentTarget.blur();
														}
													}}
												/>
												<button
													type="button"
													class="rounded-lg border border-[#2b3445] bg-[#121823] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#9aa6b5] transition hover:border-[#41506a] hover:text-[#e3e9f3]"
													classList={{
														"opacity-40": !canReset,
													}}
													disabled={!canReset}
													onClick={() => {
														setPortNames(port.id, fallbackName);
														props.onPortNameReset(port.id);
													}}
												>
													Reset
												</button>
											</div>
										</div>
									);
								}}
							</For>
						</div>
					</div>
				</Show>
			</div>
		);
	};

	return (
		<Show when={props.selection.kind !== "none"}>
			<div class="absolute right-4 top-4 z-[6] w-[min(320px,calc(100%-32px))]">
				<div class="flex max-h-[calc(100vh-140px)] flex-col gap-3 overflow-hidden rounded-2xl border border-[#2a3241] bg-[rgba(13,17,25,0.94)] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.45)] backdrop-blur">
					<div class="flex items-center justify-between gap-2">
						<div class="text-[11px] uppercase tracking-[0.18em] text-[#9aa6b5]">
							Selection
						</div>
						<button
							type="button"
							class="rounded-full border border-[#3a2230] bg-[#1f1418] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#f5b3b3] hover:bg-[#2a171d]"
							onClick={() => props.onDeleteSelection()}
						>
							Delete
						</button>
					</div>
					<div class="flex flex-col gap-3 overflow-y-auto pr-1">
						{renderNodeDetails()}
					</div>
				</div>
			</div>
		</Show>
	);
};
