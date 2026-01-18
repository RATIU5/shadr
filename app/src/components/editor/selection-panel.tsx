import {
	type EditorSelectionState,
	getNodeDefinition,
	type ShaderComplexity,
	type ShaderDebugTrace,
} from "@shadr/lib-editor";
import { createMemo, createSignal, For, Show } from "solid-js";
import { FilterableSelect } from "./filterable-select";

import type { PreviewSample, PreviewStatus } from "./types";

type PreviewOptions = {
	clampOutput: boolean;
	precision: "mediump" | "highp";
};

type PreviewFocus = "output" | "selection";

type SelectionPanelProps = {
	selection: EditorSelectionState;
	nodeTitle: string;
	onNodeTitleChange: (value: string) => void;
	onNodeTitleCommit: () => void;
	onDeleteSelection: () => void;
	previewStatus: PreviewStatus;
	previewSample: PreviewSample | null;
	previewFps: number | null;
	showFps: boolean;
	previewResolution: number;
	onPreviewResolutionChange: (value: number) => void;
	previewFocus: PreviewFocus;
	onPreviewFocusChange: (value: PreviewFocus) => void;
	previewOptions: PreviewOptions;
	onPreviewOptionsChange: (next: Partial<PreviewOptions>) => void;
	setPreviewRef: (element: HTMLCanvasElement) => void;
	onPreviewExport: () => void;
	textureName: string;
	connectionCount: number | null;
	shaderComplexity: ShaderComplexity | null;
	optimizationSuggestions: string[];
	nodeColorTag: string | null;
	onNodeColorTagChange: (value: string | null) => void;
	groupTitle: string;
	onGroupTitleChange: (value: string) => void;
	onGroupTitleCommit: () => void;
	groupColor: string;
	groupHasCustomColor: boolean;
	onGroupColorChange: (value: string) => void;
	onGroupColorReset: () => void;
	debugMode: boolean;
	debugTrace: ShaderDebugTrace | null;
	debugStepIndex: number;
	debugStatus: "idle" | "paused" | "complete";
	debugBreakpoints: number[];
	onDebugStepInto: () => void;
	onDebugStepOver: () => void;
	onDebugContinue: () => void;
	onDebugReset: () => void;
	onToggleBreakpoint: (nodeId: number) => void;
};

const labelClass = "text-[10px] uppercase tracking-[0.16em] text-[#7f8796]";
const inputClass =
	"w-full rounded border border-[#2a3342] bg-[#0f131b] px-2 py-1.5 text-[12px] text-[#f4f5f7] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]";
const selectClass =
	"w-full rounded border border-[#2a3342] bg-[#0f131b] px-2 py-1.5 text-[12px] text-[#f4f5f7] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]";

const formatPortType = (type: string) => type.toUpperCase();

const formatSampleHex = (sample: PreviewSample) => {
	const toHex = (value: number) =>
		Math.max(0, Math.min(255, Math.round(value)))
			.toString(16)
			.padStart(2, "0");
	return `#${toHex(sample.r)}${toHex(sample.g)}${toHex(sample.b)}`;
};

const formatSampleFloat = (value: number) =>
	(Math.max(0, Math.min(255, value)) / 255).toFixed(3);

const clampNumber = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

const formatMeterWidth = (value: number, max: number) =>
	`${Math.min(100, Math.round((value / max) * 100))}%`;

const previewResolutions = [128, 256, 512, 1024];

const colorTags = [
	{ id: "none", label: "None", color: "#334155" },
	{ id: "sky", label: "Sky", color: "#38bdf8" },
	{ id: "mint", label: "Mint", color: "#34d399" },
	{ id: "amber", label: "Amber", color: "#f59e0b" },
	{ id: "rose", label: "Rose", color: "#fb7185" },
	{ id: "violet", label: "Violet", color: "#a855f7" },
];

export const SelectionPanel = (props: SelectionPanelProps) => {
	const [previewZoom, setPreviewZoom] = createSignal(1);
	const [panOffset, setPanOffset] = createSignal({ x: 0, y: 0 });
	const [showOptimizations, setShowOptimizations] = createSignal(false);
	let panning = false;
	let panStart = { x: 0, y: 0, originX: 0, originY: 0 };

	const selectionNode = createMemo(() =>
		props.selection.kind === "node" ? props.selection.node : null,
	);

	const nodeDefinition = createMemo(() => {
		const node = selectionNode();
		return node?.typeId ? getNodeDefinition(node.typeId) : null;
	});

	const nodeHeader = createMemo(() => {
		const selection = props.selection;
		if (selection.kind === "node") {
			const definition = nodeDefinition();
			return {
				title: props.nodeTitle.trim() || selection.node.title,
				typeLabel: definition?.label ?? selection.node.typeId ?? "Node",
				category: definition?.category ?? "Node",
			};
		}
		if (selection.kind === "connection") {
			return {
				title: "Connection",
				typeLabel: `${selection.connection.from.nodeId}:${selection.connection.from.portId} -> ${selection.connection.to.nodeId}:${selection.connection.to.portId}`,
				category: selection.connection.type.toUpperCase(),
			};
		}
		if (selection.kind === "group") {
			return {
				title: selection.group.title,
				typeLabel: `Group ${selection.group.id}`,
				category: selection.group.collapsed ? "Collapsed" : "Expanded",
			};
		}
		if (selection.kind === "multi") {
			return {
				title: "Multiple Selection",
				typeLabel: `${selection.nodes.length} nodes, ${selection.groups.length} groups`,
				category: `${selection.connections.length} connections`,
			};
		}
		return {
			title: "No selection",
			typeLabel: "Select a node",
			category: "",
		};
	});

	const portGroups = createMemo(() => {
		const node = selectionNode();
		if (!node) {
			return { inputs: [], outputs: [] };
		}
		const inputs = node.ports.filter((port) => port.direction === "input");
		const outputs = node.ports.filter((port) => port.direction === "output");
		return { inputs, outputs };
	});

	const applyZoom = (delta: number) => {
		setPreviewZoom((value) => clampNumber(value + delta, 0.5, 3));
	};

	const setZoom = (value: number) => {
		setPreviewZoom(clampNumber(value, 0.5, 3));
	};

	const resetView = () => {
		setPreviewZoom(1);
		setPanOffset({ x: 0, y: 0 });
	};

	const handlePanStart = (event: PointerEvent) => {
		if (event.button !== 1) {
			return;
		}
		event.preventDefault();
		panning = true;
		panStart = {
			x: event.clientX,
			y: event.clientY,
			originX: panOffset().x,
			originY: panOffset().y,
		};
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	};

	const handlePanMove = (event: PointerEvent) => {
		if (!panning) {
			return;
		}
		const dx = event.clientX - panStart.x;
		const dy = event.clientY - panStart.y;
		setPanOffset({
			x: panStart.originX + dx,
			y: panStart.originY + dy,
		});
	};

	const handlePanEnd = (event: PointerEvent) => {
		if (!panning) {
			return;
		}
		panning = false;
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
	};

	const previewTransform = createMemo(() => {
		const pan = panOffset();
		return `translate(${pan.x}px, ${pan.y}px) scale(${previewZoom()})`;
	});
	const debugSteps = createMemo(() => props.debugTrace?.steps ?? []);
	const activeDebugStep = createMemo(() => {
		const steps = debugSteps();
		const index = props.debugStepIndex;
		if (index < 0 || index >= steps.length) {
			return null;
		}
		return steps[index] ?? null;
	});
	const debugNodes = createMemo(() => {
		const trace = props.debugTrace;
		if (!trace) {
			return [];
		}
		const breakpoints = new Set(props.debugBreakpoints);
		return [...trace.nodes]
			.map((node: ShaderDebugTrace["nodes"][number]) => ({
				...node,
				timeMs: trace.nodeTimings[node.id] ?? 0,
				isBreakpoint: breakpoints.has(node.id),
				isActive: activeDebugStep()?.nodeId === node.id,
			}))
			.sort((a, b) => b.timeMs - a.timeMs);
	});
	const activeDebugNode = createMemo(() => {
		const trace = props.debugTrace;
		const step = activeDebugStep();
		if (!trace || !step) {
			return null;
		}
		return (
			trace.nodes.find(
				(node: ShaderDebugTrace["nodes"][number]) => node.id === step.nodeId,
			) ?? null
		);
	});

	return (
		<div class="absolute right-4 top-4 z-[6] w-[min(380px,calc(100%-32px))]">
			<div class="flex max-h-[calc(100vh-140px)] flex-col gap-3 overflow-hidden rounded-lg border border-[#2a3241] bg-[rgba(13,17,25,0.94)] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.45)] backdrop-blur">
				<div class="flex items-start justify-between gap-3">
					<div>
						<div class="text-[10px] uppercase tracking-[0.2em] text-[#8b95a5]">
							Selection
						</div>
						<div class="mt-1 text-[15px] font-semibold text-[#f4f5f7]">
							{nodeHeader().title}
						</div>
						<div class="text-[11px] text-[#9aa6b5]">
							{nodeHeader().typeLabel}
							<Show when={nodeHeader().category}>
								<span class="text-[#5f6a7d]"> · </span>
								<span>{nodeHeader().category}</span>
							</Show>
						</div>
					</div>
					<button
						type="button"
						class="rounded-full border border-[#3a2230] bg-[#1f1418] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#f5b3b3] hover:bg-[#2a171d]"
						onClick={() => props.onDeleteSelection()}
						disabled={props.selection.kind === "none"}
					>
						Delete
					</button>
				</div>

				<div class="flex flex-col gap-2 rounded-lg border border-[#1f2430] bg-[#0b0f16] p-2">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<div class={labelClass}>Shader Preview</div>
							<span
								class="rounded-full border border-[#2a3241] bg-[#121822] px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[#9aa6b5]"
								classList={{
									"border-[#244a39] bg-[#0f1c16] text-[#98f5c3]":
										props.previewStatus.tone === "ready",
									"border-[#4c3a20] bg-[#201a12] text-[#ffd07a]":
										props.previewStatus.tone === "warning",
									"border-[#4c2c2c] bg-[#201417] text-[#ff9a8a]":
										props.previewStatus.tone === "error",
								}}
							>
								{props.previewStatus.tone}
							</span>
						</div>
						<div class="text-[10px] text-[#7f8796]">
							<div>{props.textureName}</div>
							<Show when={typeof props.previewStatus.compileMs === "number"}>
								<div class="text-[#6b7688]">
									Compile {props.previewStatus.compileMs?.toFixed(1)}ms
								</div>
							</Show>
							<Show
								when={props.showFps && typeof props.previewFps === "number"}
							>
								<div class="text-[#6b7688]">FPS {props.previewFps}</div>
							</Show>
						</div>
					</div>
					<div
						class="relative w-full overflow-hidden rounded-lg border border-[#1f2430]"
						style={{
							"aspect-ratio": "1 / 1",
							"background-color": "#0b0d12",
							"background-image":
								"linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.06) 75%, rgba(255,255,255,0.06)), linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.06) 75%, rgba(255,255,255,0.06))",
							"background-size": "16px 16px",
							"background-position": "0 0, 8px 8px",
						}}
						onPointerDown={handlePanStart}
						onPointerMove={handlePanMove}
						onPointerUp={handlePanEnd}
						onPointerCancel={handlePanEnd}
					>
						<canvas
							ref={(element) => props.setPreviewRef(element)}
							id="preview-canvas"
							class="block h-full w-full"
							style={{
								transform: previewTransform(),
								"transform-origin": "center",
							}}
						/>
					</div>
					<div class="grid gap-2">
						<div class="grid grid-cols-[1fr,auto] items-center gap-2">
							<span class="text-[11px] text-[#b9c2cf]">Resolution</span>
							<FilterableSelect
								value={String(props.previewResolution)}
								options={previewResolutions.map((value) => ({
									value: String(value),
									label: `${value}px`,
								}))}
								onChange={(value) =>
									props.onPreviewResolutionChange(Number.parseInt(value, 10))
								}
								class={selectClass}
								ariaLabel="Preview resolution"
							/>
						</div>
						<label class="flex items-center justify-between text-[11px] text-[#9aa6b5]">
							<span>Preview at Output</span>
							<input
								type="checkbox"
								checked={props.previewFocus === "output"}
								onChange={(event) =>
									props.onPreviewFocusChange(
										event.currentTarget.checked ? "output" : "selection",
									)
								}
								class="h-4 w-4 accent-[#5fa8ff]"
							/>
						</label>
						<div class="flex items-center justify-between text-[11px] text-[#9aa6b5]">
							<span>Zoom</span>
							<div class="flex items-center gap-2">
								<button
									type="button"
									class="rounded-lg border border-[#2b3445] bg-[#111723] px-2 py-1 text-[11px] text-[#d7dde7]"
									onClick={() => applyZoom(-0.25)}
								>
									-
								</button>
								<button
									type="button"
									class="rounded-lg border border-[#2b3445] bg-[#111723] px-2 py-1 text-[11px] text-[#d7dde7]"
									onClick={() => setZoom(1)}
								>
									100%
								</button>
								<button
									type="button"
									class="rounded-lg border border-[#2b3445] bg-[#111723] px-2 py-1 text-[11px] text-[#d7dde7]"
									onClick={() => setZoom(2)}
								>
									200%
								</button>
								<span class="min-w-[48px] text-center">
									{Math.round(previewZoom() * 100)}%
								</span>
								<button
									type="button"
									class="rounded-lg border border-[#2b3445] bg-[#111723] px-2 py-1 text-[11px] text-[#d7dde7]"
									onClick={() => applyZoom(0.25)}
								>
									+
								</button>
								<button
									type="button"
									class="rounded-lg border border-[#2b3445] bg-[#111723] px-2 py-1 text-[11px] text-[#d7dde7]"
									onClick={resetView}
								>
									Fit
								</button>
							</div>
						</div>
						<button
							type="button"
							class="rounded-lg border border-[#2b3445] bg-[#111723] px-2 py-1 text-[11px] text-[#d7dde7] hover:bg-[#182133]"
							onClick={() => props.onPreviewExport()}
						>
							Export PNG
						</button>
					</div>
					<div
						class="text-[12px] leading-[1.4] text-[#b9c2cf]"
						classList={{
							"text-[#98f5c3]": props.previewStatus.tone === "ready",
							"text-[#ffd07a]": props.previewStatus.tone === "warning",
							"text-[#ff9a8a]": props.previewStatus.tone === "error",
						}}
					>
						<span>{props.previewStatus.message}</span>
						<Show when={props.previewStatus.details?.length}>
							<ul class="mt-1.5 grid list-disc gap-1 pl-5">
								<For each={props.previewStatus.details ?? []}>
									{(detail) => <li>{detail}</li>}
								</For>
							</ul>
						</Show>
						<Show when={props.previewStatus.tone === "error"}>
							<div class="mt-1 text-[11px] text-[#ff7b6b]">
								Export is disabled until errors are resolved.
							</div>
						</Show>
					</div>
				</div>

				<div class="rounded-lg border border-[#1f2430] bg-[#0b0f16] p-3">
					<div class="flex items-center justify-between gap-2">
						<div class={labelClass}>Shader Complexity</div>
						<button
							type="button"
							class="rounded-full border border-[#2b3445] bg-[#111723] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#d7dde7] hover:bg-[#182133]"
							onClick={() => setShowOptimizations((value) => !value)}
						>
							Optimize Shader
						</button>
					</div>
					<div class="mt-2 grid gap-3 text-[12px] text-[#d7dde7]">
						<Show
							when={props.shaderComplexity}
							fallback={
								<span class="text-[#7f8796]">
									Compile a shader to see complexity.
								</span>
							}
						>
							{(complexity) => (
								<div class="grid gap-3">
									<div class="grid gap-1">
										<div class="flex items-center justify-between">
											<span>Vertex instructions</span>
											<span class="text-[10px] text-[#9aa6b5]">
												{complexity().vertexInstructions}
											</span>
										</div>
										<div class="h-1.5 rounded-full bg-[#121722]">
											<div
												class="h-full rounded-full bg-[#5fa8ff]"
												style={{
													width: formatMeterWidth(
														complexity().vertexInstructions,
														200,
													),
												}}
											/>
										</div>
									</div>
									<div class="grid gap-1">
										<div class="flex items-center justify-between">
											<span>Fragment instructions</span>
											<span class="text-[10px] text-[#9aa6b5]">
												{complexity().fragmentInstructions}
											</span>
										</div>
										<div class="h-1.5 rounded-full bg-[#121722]">
											<div
												class="h-full rounded-full bg-[#f59e0b]"
												style={{
													width: formatMeterWidth(
														complexity().fragmentInstructions,
														300,
													),
												}}
											/>
										</div>
									</div>
									<div class="grid gap-1">
										<div class="flex items-center justify-between">
											<span>Texture samples</span>
											<span class="text-[10px] text-[#9aa6b5]">
												{complexity().textureSamples}
											</span>
										</div>
										<div class="h-1.5 rounded-full bg-[#121722]">
											<div
												class="h-full rounded-full bg-[#ef4444]"
												style={{
													width: formatMeterWidth(
														complexity().textureSamples,
														12,
													),
												}}
											/>
										</div>
									</div>
								</div>
							)}
						</Show>
						<Show when={showOptimizations()}>
							<ul class="grid list-disc gap-1 pl-4 text-[11px] text-[#9aa6b5]">
								<For each={props.optimizationSuggestions}>
									{(suggestion) => <li>{suggestion}</li>}
								</For>
							</ul>
						</Show>
					</div>
				</div>

				<div class="rounded-lg border border-[#1f2430] bg-[#0b0f16] p-3">
					<div class="flex items-center justify-between">
						<div class={labelClass}>Output Information</div>
						<div class="text-[11px] text-[#7f8796]">
							Connections: {props.connectionCount ?? 0}
						</div>
					</div>
					<div class="mt-2 grid gap-2 text-[12px] text-[#d7dde7]">
						<div>
							<div class="text-[11px] text-[#9aa6b5]">Socket Types</div>
							<div class="mt-1 grid gap-1">
								<Show
									when={
										portGroups().inputs.length > 0 ||
										portGroups().outputs.length > 0
									}
									fallback={
										<span class="text-[#7f8796]">
											Select a node to inspect socket types.
										</span>
									}
								>
									<div class="grid gap-1">
										<Show when={portGroups().inputs.length > 0}>
											<div class="text-[10px] uppercase tracking-[0.16em] text-[#6f7a8b]">
												Inputs
											</div>
											<For each={portGroups().inputs}>
												{(port) => (
													<div class="flex items-center justify-between">
														<span>{port.name}</span>
														<span class="text-[10px] text-[#94a3b8]">
															{formatPortType(port.type)}
														</span>
													</div>
												)}
											</For>
										</Show>
										<Show when={portGroups().outputs.length > 0}>
											<div class="mt-2 text-[10px] uppercase tracking-[0.16em] text-[#6f7a8b]">
												Outputs
											</div>
											<For each={portGroups().outputs}>
												{(port) => (
													<div class="flex items-center justify-between">
														<span>{port.name}</span>
														<span class="text-[10px] text-[#94a3b8]">
															{formatPortType(port.type)}
														</span>
													</div>
												)}
											</For>
										</Show>
									</div>
								</Show>
							</div>
						</div>
						<div>
							<div class="text-[11px] text-[#9aa6b5]">Preview Sample</div>
							<Show
								when={props.previewSample}
								fallback={
									<span class="text-[#7f8796]">No sample available.</span>
								}
							>
								{(sample) => (
									<div class="mt-1 grid gap-1">
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<span
													class="h-3 w-3 rounded"
													style={{
														"background-color": formatSampleHex(sample()),
													}}
												/>
												<span class="text-[11px] text-[#9aa6b5]">
													{formatSampleHex(sample())}
												</span>
											</div>
											<span class="text-[10px] text-[#7f8796]">
												RGBA {sample().r}, {sample().g}, {sample().b},{" "}
												{sample().a}
											</span>
										</div>
										<div class="text-[10px] text-[#7f8796]">
											Normalized {formatSampleFloat(sample().r)},
											{formatSampleFloat(sample().g)},
											{formatSampleFloat(sample().b)},
											{formatSampleFloat(sample().a)}
										</div>
									</div>
								)}
							</Show>
						</div>
					</div>
				</div>

				<Show when={props.debugMode}>
					<details
						open
						class="rounded-lg border border-[#1f2430] bg-[#0b0f16] p-3"
					>
						<summary class="flex cursor-pointer list-none items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[#8b95a5]">
							<span>Debug Execution</span>
							<span class="text-[12px] text-[#6b7688]">Controls</span>
						</summary>
						<div class="mt-3 grid gap-3 text-[12px] text-[#d7dde7]">
							<Show
								when={props.debugTrace}
								fallback={
									<div class="text-[11px] text-[#7f8796]">
										Compile to load debug trace.
									</div>
								}
							>
								<div class="flex items-center justify-between text-[11px] text-[#9aa6b5]">
									<span>Status: {props.debugStatus}</span>
									<span>
										Step{" "}
										{props.debugStepIndex >= 0
											? props.debugStepIndex + 1
											: "--"}{" "}
										/ {debugSteps().length}
									</span>
								</div>
								<Show when={activeDebugNode()}>
									{(node) => (
										<div class="rounded-md border border-[#202838] bg-[#121826] p-2">
											<div class="text-[10px] uppercase tracking-[0.16em] text-[#7f8796]">
												Current
											</div>
											<div class="mt-1 text-[12px] text-[#f4f5f7]">
												Node {node().id}: {node().title}
											</div>
											<Show when={activeDebugStep()}>
												{(step) => (
													<div class="mt-1 text-[10px] text-[#7f8796]">
														Stage {step().stage.toUpperCase()} · Depth{" "}
														{step().depth}
													</div>
												)}
											</Show>
										</div>
									)}
								</Show>
								<div class="grid grid-cols-2 gap-2 text-[11px]">
									<button
										type="button"
										class="rounded border border-[#2b3445] bg-[#111723] px-2 py-1 text-[#d7dde7] hover:bg-[#182133]"
										disabled={debugSteps().length === 0}
										onClick={() => props.onDebugStepInto()}
									>
										Step Into
									</button>
									<button
										type="button"
										class="rounded border border-[#2b3445] bg-[#111723] px-2 py-1 text-[#d7dde7] hover:bg-[#182133]"
										disabled={debugSteps().length === 0}
										onClick={() => props.onDebugStepOver()}
									>
										Step Over
									</button>
									<button
										type="button"
										class="rounded border border-[#2b3445] bg-[#111723] px-2 py-1 text-[#d7dde7] hover:bg-[#182133]"
										disabled={debugSteps().length === 0}
										onClick={() => props.onDebugContinue()}
									>
										Continue
									</button>
									<button
										type="button"
										class="rounded border border-[#3a2230] bg-[#1f1418] px-2 py-1 text-[#f5b3b3] hover:bg-[#2a171d]"
										disabled={debugSteps().length === 0}
										onClick={() => props.onDebugReset()}
									>
										Reset
									</button>
								</div>
								<div class="grid gap-2">
									<div class="text-[10px] uppercase tracking-[0.16em] text-[#7f8796]">
										Breakpoints
									</div>
									<div class="max-h-[160px] overflow-y-auto rounded border border-[#1f2430] bg-[#0f131d] p-1">
										<For
											each={debugNodes()}
											fallback={
												<div class="px-2 py-1 text-[11px] text-[#7f8796]">
													No nodes executed.
												</div>
											}
										>
											{(node) => (
												<button
													type="button"
													class="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] text-[#d7dde7] hover:bg-[#182133]"
													classList={{
														"bg-[#162033]": node.isActive,
														"text-[#9cc4ff]": node.isBreakpoint,
													}}
													onClick={() => props.onToggleBreakpoint(node.id)}
												>
													<span class="truncate">
														#{node.id} {node.title}
													</span>
													<span class="text-[10px] text-[#7f8796]">
														{node.timeMs.toFixed(2)}ms
													</span>
												</button>
											)}
										</For>
									</div>
								</div>
							</Show>
						</div>
					</details>
				</Show>

				<details class="rounded-lg border border-[#1f2430] bg-[#0b0f16] p-3">
					<summary class="flex cursor-pointer list-none items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[#8b95a5]">
						<span>Advanced Options</span>
						<span class="text-[12px] text-[#6b7688]">Toggle</span>
					</summary>
					<div class="mt-3 grid gap-3 text-[12px] text-[#d7dde7]">
						<label class="flex items-center justify-between gap-2">
							<span>Output clamping</span>
							<input
								type="checkbox"
								checked={props.previewOptions.clampOutput}
								onChange={(event) =>
									props.onPreviewOptionsChange({
										clampOutput: event.currentTarget.checked,
									})
								}
								class="h-4 w-4 accent-[#5fa8ff]"
							/>
						</label>
						<div class="grid gap-1">
							<span class="text-[11px] text-[#9aa6b5]">Precision mode</span>
							<FilterableSelect
								class={selectClass}
								value={props.previewOptions.precision}
								options={[
									{ value: "mediump", label: "Medium" },
									{ value: "highp", label: "High" },
								]}
								onChange={(value) =>
									props.onPreviewOptionsChange({
										precision: value as "mediump" | "highp",
									})
								}
								ariaLabel="Precision mode"
							/>
						</div>
						<Show when={props.selection.kind === "node"}>
							<label class="grid gap-1">
								<span class="text-[11px] text-[#9aa6b5]">
									Custom node label
								</span>
								<input
									type="text"
									class={inputClass}
									value={props.nodeTitle}
									placeholder="Node label"
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
							</label>
							<div class="grid gap-2">
								<div class="text-[11px] text-[#9aa6b5]">Color tag</div>
								<div class="flex flex-wrap gap-2">
									<For each={colorTags}>
										{(tag) => {
											const isSelected =
												(tag.id === "none" && !props.nodeColorTag) ||
												props.nodeColorTag === tag.color;
											return (
												<button
													type="button"
													class="flex items-center gap-1 rounded-full border border-[#2b3445] bg-[#111723] px-2 py-1 text-[10px] text-[#d7dde7]"
													classList={{
														"border-[#5fa8ff]": isSelected,
													}}
													onClick={() =>
														props.onNodeColorTagChange(
															tag.id === "none" ? null : tag.color,
														)
													}
												>
													<span
														class="h-2.5 w-2.5 rounded-full"
														style={{ "background-color": tag.color }}
													/>
													<span>{tag.label}</span>
												</button>
											);
										}}
									</For>
								</div>
							</div>
						</Show>
						<Show when={props.selection.kind === "group"}>
							<label class="grid gap-1">
								<span class="text-[11px] text-[#9aa6b5]">Frame title</span>
								<input
									type="text"
									class={inputClass}
									value={props.groupTitle}
									placeholder="Frame title"
									onInput={(event) =>
										props.onGroupTitleChange(event.currentTarget.value)
									}
									onBlur={() => props.onGroupTitleCommit()}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											props.onGroupTitleCommit();
											event.currentTarget.blur();
										}
									}}
								/>
							</label>
							<div class="grid gap-2">
								<div class="text-[11px] text-[#9aa6b5]">Frame color</div>
								<div class="flex items-center gap-2">
									<input
										type="color"
										value={props.groupColor}
										onInput={(event) =>
											props.onGroupColorChange(event.currentTarget.value)
										}
										class="h-8 w-10 rounded border border-[#2a3342] bg-[#0f131b]"
									/>
									<span class="text-[11px] text-[#9aa6b5]">
										{props.groupColor}
									</span>
									<Show when={props.groupHasCustomColor}>
										<button
											type="button"
											class="rounded border border-[#2b3445] bg-[#111723] px-2 py-1 text-[10px] text-[#d7dde7]"
											onClick={() => props.onGroupColorReset()}
										>
											Use default
										</button>
									</Show>
								</div>
							</div>
						</Show>
					</div>
				</details>
			</div>
		</div>
	);
};
