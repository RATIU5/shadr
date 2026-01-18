import {
	type ContextMenuItem,
	type ContextMenuState,
	defaultVisualSettings,
	type EditorApp,
	type EditorHoverState,
	type EditorSelectionState,
	type EditorVisualSettings,
	getNodeDefinition,
	initCanvas,
	type NodeRenameState,
	type NodeSocketValue,
	type NodeState,
	type SelectedConnection,
	type SelectedNode,
	type SelectionBounds,
	type SelectionClipboardPayload,
	type ShaderCompileResult,
	type ShaderCompileStatus,
	type ShaderComplexity,
	type ShaderDebugTrace,
	type ShaderPreviewTarget,
	type SocketEditorState,
	type UiMessage,
	type UiMessageTone,
} from "@shadr/lib-editor";
import {
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
} from "solid-js";

import { ActionBar } from "./editor/action-bar";
import { ConnectionTooltip } from "./editor/connection-tooltip";
import { ContextMenuOverlay } from "./editor/context-menu-overlay";
import { ExportModal } from "./editor/export-modal";
import { FloatingSelectionToolbar } from "./editor/floating-selection-toolbar";
import { LeftSidebar, type ShaderLibraryItem } from "./editor/left-sidebar";
import { NodeRenameOverlay } from "./editor/node-rename-overlay";
import { PresetModal } from "./editor/preset-modal";
import { SelectionPanel } from "./editor/selection-panel";
import { SettingsModal } from "./editor/settings-modal";
import { ShortcutsModal } from "./editor/shortcuts-modal";
import { SocketEditorOverlay } from "./editor/socket-editor-overlay";
import { SocketTooltip } from "./editor/socket-tooltip";
import { StatusBar } from "./editor/status-bar";
import type {
	ActionMenuDefinition,
	ActionMenuId,
	PreviewSample,
	PreviewStatus,
	ShortcutGroup,
	UiMessageItem,
} from "./editor/types";
import { UiMessageStack } from "./editor/ui-message-stack";

type PreviewRenderOptions = {
	clampOutput: boolean;
	precision: "mediump" | "highp";
};

type PreviewHandle = {
	updateShader: (
		result: ShaderCompileResult,
		options?: PreviewRenderOptions,
	) => void;
	updateTexture: (file: File | null) => void;
	setResolution: (value: number) => void;
	clear: () => void;
	destroy: () => void;
};

type EditorMode = "edit" | "preview" | "debug";
type PreviewFocus = "output" | "selection";
type PendingPreviewUpdate = {
	focus: PreviewFocus;
	selection: EditorSelectionState;
	options: PreviewRenderOptions;
	latest: ShaderCompileResult | null;
};

const uiMessageTimeouts: Record<UiMessageTone, number> = {
	info: 4000,
	warning: 6000,
	error: 8000,
};

type PresetDefinition = {
	id: string;
	name: string;
	description?: string;
	payload: string;
	builtIn: boolean;
	updatedAt?: string;
};

type StoredPreset = {
	id: string;
	name: string;
	description?: string;
	updatedAt: string;
	payload: string;
};

const presetStorageKey = "shadr-node-presets-v1";

const serializePresetPayload = (payload: SelectionClipboardPayload) =>
	JSON.stringify(payload);

const basicLightingPresetPayload: SelectionClipboardPayload = {
	version: 4,
	nodes: [
		{
			id: 1,
			title: "Light Intensity",
			x: 0,
			y: 0,
			typeId: "inputs",
			state: { version: 1, params: { type: "number" } },
			socketValues: { out: 1 },
			ports: [{ id: "out", name: "Value", type: "float", direction: "output" }],
		},
		{
			id: 2,
			title: "Base Color",
			x: 0,
			y: 140,
			typeId: "constants",
			state: { version: 1, params: { type: "color" } },
			socketValues: { out: { r: 0.92, g: 0.78, b: 0.62, a: 1 } },
			ports: [{ id: "out", name: "Color", type: "color", direction: "output" }],
		},
		{
			id: 3,
			title: "Black",
			x: -200,
			y: 140,
			typeId: "constants",
			state: { version: 1, params: { type: "color" } },
			socketValues: { out: { r: 0, g: 0, b: 0, a: 1 } },
			ports: [{ id: "out", name: "Color", type: "color", direction: "output" }],
		},
		{
			id: 4,
			title: "Lambert Mix",
			x: 220,
			y: 100,
			typeId: "color",
			state: { version: 1, params: { operation: "mix" } },
			ports: [
				{ id: "a", name: "A", type: "color", direction: "input" },
				{ id: "b", name: "B", type: "color", direction: "input" },
				{ id: "t", name: "T", type: "float", direction: "input" },
				{ id: "out", name: "Color", type: "color", direction: "output" },
			],
		},
		{
			id: 5,
			title: "Fragment Output",
			x: 440,
			y: 110,
			typeId: "output",
			state: { version: 1, params: { stage: "fragment" } },
			ports: [{ id: "color", name: "Color", type: "vec4", direction: "input" }],
		},
	],
	connections: [
		{
			from: { nodeId: 3, portId: "out" },
			to: { nodeId: 4, portId: "a" },
			type: "color",
		},
		{
			from: { nodeId: 2, portId: "out" },
			to: { nodeId: 4, portId: "b" },
			type: "color",
		},
		{
			from: { nodeId: 1, portId: "out" },
			to: { nodeId: 4, portId: "t" },
			type: "float",
		},
		{
			from: { nodeId: 4, portId: "out" },
			to: { nodeId: 5, portId: "color" },
			type: "color",
		},
	],
	bounds: { minX: -200, minY: 0, maxX: 440, maxY: 140 },
};

const pbrSetupPresetPayload: SelectionClipboardPayload = {
	version: 4,
	nodes: [
		{
			id: 1,
			title: "UV Input",
			x: 0,
			y: 0,
			typeId: "texture",
			state: { version: 1, params: { operation: "uv-input" } },
			ports: [{ id: "out", name: "UV", type: "vec2", direction: "output" }],
		},
		{
			id: 2,
			title: "Albedo Texture",
			x: 0,
			y: 140,
			typeId: "texture",
			state: { version: 1, params: { operation: "texture-input" } },
			ports: [
				{ id: "out", name: "Texture", type: "texture", direction: "output" },
			],
		},
		{
			id: 3,
			title: "Sample Albedo",
			x: 220,
			y: 80,
			typeId: "texture",
			state: { version: 1, params: { operation: "texture-sample" } },
			ports: [
				{ id: "tex", name: "Texture", type: "texture", direction: "input" },
				{ id: "uv", name: "UV", type: "vec2", direction: "input" },
				{ id: "out", name: "Color", type: "vec4", direction: "output" },
			],
		},
		{
			id: 4,
			title: "Fragment Output",
			x: 440,
			y: 90,
			typeId: "output",
			state: { version: 1, params: { stage: "fragment" } },
			ports: [{ id: "color", name: "Color", type: "vec4", direction: "input" }],
		},
	],
	connections: [
		{
			from: { nodeId: 1, portId: "out" },
			to: { nodeId: 3, portId: "uv" },
			type: "vec2",
		},
		{
			from: { nodeId: 2, portId: "out" },
			to: { nodeId: 3, portId: "tex" },
			type: "texture",
		},
		{
			from: { nodeId: 3, portId: "out" },
			to: { nodeId: 4, portId: "color" },
			type: "vec4",
		},
	],
	bounds: { minX: 0, minY: 0, maxX: 440, maxY: 140 },
};

const builtInPresets: PresetDefinition[] = [
	{
		id: "preset-basic-lighting",
		name: "Basic Lighting",
		description: "Mixes a base color with an intensity slider before output.",
		payload: serializePresetPayload(basicLightingPresetPayload),
		builtIn: true,
	},
	{
		id: "preset-pbr-setup",
		name: "PBR Setup",
		description: "UV + texture sample chain for a base color texture.",
		payload: serializePresetPayload(pbrSetupPresetPayload),
		builtIn: true,
	},
];

const getUiMessageToneClass = (tone: UiMessageTone) => {
	if (tone === "error") {
		return "border-[#5b1b1b] bg-[#2a1417] text-[#f6c4c4]";
	}
	if (tone === "warning") {
		return "border-[#5b3c1b] bg-[#2a2014] text-[#f2d2a4]";
	}
	return "border-[#1f2d46] bg-[#141b28] text-[#c8d6ee]";
};

const getUiMessageToneLabel = (tone: UiMessageTone) => {
	if (tone === "error") {
		return "Error";
	}
	if (tone === "warning") {
		return "Warning";
	}
	return "Info";
};

const formatPortColor = (color: number) =>
	`#${color.toString(16).padStart(6, "0")}`;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const parseHexColorNumber = (value: string) => {
	const normalized = value.replace("#", "");
	if (normalized.length !== 6) {
		return null;
	}
	const parsed = Number.parseInt(normalized, 16);
	if (Number.isNaN(parsed)) {
		return null;
	}
	return parsed;
};

const defaultVisualSettingsState: EditorVisualSettings = {
	...defaultVisualSettings,
	debugOverlay: import.meta.env.DEV,
};

const visualSettingsStorageKey = "shadr-visual-preferences-v1";

const shortcutGroups: ShortcutGroup[] = [
	{
		id: "navigation",
		label: "Canvas Navigation",
		hint: "Always available",
		entries: [
			{
				id: "pan-space",
				keys: ["Space + Drag"],
				description: "Pan the canvas.",
			},
			{
				id: "pan-middle",
				keys: ["Middle Mouse Drag"],
				description: "Pan the canvas.",
			},
			{
				id: "zoom-wheel",
				keys: ["Scroll Wheel"],
				description: "Zoom in or out.",
			},
			{
				id: "frame-selection",
				keys: ["F"],
				description: "Frame the current selection.",
			},
		],
	},
	{
		id: "selection",
		label: "Selection + Movement",
		hint: "Canvas interactions",
		entries: [
			{
				id: "select-node",
				keys: ["Click"],
				description: "Select a node or group.",
			},
			{
				id: "multi-select",
				keys: ["Shift + Click"],
				description: "Add/remove nodes, groups, or wires to selection.",
			},
			{
				id: "drag-node",
				keys: ["Drag"],
				description: "Move selected nodes or groups.",
			},
			{
				id: "wire-drag",
				keys: ["Drag Port"],
				description: "Start a connection between ports.",
			},
			{
				id: "wire-disconnect",
				keys: ["Drag Wire to Empty"],
				description: "Disconnect an existing connection.",
			},
			{
				id: "context-menu",
				keys: ["Right Click"],
				description: "Open the context menu.",
			},
		],
	},
	{
		id: "graph",
		label: "Graph Actions",
		hint: "Global keyboard shortcuts",
		entries: [
			{
				id: "add-node",
				keys: ["Cmd/Ctrl + K", "/"],
				description: "Open the node search palette.",
			},
			{
				id: "create-node",
				keys: ["N"],
				description: "Create a new node at the viewport center.",
			},
			{
				id: "edit-const",
				keys: ["Enter"],
				description: "Edit a selected constant node.",
				detail: "Only works when exactly one constant node is selected.",
			},
			{
				id: "group",
				keys: ["Cmd/Ctrl + G"],
				description: "Group the current selection.",
			},
			{
				id: "ungroup",
				keys: ["Cmd/Ctrl + Shift + G"],
				description: "Ungroup the current selection.",
			},
			{
				id: "delete-selection",
				keys: ["Delete", "Backspace"],
				description: "Delete the current selection.",
			},
			{
				id: "duplicate-selection",
				keys: ["Cmd/Ctrl + D"],
				description: "Duplicate the current selection.",
			},
			{
				id: "undo",
				keys: ["Cmd/Ctrl + Z"],
				description: "Undo the last action.",
			},
			{
				id: "redo",
				keys: ["Cmd/Ctrl + Shift + Z", "Cmd/Ctrl + Y"],
				description: "Redo the last action.",
			},
			{
				id: "save",
				keys: ["Cmd/Ctrl + S"],
				description: "Save the current graph.",
			},
			{
				id: "load",
				keys: ["Cmd/Ctrl + O"],
				description: "Load a saved graph.",
			},
			{
				id: "export",
				keys: ["Cmd/Ctrl + E"],
				description: "Export GLSL from the current graph.",
			},
			{
				id: "compile",
				keys: ["Cmd/Ctrl + Enter"],
				description: "Compile the shader and refresh the preview.",
			},
			{
				id: "mode-edit",
				keys: ["Alt + 1"],
				description: "Switch to Edit mode.",
			},
			{
				id: "mode-preview",
				keys: ["Alt + 2"],
				description: "Switch to Preview mode.",
			},
			{
				id: "mode-toggle-preview",
				keys: ["Alt + P"],
				description: "Toggle Preview mode.",
			},
			{
				id: "mode-debug",
				keys: ["Alt + 3"],
				description: "Switch to Debug mode.",
			},
		],
	},
	{
		id: "palette",
		label: "Node Search Palette",
		hint: "When the palette is open",
		entries: [
			{
				id: "palette-filter",
				keys: ["Type"],
				description: "Filter the node list.",
			},
			{
				id: "palette-move",
				keys: ["Arrow Up/Down"],
				description: "Move selection in the list.",
			},
			{
				id: "palette-choose",
				keys: ["Enter"],
				description: "Create the selected node.",
			},
			{
				id: "palette-close",
				keys: ["Escape", "Click Outside"],
				description: "Close the palette.",
			},
		],
	},
	{
		id: "dropdown",
		label: "Node Dropdowns",
		hint: "When a dropdown is open",
		entries: [
			{
				id: "dropdown-close",
				keys: ["Escape"],
				description: "Close the dropdown.",
			},
		],
	},
	{
		id: "const-editor",
		label: "Constant Editor",
		hint: "When editing a constant node",
		entries: [
			{
				id: "const-apply",
				keys: ["Enter"],
				description: "Apply values and close.",
			},
			{
				id: "const-close",
				keys: ["Escape"],
				description: "Close the editor.",
			},
			{
				id: "const-click-outside",
				keys: ["Click Outside"],
				description: "Apply values and close.",
			},
		],
	},
	{
		id: "rename",
		label: "Rename Node",
		hint: "When the rename dialog is open",
		entries: [
			{
				id: "rename-apply",
				keys: ["Enter"],
				description: "Apply the new name.",
			},
			{
				id: "rename-cancel",
				keys: ["Escape"],
				description: "Close the dialog.",
			},
			{
				id: "rename-click-outside",
				keys: ["Click Outside"],
				description: "Apply the new name.",
			},
		],
	},
	{
		id: "overlays",
		label: "UI Overlays",
		hint: "Context menus and overlays",
		entries: [
			{
				id: "overlay-close",
				keys: ["Escape", "Click Outside"],
				description: "Close the active overlay.",
			},
			{
				id: "shortcuts",
				keys: ["?"],
				description: "Toggle the shortcuts panel.",
			},
		],
	},
];

const mergeVisualSettings = (
	base: EditorVisualSettings,
	overrides: Partial<EditorVisualSettings> | null,
): EditorVisualSettings => {
	if (!overrides) {
		return base;
	}
	return {
		backgroundColor:
			typeof overrides.backgroundColor === "number"
				? overrides.backgroundColor
				: base.backgroundColor,
		debugOverlay:
			typeof overrides.debugOverlay === "boolean"
				? overrides.debugOverlay
				: base.debugOverlay,
		grid: { ...base.grid, ...(overrides.grid ?? {}) },
		nodes: { ...base.nodes, ...(overrides.nodes ?? {}) },
		groups: { ...base.groups, ...(overrides.groups ?? {}) },
		connections: { ...base.connections, ...(overrides.connections ?? {}) },
	};
};

const readStoredVisualSettings = (): EditorVisualSettings | null => {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		const stored = window.localStorage.getItem(visualSettingsStorageKey);
		if (!stored) {
			return null;
		}
		const parsed = JSON.parse(stored) as Partial<EditorVisualSettings>;
		return mergeVisualSettings(defaultVisualSettingsState, parsed);
	} catch {
		return null;
	}
};

const parseNumberInput = (value: string, fallback: number) => {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const clampNumber = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

const compileWarningThresholdMs = 100;
const nodeWarningThreshold = 100;
const previewThrottleMs = 1000 / 30;

const createShaderPreview = (
	canvas: HTMLCanvasElement,
	setStatus: (status: PreviewStatus) => void,
	setSample: (sample: PreviewSample | null) => void,
	setFps: (value: number | null) => void,
): PreviewHandle => {
	const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
	if (!gl) {
		setStatus({
			tone: "error",
			message: "WebGL is unavailable for shader preview.",
		});
		return {
			updateShader: () => {},
			updateTexture: () => {},
			setResolution: () => {},
			clear: () => {},
			destroy: () => {},
		};
	}

	const quadPositions = new Float32Array([
		-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
	]);
	const quadUvs = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

	const positionBuffer = gl.createBuffer();
	const uvBuffer = gl.createBuffer();
	const previewTexture = gl.createTexture();

	if (!positionBuffer || !uvBuffer || !previewTexture) {
		setStatus({
			tone: "error",
			message: "Failed to initialize preview buffers.",
		});
		return {
			updateShader: () => {},
			updateTexture: () => {},
			setResolution: () => {},
			clear: () => {},
			destroy: () => {},
		};
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, quadPositions, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, quadUvs, gl.STATIC_DRAW);

	const applyTextureParameters = () => {
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	};

	const uploadFallbackTexture = () => {
		gl.bindTexture(gl.TEXTURE_2D, previewTexture);
		applyTextureParameters();
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			1,
			1,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			new Uint8Array([255, 255, 255, 255]),
		);
	};

	const uploadImageTexture = (image: HTMLImageElement) => {
		gl.bindTexture(gl.TEXTURE_2D, previewTexture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
		applyTextureParameters();
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	};

	uploadFallbackTexture();

	let program: WebGLProgram | null = null;
	let positionLocation = -1;
	let uvLocation = -1;
	let timeLocation: WebGLUniformLocation | null = null;
	let textureLocation: WebGLUniformLocation | null = null;
	let animationId = 0;
	let textureLoadId = 0;
	let overrideResolution: number | null = null;
	let lastSampleTime = 0;
	let frameCount = 0;
	let lastFpsMark = performance.now();
	const sampleBuffer = new Uint8Array(4);

	const resizeCanvas = () => {
		const dpr = window.devicePixelRatio || 1;
		const width = Math.max(
			1,
			overrideResolution ?? Math.floor(canvas.clientWidth * dpr),
		);
		const height = Math.max(
			1,
			overrideResolution ?? Math.floor(canvas.clientHeight * dpr),
		);
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
			gl.viewport(0, 0, width, height);
		}
	};

	const resizeObserver = new ResizeObserver(resizeCanvas);
	resizeObserver.observe(canvas);

	const compileShader = (type: number, source: string) => {
		const shader = gl.createShader(type);
		if (!shader) {
			return { shader: null, error: "Unable to allocate shader." };
		}
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const error = gl.getShaderInfoLog(shader) ?? "Shader compile failed.";
			gl.deleteShader(shader);
			return { shader: null, error };
		}
		return { shader, error: "" };
	};

	const linkProgram = (vertexSource: string, fragmentSource: string) => {
		const vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
		if (!vertex.shader) {
			return { program: null, error: vertex.error };
		}

		const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
		if (!fragment.shader) {
			gl.deleteShader(vertex.shader);
			return { program: null, error: fragment.error };
		}

		const nextProgram = gl.createProgram();
		if (!nextProgram) {
			gl.deleteShader(vertex.shader);
			gl.deleteShader(fragment.shader);
			return { program: null, error: "Unable to allocate shader program." };
		}

		gl.attachShader(nextProgram, vertex.shader);
		gl.attachShader(nextProgram, fragment.shader);
		gl.linkProgram(nextProgram);
		gl.deleteShader(vertex.shader);
		gl.deleteShader(fragment.shader);

		if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
			const error = gl.getProgramInfoLog(nextProgram) ?? "Link failed.";
			gl.deleteProgram(nextProgram);
			return { program: null, error };
		}

		return { program: nextProgram, error: "" };
	};

	const updateProgram = (vertexSource: string, fragmentSource: string) => {
		const next = linkProgram(vertexSource, fragmentSource);
		if (!next.program) {
			return next.error;
		}

		if (program) {
			gl.deleteProgram(program);
		}
		program = next.program;
		positionLocation = gl.getAttribLocation(program, "a_position");
		uvLocation = gl.getAttribLocation(program, "a_uv");
		timeLocation = gl.getUniformLocation(program, "u_time");
		textureLocation = gl.getUniformLocation(program, "u_texture");
		return "";
	};

	const startTime = performance.now();
	const renderFrame = () => {
		resizeCanvas();
		gl.clearColor(0.05, 0.06, 0.08, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		if (program) {
			gl.useProgram(program);

			if (positionLocation >= 0) {
				gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
				gl.enableVertexAttribArray(positionLocation);
				gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
			}

			if (uvLocation >= 0) {
				gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
				gl.enableVertexAttribArray(uvLocation);
				gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
			}

			if (timeLocation) {
				gl.uniform1f(timeLocation, (performance.now() - startTime) / 1000);
			}

			if (textureLocation) {
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, previewTexture);
				gl.uniform1i(textureLocation, 0);
			}

			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}

		const now = performance.now();
		if (program && now - lastSampleTime > 250) {
			const x = Math.max(0, Math.floor(canvas.width / 2));
			const y = Math.max(0, Math.floor(canvas.height / 2));
			gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sampleBuffer);
			setSample({
				r: sampleBuffer[0],
				g: sampleBuffer[1],
				b: sampleBuffer[2],
				a: sampleBuffer[3],
			});
			lastSampleTime = now;
		}

		if (!program) {
			setFps(null);
			frameCount = 0;
			lastFpsMark = now;
		} else {
			frameCount += 1;
			const fpsElapsed = now - lastFpsMark;
			if (fpsElapsed >= 500) {
				const fps = Math.round((frameCount * 1000) / fpsElapsed);
				setFps(fps);
				frameCount = 0;
				lastFpsMark = now;
			}
		}

		animationId = window.requestAnimationFrame(renderFrame);
	};

	animationId = window.requestAnimationFrame(renderFrame);

	return {
		updateShader: (result, options) => {
			const previewOptions: PreviewRenderOptions = {
				clampOutput: options?.clampOutput ?? false,
				precision: options?.precision ?? "mediump",
			};
			const compileMs = Number.isFinite(result.compileMs)
				? result.compileMs
				: undefined;
			const nodeCount =
				typeof result.nodeCount === "number" ? result.nodeCount : null;
			const nodeCountWarning =
				nodeCount !== null && nodeCount > nodeWarningThreshold
					? `Graph has ${nodeCount} nodes; performance may dip below 60fps.`
					: null;
			const nodeCountInfo =
				nodeCount !== null ? `Graph nodes: ${nodeCount}` : null;
			if (!result.hasFragmentOutput) {
				if (program) {
					gl.deleteProgram(program);
					program = null;
				}
				setSample(null);
				const details = [];
				if (nodeCountWarning) {
					details.push(nodeCountWarning);
				} else if (nodeCountInfo) {
					details.push(nodeCountInfo);
				}
				setStatus({
					tone: "info",
					message: "Add a Fragment Output node to preview shaders.",
					details: details.length > 0 ? details : undefined,
					compileMs,
				});
				return;
			}

			let fragmentSource = result.fragmentSource;
			if (previewOptions.precision === "highp") {
				fragmentSource = fragmentSource.replace(
					/precision\s+mediump\s+float;/,
					"precision highp float;",
				);
			}
			if (previewOptions.clampOutput) {
				fragmentSource = fragmentSource.replace(
					/gl_FragColor\s*=\s*([^;]+);/,
					"gl_FragColor = clamp($1, 0.0, 1.0);",
				);
			}

			const error = updateProgram(result.vertexSource, fragmentSource);
			if (error) {
				setSample(null);
				setStatus({
					tone: "error",
					message: "No Preview Available.",
					details: [`Preview compile failed: ${error}`],
					compileMs,
				});
				return;
			}

			const compileErrors = result.messages
				.filter((message) => message.kind === "error")
				.map((message) => message.message);
			const compileWarnings = result.messages
				.filter((message) => message.kind === "warning")
				.map((message) => message.message);
			const slowCompileWarning =
				typeof compileMs === "number" && compileMs > compileWarningThresholdMs
					? `Compile time ${compileMs.toFixed(1)}ms exceeds ${compileWarningThresholdMs}ms target.`
					: null;

			if (compileErrors.length > 0) {
				setSample(null);
				const details = [...compileErrors];
				if (nodeCountWarning) {
					details.push(nodeCountWarning);
				} else if (nodeCountInfo) {
					details.push(nodeCountInfo);
				}
				setStatus({
					tone: "error",
					message: "No Preview Available.",
					details,
					compileMs,
				});
				return;
			}

			if (compileWarnings.length > 0) {
				setSample(null);
				const details = [...compileWarnings];
				if (slowCompileWarning) {
					details.push(slowCompileWarning);
				}
				if (nodeCountWarning) {
					details.push(nodeCountWarning);
				} else if (nodeCountInfo) {
					details.push(nodeCountInfo);
				}
				setStatus({
					tone: "warning",
					message: "Preview warnings:",
					details,
					compileMs,
				});
				return;
			}

			if (slowCompileWarning) {
				setSample(null);
				const details = [slowCompileWarning];
				if (nodeCountWarning) {
					details.push(nodeCountWarning);
				} else if (nodeCountInfo) {
					details.push(nodeCountInfo);
				}
				setStatus({
					tone: "warning",
					message: "Shader compile is slow.",
					details,
					compileMs,
				});
				return;
			}

			if (nodeCountWarning) {
				setSample(null);
				setStatus({
					tone: "warning",
					message: "Graph is large.",
					details: [nodeCountWarning],
					compileMs,
				});
				return;
			}

			const readyDetails = nodeCountInfo ? [nodeCountInfo] : undefined;
			setStatus({
				tone: "ready",
				message: "Preview up to date.",
				details: readyDetails,
				compileMs,
			});
		},
		updateTexture: (file) => {
			textureLoadId += 1;
			const currentLoad = textureLoadId;
			if (!file) {
				uploadFallbackTexture();
				return;
			}

			const url = URL.createObjectURL(file);
			const image = new Image();
			image.onload = () => {
				if (currentLoad !== textureLoadId) {
					URL.revokeObjectURL(url);
					return;
				}
				uploadImageTexture(image);
				URL.revokeObjectURL(url);
			};
			image.onerror = () => {
				if (currentLoad !== textureLoadId) {
					URL.revokeObjectURL(url);
					return;
				}
				setStatus({
					tone: "error",
					message: "Failed to load the texture image.",
				});
				URL.revokeObjectURL(url);
			};
			image.src = url;
		},
		setResolution: (value) => {
			overrideResolution = value;
			resizeCanvas();
		},
		clear: () => {
			if (program) {
				gl.deleteProgram(program);
				program = null;
			}
			setSample(null);
		},
		destroy: () => {
			window.cancelAnimationFrame(animationId);
			resizeObserver.disconnect();
			setFps(null);
			if (program) {
				gl.deleteProgram(program);
			}
			gl.deleteBuffer(positionBuffer);
			gl.deleteBuffer(uvBuffer);
			gl.deleteTexture(previewTexture);
		},
	};
};

export default function Editor() {
	let canvasRef: HTMLCanvasElement | undefined;
	let previewRef: HTMLCanvasElement | undefined;
	let stageRef: HTMLDivElement | undefined;
	let menuRef: HTMLDivElement | undefined;
	let actionMenuRef: HTMLDivElement | undefined;
	let textureInputRef: HTMLInputElement | undefined;
	let renameInputRef: HTMLInputElement | undefined;
	let editorHandle: EditorApp | null = null;
	let previewHandle: PreviewHandle | null = null;
	let uiMessageId = 0;
	const uiMessageTimeoutMap = new Map<number, number>();
	let previewUpdateTimer: number | null = null;
	let previewUpdateLast = 0;
	let pendingPreviewUpdate: PendingPreviewUpdate | null = null;
	const [previewStatus, setPreviewStatus] = createSignal<PreviewStatus>({
		tone: "info",
		message: "Add a Fragment Output node to preview shaders.",
	});
	const [previewSample, setPreviewSample] = createSignal<PreviewSample | null>(
		null,
	);
	const [previewFps, setPreviewFps] = createSignal<number | null>(null);
	const [previewResolution, setPreviewResolution] = createSignal(512);
	const [previewFocus, setPreviewFocus] = createSignal<PreviewFocus>("output");
	const [previewOptions, setPreviewOptions] =
		createSignal<PreviewRenderOptions>({
			clampOutput: false,
			precision: "mediump",
		});
	const [contextMenu, setContextMenu] = createSignal<ContextMenuState | null>(
		null,
	);
	const [uiMessages, setUiMessages] = createSignal<UiMessageItem[]>([]);
	const [menuPosition, setMenuPosition] = createSignal({ x: 0, y: 0 });
	const [textureName, setTextureName] = createSignal("No texture selected");
	const [latestShaderResult, setLatestShaderResult] =
		createSignal<ShaderCompileResult | null>(null);
	const [compileStatus, setCompileStatus] =
		createSignal<ShaderCompileStatus>("idle");
	const [lastCompileAt, setLastCompileAt] = createSignal<Date | null>(null);
	const [nodeRenameState, setNodeRenameState] =
		createSignal<NodeRenameState | null>(null);
	const [nodeRenameValue, setNodeRenameValue] = createSignal("");
	const [socketEditorState, setSocketEditorState] =
		createSignal<SocketEditorState | null>(null);
	const [socketEditorValue, setSocketEditorValue] =
		createSignal<NodeSocketValue | null>(null);
	const [selectionState, setSelectionState] =
		createSignal<EditorSelectionState>({
			kind: "none",
		});
	const [selectionBounds, setSelectionBounds] =
		createSignal<SelectionBounds | null>(null);
	const [hoverState, setHoverState] = createSignal<EditorHoverState>({
		kind: "none",
	});
	const [selectionTitle, setSelectionTitle] = createSignal("");
	const [groupTitle, setGroupTitle] = createSignal("");
	const [groupColor, setGroupColor] = createSignal(
		formatPortColor(defaultVisualSettingsState.groups.fillColor),
	);
	const [visualSettings, setVisualSettings] =
		createSignal<EditorVisualSettings>(defaultVisualSettingsState);
	const [showSettings, setShowSettings] = createSignal(false);
	const [showShortcuts, setShowShortcuts] = createSignal(false);
	const [showExportModal, setShowExportModal] = createSignal(false);
	const [showPresetModal, setShowPresetModal] = createSignal(false);
	const [presetName, setPresetName] = createSignal("");
	const [presetDescription, setPresetDescription] = createSignal("");
	const [exportResult, setExportResult] =
		createSignal<ShaderCompileResult | null>(null);
	const [openActionMenu, setOpenActionMenu] = createSignal<ActionMenuId | null>(
		null,
	);
	const [nodeSearchQuery, setNodeSearchQuery] = createSignal("");
	const [editorMode, setEditorMode] = createSignal<EditorMode>("edit");
	const [debugBreakpoints, setDebugBreakpoints] = createSignal<number[]>([]);
	const [debugStepIndex, setDebugStepIndex] = createSignal(-1);
	const [debugStatus, setDebugStatus] = createSignal<
		"idle" | "paused" | "complete"
	>("idle");
	const [visualSettingsLoaded, setVisualSettingsLoaded] = createSignal(false);
	const [storedPresets, setStoredPresets] = createSignal<StoredPreset[]>([]);
	const debugTrace = createMemo<ShaderDebugTrace | null>(
		() => latestShaderResult()?.debugTrace ?? null,
	);
	const debugSteps = createMemo(() => debugTrace()?.steps ?? []);
	const activeDebugStep = createMemo(() => {
		const steps = debugSteps();
		const index = debugStepIndex();
		if (index < 0 || index >= steps.length) {
			return null;
		}
		return steps[index] ?? null;
	});
	const presets = createMemo<PresetDefinition[]>(() => [
		...builtInPresets,
		...storedPresets().map((preset) => ({
			...preset,
			builtIn: false,
		})),
	]);
	const presetById = createMemo(
		() => new Map(presets().map((preset) => [preset.id, preset])),
	);
	const groupHasCustomColor = createMemo(() => {
		const selection = selectionState();
		return (
			selection.kind === "group" &&
			selection.group.color !== null &&
			selection.group.color !== undefined
		);
	});

	const setMenuRef = (element: HTMLDivElement) => {
		menuRef = element;
	};

	const setActionMenuRef = (element: HTMLDivElement) => {
		actionMenuRef = element;
	};

	const setPreviewRef = (element: HTMLCanvasElement) => {
		previewRef = element;
	};

	const setTextureInputRef = (element: HTMLInputElement) => {
		textureInputRef = element;
	};

	const setRenameInputRef = (element: HTMLInputElement) => {
		renameInputRef = element;
	};

	const runPreviewUpdate = (payload: PendingPreviewUpdate) => {
		if (!previewHandle) {
			return;
		}
		const { focus, selection, options, latest } = payload;
		if (focus === "output") {
			if (!latest) {
				return;
			}
			previewHandle.updateShader(latest, options);
			return;
		}

		const target = resolvePreviewTarget(selection);
		if (!target || !editorHandle) {
			previewHandle.clear();
			setPreviewSample(null);
			setPreviewStatus({
				tone: "info",
				message: "No Preview Available.",
				details: ["Select a node with output sockets to preview."],
			});
			return;
		}

		const previewResult = editorHandle.compilePreviewShader(target);
		previewHandle.updateShader(previewResult, options);
	};

	const schedulePreviewUpdate = (payload: PendingPreviewUpdate) => {
		pendingPreviewUpdate = payload;
		if (previewUpdateTimer !== null) {
			return;
		}
		const now = performance.now();
		const elapsed = now - previewUpdateLast;
		const delay = Math.max(0, previewThrottleMs - elapsed);
		previewUpdateTimer = window.setTimeout(() => {
			previewUpdateTimer = null;
			if (!pendingPreviewUpdate) {
				return;
			}
			const next = pendingPreviewUpdate;
			pendingPreviewUpdate = null;
			previewUpdateLast = performance.now();
			runPreviewUpdate(next);
		}, delay);
	};

	const updateVisualSettings = (
		update: (current: EditorVisualSettings) => EditorVisualSettings,
	) => {
		setVisualSettings((current) => update(current));
	};

	const updateEditorMode = (mode: EditorMode) => {
		setEditorMode(mode);
		updateVisualSettings((current) => ({
			...current,
			debugOverlay: mode === "debug",
		}));
		if (!editorHandle) {
			return;
		}
		editorHandle.setDebugMode(mode === "debug");
		if (mode === "debug") {
			editorHandle.compileShader();
		}
	};

	const resetDebugSession = () => {
		setDebugStepIndex(-1);
		setDebugStatus("idle");
	};

	const toggleDebugBreakpoint = (nodeId: number) => {
		setDebugBreakpoints((current) => {
			const next = new Set(current);
			if (next.has(nodeId)) {
				next.delete(nodeId);
			} else {
				next.add(nodeId);
			}
			return Array.from(next);
		});
	};

	const stepIntoDebug = () => {
		const steps = debugSteps();
		if (steps.length === 0) {
			return;
		}
		const nextIndex = Math.min(steps.length - 1, debugStepIndex() + 1);
		setDebugStepIndex(nextIndex);
		setDebugStatus(nextIndex >= steps.length - 1 ? "complete" : "paused");
	};

	const stepOverDebug = () => {
		const steps = debugSteps();
		if (steps.length === 0) {
			return;
		}
		const currentIndex = debugStepIndex();
		if (currentIndex < 0) {
			stepIntoDebug();
			return;
		}
		const currentDepth = steps[currentIndex]?.depth ?? 0;
		let nextIndex = currentIndex + 1;
		while (nextIndex < steps.length) {
			const nextDepth = steps[nextIndex]?.depth ?? 0;
			if (nextDepth <= currentDepth) {
				break;
			}
			nextIndex += 1;
		}
		if (nextIndex >= steps.length) {
			nextIndex = steps.length - 1;
		}
		setDebugStepIndex(nextIndex);
		setDebugStatus(nextIndex >= steps.length - 1 ? "complete" : "paused");
	};

	const continueDebug = () => {
		const steps = debugSteps();
		if (steps.length === 0) {
			return;
		}
		const breakpoints = new Set(debugBreakpoints());
		let nextIndex = debugStepIndex() < 0 ? 0 : debugStepIndex() + 1;
		while (nextIndex < steps.length) {
			const step = steps[nextIndex];
			if (step && breakpoints.has(step.nodeId)) {
				setDebugStepIndex(nextIndex);
				setDebugStatus("paused");
				return;
			}
			nextIndex += 1;
		}
		setDebugStepIndex(steps.length - 1);
		setDebugStatus("complete");
	};

	const resetVisualSettings = () => {
		setVisualSettings(defaultVisualSettingsState);
	};

	const toggleShortcuts = () => {
		setShowShortcuts((current) => !current);
	};

	const closeSettings = () => {
		setShowSettings(false);
	};

	const closeExportModal = () => {
		setShowExportModal(false);
	};

	createEffect(() => {
		const debugOverlayEnabled = visualSettings().debugOverlay;
		if (debugOverlayEnabled && editorMode() !== "debug") {
			setEditorMode("debug");
		} else if (!debugOverlayEnabled && editorMode() === "debug") {
			setEditorMode("edit");
		}
	});

	createEffect(() => {
		const trace = debugTrace();
		if (!trace) {
			resetDebugSession();
			setDebugBreakpoints([]);
			return;
		}
		const validNodes = new Set(
			trace.nodes.map((node: ShaderDebugTrace["nodes"][number]) => node.id),
		);
		setDebugBreakpoints((current) =>
			current.filter((nodeId) => validNodes.has(nodeId)),
		);
		resetDebugSession();
	});

	const toggleActionMenu = (menu: ActionMenuId) => {
		setOpenActionMenu((current) => (current === menu ? null : menu));
	};

	const closeActionMenu = () => {
		setOpenActionMenu(null);
	};

	const handleContextMenuChange = (state: ContextMenuState) => {
		if (!state.isOpen) {
			setContextMenu(null);
			return;
		}
		setContextMenu(state);
		setMenuPosition({ x: state.screenX, y: state.screenY });
	};

	const closeContextMenu = () => {
		if (editorHandle) {
			editorHandle.closeContextMenu();
		} else {
			setContextMenu(null);
		}
	};

	const closeNodeRename = () => {
		if (editorHandle) {
			editorHandle.closeNodeRename();
		} else {
			setNodeRenameState(null);
		}
	};

	const closeSocketEditor = () => {
		if (editorHandle) {
			editorHandle.closeSocketEditor();
		} else {
			setSocketEditorState(null);
			setSocketEditorValue(null);
		}
	};

	const updateSocketEditorValue = (value: NodeSocketValue) => {
		const state = socketEditorState();
		if (!state || !editorHandle) {
			return;
		}
		setSocketEditorValue(value);
		editorHandle.updateNodeSocketValues(state.nodeId, {
			[state.socketId]: value,
		});
	};

	const applyNodeRename = () => {
		const state = nodeRenameState();
		if (!state) {
			return;
		}
		const nextTitle = nodeRenameValue().trim();
		if (nextTitle && editorHandle) {
			editorHandle.updateNodeTitle(state.nodeId, nextTitle);
		}
		closeNodeRename();
	};

	const handleNodeRenameKeyDown = (event: KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			applyNodeRename();
		}
		if (event.key === "Escape") {
			event.preventDefault();
			closeNodeRename();
		}
	};

	const handleContextMenuItem = (item: ContextMenuItem) => {
		if (!item.enabled) {
			return;
		}
		item.action();
		closeContextMenu();
	};

	const removeUiMessage = (id: number) => {
		const timeout = uiMessageTimeoutMap.get(id);
		if (timeout) {
			window.clearTimeout(timeout);
			uiMessageTimeoutMap.delete(id);
		}
		setUiMessages((current) => current.filter((item) => item.id !== id));
	};

	const pushUiMessage = (message: UiMessage) => {
		uiMessageId += 1;
		const id = uiMessageId;
		setUiMessages((current) => [...current, { ...message, id }]);
		const timeout = window.setTimeout(() => {
			removeUiMessage(id);
		}, uiMessageTimeouts[message.tone]);
		uiMessageTimeoutMap.set(id, timeout);
	};

	const parseStoredPreset = (value: unknown): StoredPreset | null => {
		if (typeof value !== "object" || value === null) {
			return null;
		}
		const record = value as Record<string, unknown>;
		if (typeof record.id !== "string" || typeof record.name !== "string") {
			return null;
		}
		if (typeof record.updatedAt !== "string") {
			return null;
		}
		if (typeof record.payload !== "string") {
			return null;
		}
		const description =
			typeof record.description === "string" ? record.description : undefined;
		return {
			id: record.id,
			name: record.name,
			updatedAt: record.updatedAt,
			payload: record.payload,
			...(description ? { description } : {}),
		};
	};

	const loadStoredPresets = () => {
		try {
			const raw = localStorage.getItem(presetStorageKey);
			if (!raw) {
				return [];
			}
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) {
				return [];
			}
			return parsed
				.map((entry) => parseStoredPreset(entry))
				.filter((entry): entry is StoredPreset => Boolean(entry));
		} catch {
			return [];
		}
	};

	const saveStoredPresets = (next: StoredPreset[]) => {
		try {
			localStorage.setItem(presetStorageKey, JSON.stringify(next));
		} catch {
			// Ignore storage errors.
		}
		setStoredPresets(next);
	};

	const createPresetId = () => {
		if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
			return `preset-${crypto.randomUUID()}`;
		}
		return `preset-${Date.now().toString(36)}-${Math.random()
			.toString(36)
			.slice(2, 8)}`;
	};

	const openPresetModal = () => {
		if (!editorHandle) {
			return;
		}
		const payload = editorHandle.getSelectionClipboardJson();
		if (!payload) {
			pushUiMessage({
				tone: "warning",
				message: "Select at least one node before saving a preset.",
			});
			return;
		}
		setPresetName("");
		setPresetDescription("");
		setShowPresetModal(true);
	};

	const closePresetModal = () => {
		setShowPresetModal(false);
	};

	const savePreset = () => {
		if (!editorHandle) {
			return;
		}
		const name = presetName().trim();
		if (!name) {
			return;
		}
		const payload = editorHandle.getSelectionClipboardJson();
		if (!payload) {
			pushUiMessage({
				tone: "warning",
				message: "Select at least one node before saving a preset.",
			});
			return;
		}
		const description = presetDescription().trim();
		const next: StoredPreset = {
			id: createPresetId(),
			name,
			payload,
			updatedAt: new Date().toISOString(),
			...(description ? { description } : {}),
		};
		saveStoredPresets([next, ...storedPresets()]);
		setShowPresetModal(false);
		pushUiMessage({
			tone: "info",
			message: `Saved preset "${name}".`,
		});
	};

	const deletePreset = (presetId: string) => {
		const next = storedPresets().filter((preset) => preset.id !== presetId);
		saveStoredPresets(next);
	};

	const handleTextureChange = (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		setTextureName(file ? file.name : "No texture selected");
		previewHandle?.updateTexture(file);
	};

	const clearTexture = () => {
		if (textureInputRef) {
			textureInputRef.value = "";
		}
		setTextureName("No texture selected");
		previewHandle?.updateTexture(null);
	};

	const runEditorAction = (action: (app: EditorApp) => void) => {
		if (!editorHandle) {
			return;
		}
		action(editorHandle);
	};

	const openNodeSearch = (query?: string) => {
		runEditorAction((app) => app.openSearchPalette(query));
	};

	const createNodeFromPalette = (typeId: string) => {
		runEditorAction((app) => {
			app.createNodeFromTemplate(typeId);
		});
	};

	const loadShaderFromLibrary = (shader: ShaderLibraryItem) => {
		if (!editorHandle) {
			return;
		}
		if (!shader.graph) {
			pushUiMessage({
				tone: "warning",
				message: "This shader entry does not include saved graph data.",
			});
			return;
		}
		const loaded = editorHandle.loadGraphFromText(shader.graph);
		if (!loaded) {
			pushUiMessage({
				tone: "error",
				message: "Failed to load that shader graph.",
			});
		}
	};

	const handleNodeSearchInput = (value: string) => {
		setNodeSearchQuery(value);
		openNodeSearch(value);
	};

	const handleNodeSearchBlur = () => {
		setNodeSearchQuery("");
	};

	const compileShader = () => {
		editorHandle?.compileShader();
	};

	const exportGlsl = () => {
		editorHandle?.exportGlsl();
	};

	const buildGlslPayload = (result: ShaderCompileResult) =>
		[
			"// Vertex Shader",
			result.vertexSource.trimEnd(),
			"",
			"// Fragment Shader",
			result.fragmentSource.trimEnd(),
			"",
		].join("\n");

	const formatCompileTime = (value: Date | null) => {
		if (!value) {
			return null;
		}
		const pad = (part: number) => part.toString().padStart(2, "0");
		return `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
	};

	const buildOptimizationSuggestions = (result: ShaderCompileResult | null) => {
		if (!result?.complexity) {
			return [];
		}
		const complexity: ShaderComplexity = result.complexity;
		const suggestions: string[] = [];
		if (complexity.textureSamples > 4) {
			suggestions.push(
				"Reduce texture samples by reusing UVs or combining samples.",
			);
		}
		if (complexity.fragmentInstructions > 140) {
			suggestions.push(
				"Collapse chained math nodes or bake constants to reduce fragment cost.",
			);
		}
		if (complexity.vertexInstructions > 80) {
			suggestions.push(
				"Move heavy math from vertex stage into shared constants where possible.",
			);
		}
		if (complexity.mathOps > 50) {
			suggestions.push(
				"Consolidate repeated math operations into shared nodes.",
			);
		}
		if (suggestions.length === 0) {
			suggestions.push("No obvious optimizations detected for this graph.");
		}
		return suggestions;
	};

	const copyTextToClipboard = async (text: string) => {
		if (navigator.clipboard?.writeText) {
			try {
				await navigator.clipboard.writeText(text);
				return true;
			} catch {
				// Fallback below.
			}
		}

		const textarea = document.createElement("textarea");
		textarea.value = text;
		textarea.setAttribute("readonly", "true");
		textarea.style.position = "fixed";
		textarea.style.top = "0";
		textarea.style.left = "0";
		textarea.style.opacity = "0";
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();
		const success = document.execCommand("copy");
		textarea.remove();
		return success;
	};

	const copyGlsl = async () => {
		const result = latestShaderResult();
		if (!result || !result.hasFragmentOutput) {
			pushUiMessage({
				tone: "error",
				message: "Add a Fragment Output node before copying GLSL.",
			});
			return;
		}

		const exportErrors = result.messages
			.filter((message) => message.kind === "error")
			.map((message) => message.message);
		const exportWarnings = result.messages
			.filter((message) => message.kind === "warning")
			.map((message) => message.message);

		if (exportErrors.length > 0) {
			pushUiMessage({
				tone: "error",
				message: `GLSL copy failed:\n${exportErrors.map((error) => `- ${error}`).join("\n")}`,
			});
			return;
		}

		const payload = buildGlslPayload(result);
		const copied = await copyTextToClipboard(payload);
		if (!copied) {
			pushUiMessage({
				tone: "error",
				message: "Unable to copy GLSL to clipboard.",
			});
			return;
		}

		if (exportWarnings.length > 0) {
			pushUiMessage({
				tone: "warning",
				message: `GLSL copied with warnings:\n${exportWarnings.map((error) => `- ${error}`).join("\n")}`,
			});
		}

		pushUiMessage({ tone: "info", message: "Copied GLSL to clipboard." });
	};

	const copyGraphJson = async () => {
		if (!editorHandle) {
			return;
		}

		const payload = editorHandle.getGraphJson();
		if (!payload.trim()) {
			pushUiMessage({
				tone: "error",
				message: "Graph JSON is empty. Try saving again.",
			});
			return;
		}

		const copied = await copyTextToClipboard(payload);
		if (!copied) {
			pushUiMessage({
				tone: "error",
				message: "Unable to copy graph JSON to clipboard.",
			});
			return;
		}

		pushUiMessage({ tone: "info", message: "Copied graph JSON to clipboard." });
	};

	const copySelectionJson = async () => {
		if (!editorHandle) {
			return;
		}
		const payload = editorHandle.getSelectionClipboardJson();
		if (!payload) {
			pushUiMessage({
				tone: "warning",
				message: "Select at least one node to copy selection JSON.",
			});
			return;
		}
		const copied = await copyTextToClipboard(payload);
		if (!copied) {
			pushUiMessage({
				tone: "error",
				message: "Unable to copy selection JSON to clipboard.",
			});
			return;
		}
		pushUiMessage({
			tone: "info",
			message: "Copied selection JSON to clipboard.",
		});
	};

	const pasteGraphFromClipboard = async () => {
		if (!editorHandle) {
			return;
		}

		if (!navigator.clipboard?.readText) {
			pushUiMessage({
				tone: "error",
				message: "Clipboard read is not supported in this browser.",
			});
			return;
		}

		try {
			const text = await navigator.clipboard.readText();
			if (!text.trim()) {
				pushUiMessage({
					tone: "warning",
					message: "Clipboard is empty.",
				});
				return;
			}
			const loaded = editorHandle.loadGraphFromText(text);
			if (loaded) {
				pushUiMessage({
					tone: "info",
					message: "Loaded graph from clipboard.",
				});
			}
		} catch {
			pushUiMessage({
				tone: "error",
				message: "Unable to read graph JSON from clipboard.",
			});
		}
	};

	const pasteSelectionFromClipboard = async () => {
		if (!editorHandle) {
			return;
		}
		if (!navigator.clipboard?.readText) {
			pushUiMessage({
				tone: "error",
				message: "Clipboard read is not supported in this browser.",
			});
			return;
		}
		try {
			const text = await navigator.clipboard.readText();
			if (!text.trim()) {
				pushUiMessage({
					tone: "warning",
					message: "Clipboard is empty.",
				});
				return;
			}
			const pasted = editorHandle.pasteSelectionFromText(text);
			if (pasted) {
				pushUiMessage({
					tone: "info",
					message: "Pasted selection from clipboard.",
				});
			} else {
				pushUiMessage({
					tone: "warning",
					message: "Clipboard selection JSON is invalid.",
				});
			}
		} catch {
			pushUiMessage({
				tone: "error",
				message: "Unable to read selection JSON from clipboard.",
			});
		}
	};

	const insertPreset = (presetId: string) => {
		if (!editorHandle) {
			return;
		}
		const preset = presetById().get(presetId);
		if (!preset) {
			return;
		}
		const pasted = editorHandle.pasteSelectionFromText(preset.payload);
		if (!pasted) {
			pushUiMessage({
				tone: "error",
				message: "Unable to insert preset selection.",
			});
			return;
		}
		pushUiMessage({
			tone: "info",
			message: `Inserted preset "${preset.name}".`,
		});
	};

	const downloadTextFile = (payload: string, filename: string) => {
		const blob = new Blob([payload], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	};

	const handleExportDownload = (payload: string, filename: string) => {
		if (!payload.trim()) {
			pushUiMessage({
				tone: "error",
				message: "Export payload is empty. Check shader output first.",
			});
			return;
		}
		downloadTextFile(payload, filename);
		pushUiMessage({
			tone: "info",
			message: `Downloaded ${filename}.`,
		});
	};

	const canCopyGlsl = () => {
		const result = latestShaderResult();
		return Boolean(
			result?.hasFragmentOutput && previewStatus().tone !== "error",
		);
	};

	const actionMenus = createMemo<ActionMenuDefinition[]>(() => [
		{
			id: "graph",
			label: "Graph",
			items: [
				{
					id: "save-graph",
					label: "Save",
					action: () => runEditorAction((app) => app.saveGraph()),
				},
				{
					id: "load-graph",
					label: "Load",
					action: () => runEditorAction((app) => app.loadGraph()),
				},
				{
					id: "paste-graph",
					label: "Paste Graph JSON",
					action: () => {
						void pasteGraphFromClipboard();
					},
					disabled: !navigator.clipboard?.readText,
				},
				{
					id: "copy-graph",
					label: "Copy Graph JSON",
					action: () => {
						void copyGraphJson();
					},
				},
				{
					id: "export-glsl",
					label: "Export GLSL",
					action: exportGlsl,
					disabled: previewStatus().tone === "error",
				},
				{
					id: "copy-glsl",
					label: "Copy GLSL",
					action: () => {
						void copyGlsl();
					},
					disabled: !canCopyGlsl(),
				},
			],
		},
		{
			id: "actions",
			label: "Actions",
			items: [
				{
					id: "undo",
					label: "Undo",
					action: () => runEditorAction((app) => app.undo()),
				},
				{
					id: "redo",
					label: "Redo",
					action: () => runEditorAction((app) => app.redo()),
				},
				{
					id: "copy",
					label: "Copy",
					action: () => runEditorAction((app) => app.copySelected()),
				},
				{
					id: "copy-selection-json",
					label: "Copy Selection JSON",
					action: () => {
						void copySelectionJson();
					},
					disabled: (() => {
						const selection = selectionState();
						if (selection.kind === "node") {
							return false;
						}
						if (selection.kind === "multi") {
							return selection.nodes.length === 0;
						}
						return true;
					})(),
				},
				{
					id: "cut",
					label: "Cut",
					action: () => runEditorAction((app) => app.cutSelected()),
				},
				{
					id: "paste",
					label: "Paste",
					action: () => runEditorAction((app) => app.paste()),
				},
				{
					id: "paste-selection-json",
					label: "Paste Selection JSON",
					action: () => {
						void pasteSelectionFromClipboard();
					},
					disabled: !navigator.clipboard?.readText,
				},
				{
					id: "delete",
					label: "Delete",
					action: () => runEditorAction((app) => app.deleteSelected()),
				},
				{
					id: "create-node-group",
					label: "Create Node Group",
					action: () => createNodeGroupFromSelection(),
					disabled: (() => {
						const selection = selectionState();
						return !(selection.kind === "multi" && selection.nodes.length > 1);
					})(),
				},
				{
					id: "explode-group",
					label: "Explode Group",
					action: () => explodeGroupSelection(),
					disabled: selectionState().kind !== "group",
				},
				{
					id: "replace-node",
					label: "Replace Node",
					action: () => openReplaceNodePalette(),
					disabled: selectionState().kind !== "node",
				},
				{
					id: "reset-view",
					label: "Reset View",
					action: () => runEditorAction((app) => app.resetView()),
				},
				{
					id: "frame-selection",
					label: "Frame Selection",
					action: () => runEditorAction((app) => app.frameSelection()),
					disabled: selectionState().kind === "none",
				},
				{
					id: "shortcuts",
					label: "Shortcuts",
					action: toggleShortcuts,
				},
			],
		},
	]);

	const runActionMenuItem = (action: () => void) => {
		action();
		closeActionMenu();
	};

	const updateSelectionTitle = (value: string) => {
		setSelectionTitle(value);
	};

	const commitSelectionTitle = () => {
		const selection = selectionState();
		if (!editorHandle || selection.kind !== "node") {
			return;
		}
		const nextTitle = selectionTitle().trim();
		if (!nextTitle) {
			setSelectionTitle(selection.node.title);
			return;
		}
		if (nextTitle !== selection.node.title) {
			editorHandle.updateNodeTitle(selection.node.id, nextTitle);
		}
	};

	const updateGroupTitle = (value: string) => {
		setGroupTitle(value);
	};

	const commitGroupTitle = () => {
		const selection = selectionState();
		if (!editorHandle || selection.kind !== "group") {
			return;
		}
		const nextTitle = groupTitle().trim();
		if (!nextTitle) {
			setGroupTitle(selection.group.title);
			return;
		}
		if (nextTitle !== selection.group.title) {
			editorHandle.updateGroupTitle(selection.group.id, nextTitle);
		}
	};

	const updateGroupColor = (value: string) => {
		setGroupColor(value);
		const selection = selectionState();
		if (!editorHandle || selection.kind !== "group") {
			return;
		}
		const parsed = parseHexColorNumber(value);
		if (parsed === null) {
			return;
		}
		editorHandle.updateGroupColor(selection.group.id, parsed);
	};

	const resetGroupColor = () => {
		const selection = selectionState();
		if (!editorHandle || selection.kind !== "group") {
			return;
		}
		editorHandle.updateGroupColor(selection.group.id, null);
		setGroupColor(formatPortColor(visualSettings().groups.fillColor));
	};

	const deleteSelection = () => {
		editorHandle?.deleteSelected();
	};

	const updatePreviewOptions = (next: Partial<PreviewRenderOptions>) => {
		setPreviewOptions((current) => ({ ...current, ...next }));
	};

	const updatePreviewResolution = (value: number) => {
		setPreviewResolution(value);
	};

	const updatePreviewFocus = (value: PreviewFocus) => {
		setPreviewFocus(value);
	};

	const resolvePreviewTarget = (
		selection: EditorSelectionState,
	): ShaderPreviewTarget | null => {
		if (selection.kind !== "node") {
			return null;
		}
		const outputPorts = selection.node.ports.filter(
			(port) => port.direction === "output",
		);
		if (outputPorts.length === 0) {
			return null;
		}
		return { nodeId: selection.node.id, portId: outputPorts[0].id };
	};

	const exportPreviewPng = () => {
		if (!previewRef) {
			pushUiMessage({
				tone: "error",
				message: "Preview is not ready to export.",
			});
			return;
		}
		try {
			const url = previewRef.toDataURL("image/png");
			const link = document.createElement("a");
			link.href = url;
			link.download = "shader-preview.png";
			document.body.appendChild(link);
			link.click();
			link.remove();
			pushUiMessage({
				tone: "info",
				message: "Preview PNG exported.",
			});
		} catch {
			pushUiMessage({
				tone: "error",
				message: "Unable to export preview PNG.",
			});
		}
	};

	const selectionColorTag = createMemo(() => {
		const selection = selectionState();
		if (selection.kind !== "node") {
			return null;
		}
		return selection.node.state?.ui?.colorTag ?? null;
	});

	const updateSelectionColorTag = (value: string | null) => {
		const selection = selectionState();
		if (!editorHandle || selection.kind !== "node") {
			return;
		}
		const currentState: NodeState = selection.node.state ?? {
			version: 1,
			params: {},
		};
		const nextUi: NonNullable<NodeState["ui"]> = {
			...(currentState.ui ?? {}),
		};
		if (value) {
			nextUi.colorTag = value;
		} else {
			delete nextUi.colorTag;
		}
		const ui = Object.keys(nextUi).length > 0 ? nextUi : undefined;
		editorHandle.updateNodeState(selection.node.id, {
			version: currentState.version,
			params: { ...currentState.params },
			ui,
		});
	};

	const toggleSelectionBypass = () => {
		const selection = selectionState();
		if (!editorHandle || selection.kind !== "node") {
			return;
		}
		const currentState: NodeState = selection.node.state ?? {
			version: 1,
			params: {},
		};
		const nextUi: NonNullable<NodeState["ui"]> = {
			...(currentState.ui ?? {}),
		};
		if (nextUi.isBypassed) {
			delete nextUi.isBypassed;
		} else {
			nextUi.isBypassed = true;
		}
		const ui = Object.keys(nextUi).length > 0 ? nextUi : undefined;
		editorHandle.updateNodeState(selection.node.id, {
			version: currentState.version,
			params: { ...currentState.params },
			ui,
		});
	};

	const copySelection = () => {
		editorHandle?.copySelected();
	};

	const createGroupFromSelection = () => {
		editorHandle?.groupSelectedNodes();
	};

	const convertSelectionToGroup = () => {
		editorHandle?.convertSelectionToGroup();
	};

	const createNodeGroupFromSelection = () => {
		editorHandle?.createCollapsedGroupFromSelection();
	};

	const explodeGroupSelection = () => {
		editorHandle?.explodeGroupSelection();
	};

	const openReplaceNodePalette = () => {
		editorHandle?.openReplacePalette();
	};

	const savePresetFromSelection = () => {
		openPresetModal();
	};

	const selectionBypassed = createMemo(() => {
		const selection = selectionState();
		if (selection.kind !== "node") {
			return false;
		}
		return selection.node.state?.ui?.isBypassed ?? false;
	});

	const canCopySelection = createMemo(() => {
		const selection = selectionState();
		if (selection.kind === "node") {
			return true;
		}
		if (selection.kind === "multi") {
			return selection.nodes.length > 0;
		}
		return false;
	});

	const canCreateGroup = createMemo(() => {
		const selection = selectionState();
		return selection.kind === "multi" && selection.nodes.length > 1;
	});

	const canSavePreset = createMemo(() => {
		const selection = selectionState();
		if (selection.kind === "node") {
			return true;
		}
		if (selection.kind === "multi") {
			return selection.nodes.length > 0;
		}
		return false;
	});

	createEffect(() => {
		const state = contextMenu();
		if (!state || !stageRef || !menuRef) {
			return;
		}

		const stageRect = stageRef.getBoundingClientRect();
		const menuRect = menuRef.getBoundingClientRect();
		const nextX = Math.min(
			Math.max(0, menuPosition().x),
			Math.max(0, stageRect.width - menuRect.width),
		);
		const nextY = Math.min(
			Math.max(0, menuPosition().y),
			Math.max(0, stageRect.height - menuRect.height),
		);

		if (nextX !== menuPosition().x || nextY !== menuPosition().y) {
			setMenuPosition({ x: nextX, y: nextY });
		}
	});

	createEffect(() => {
		const state = nodeRenameState();
		if (!state) {
			setNodeRenameValue("");
			return;
		}
		setNodeRenameValue(state.title);
		queueMicrotask(() => {
			if (renameInputRef) {
				renameInputRef.focus();
				renameInputRef.select();
			}
		});
	});

	createEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		if (!visualSettingsLoaded()) {
			return;
		}
		try {
			window.localStorage.setItem(
				visualSettingsStorageKey,
				JSON.stringify(visualSettings()),
			);
		} catch {
			// Ignore storage failures (private mode or quota issues).
		}
	});

	createEffect(() => {
		const selection = selectionState();
		if (selection.kind !== "node") {
			setSelectionTitle("");
			return;
		}

		setSelectionTitle(selection.node.title);
	});

	createEffect(() => {
		const selection = selectionState();
		const settings = visualSettings();
		if (selection.kind !== "group") {
			setGroupTitle("");
			setGroupColor(formatPortColor(settings.groups.fillColor));
			return;
		}

		setGroupTitle(selection.group.title);
		const resolvedColor = selection.group.color ?? settings.groups.fillColor;
		setGroupColor(formatPortColor(resolvedColor));
	});

	createEffect(() => {
		const settings = visualSettings();
		if (!editorHandle) {
			return;
		}
		editorHandle.updateVisualSettings(settings);
	});

	createEffect(() => {
		if (!editorHandle) {
			return;
		}
		const isDebug = editorMode() === "debug";
		editorHandle.setDebugMode(isDebug);
		if (!isDebug) {
			editorHandle.setDebugVisualizationState(null);
			return;
		}
		const trace = debugTrace();
		const steps = debugSteps();
		const index = debugStepIndex();
		const focusNodeId =
			index >= 0 && index < steps.length
				? (steps[index]?.nodeId ?? null)
				: null;
		const focusConnectionIds =
			trace && focusNodeId !== null
				? trace.usedConnections.filter((connectionId) => {
						const parsed = parseConnectionId(connectionId);
						return (
							parsed !== null &&
							(parsed.fromNodeId === focusNodeId ||
								parsed.toNodeId === focusNodeId)
						);
					})
				: undefined;
		if (!trace) {
			editorHandle.setDebugVisualizationState({
				enabled: true,
				dimInactive: false,
				activeNodes: [],
				activeConnections: [],
				focusNodeId: null,
			});
			return;
		}
		editorHandle.setDebugVisualizationState({
			enabled: true,
			dimInactive: true,
			activeNodes: trace.usedNodes,
			activeConnections: trace.usedConnections,
			focusNodeId,
			focusConnectionIds,
		});
	});

	createEffect(() => {
		if (!editorHandle) {
			return;
		}
		editorHandle.setConnectionFlowActive(
			editorMode() === "preview" || compileStatus() === "compiling",
		);
	});

	createEffect(() => {
		if (!previewHandle) {
			return;
		}
		previewHandle.setResolution(previewResolution());
	});

	createEffect(() => {
		const focus = previewFocus();
		const selection = selectionState();
		const options = previewOptions();
		const latest = latestShaderResult();
		if (!previewHandle) {
			return;
		}

		schedulePreviewUpdate({ focus, selection, options, latest });
	});

	onCleanup(() => {
		if (previewUpdateTimer !== null) {
			window.clearTimeout(previewUpdateTimer);
		}
	});

	onMount(() => {
		const handleActionMenuPointerDown = (event: PointerEvent) => {
			if (!openActionMenu()) {
				return;
			}
			const target = event.target as Node | null;
			if (!actionMenuRef || !target) {
				return;
			}
			if (!actionMenuRef.contains(target)) {
				closeActionMenu();
			}
		};

		const handleActionMenuKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && openActionMenu()) {
				closeActionMenu();
			}
		};

		window.addEventListener("pointerdown", handleActionMenuPointerDown);
		window.addEventListener("keydown", handleActionMenuKeyDown);
		onCleanup(() => {
			window.removeEventListener("pointerdown", handleActionMenuPointerDown);
			window.removeEventListener("keydown", handleActionMenuKeyDown);
		});
	});

	onMount(() => {
		const storedVisualSettings = readStoredVisualSettings();
		if (storedVisualSettings) {
			setVisualSettings(storedVisualSettings);
		}
		setVisualSettingsLoaded(true);
	});

	onMount(() => {
		setStoredPresets(loadStoredPresets());
	});

	onMount(() => {
		const handleModeShortcuts = (event: KeyboardEvent) => {
			if (event.repeat) {
				return;
			}
			const target = event.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			) {
				return;
			}
			const key = event.key.toLowerCase();
			const isMeta = event.ctrlKey || event.metaKey;

			if (isMeta && key === "enter") {
				event.preventDefault();
				compileShader();
				return;
			}

			if (event.altKey && key === "1") {
				event.preventDefault();
				updateEditorMode("edit");
				return;
			}

			if (event.altKey && key === "p") {
				event.preventDefault();
				updateEditorMode(editorMode() === "preview" ? "edit" : "preview");
				return;
			}

			if (event.altKey && key === "2") {
				event.preventDefault();
				updateEditorMode("preview");
				return;
			}

			if (event.altKey && key === "3") {
				event.preventDefault();
				updateEditorMode("debug");
			}
		};

		window.addEventListener("keydown", handleModeShortcuts);
		onCleanup(() => {
			window.removeEventListener("keydown", handleModeShortcuts);
		});
	});

	onMount(() => {
		const handleShortcutOverlayKeyDown = (event: KeyboardEvent) => {
			if (event.repeat) {
				return;
			}
			const target = event.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable)
			) {
				return;
			}
			if (event.key === "?") {
				event.preventDefault();
				toggleShortcuts();
				return;
			}
			if (event.key === "Escape" && showShortcuts()) {
				event.preventDefault();
				setShowShortcuts(false);
				return;
			}
			if (event.key === "Escape" && showSettings()) {
				event.preventDefault();
				closeSettings();
				return;
			}
			if (event.key === "Escape" && showExportModal()) {
				event.preventDefault();
				closeExportModal();
			}
		};

		window.addEventListener("keydown", handleShortcutOverlayKeyDown);
		onCleanup(() => {
			window.removeEventListener("keydown", handleShortcutOverlayKeyDown);
		});
	});

	onMount(async () => {
		if (!canvasRef || !previewRef) {
			return;
		}

		const preview = createShaderPreview(
			previewRef,
			setPreviewStatus,
			setPreviewSample,
			setPreviewFps,
		);
		previewHandle = preview;
		previewHandle.setResolution(previewResolution());
		const app = await initCanvas(canvasRef, {
			onShaderChange: (result) => {
				setLatestShaderResult(result);
				setLastCompileAt(new Date());
				preview.updateShader(result, previewOptions());
			},
			onCompileStatus: (status) => {
				setCompileStatus(status);
			},
			onExportRequest: (result) => {
				setExportResult(result);
				setShowExportModal(true);
			},
			onContextMenuChange: handleContextMenuChange,
			onUiMessage: (message) => {
				pushUiMessage(message);
			},
			onNodeRenameChange: (state) => {
				setNodeRenameState(state);
			},
			onSocketEditorChange: (state: SocketEditorState | null) => {
				setSocketEditorState(state);
				setSocketEditorValue(state?.value ?? null);
			},
			onSelectionChange: (state) => {
				setSelectionState(state);
			},
			onSelectionBoundsChange: (bounds) => {
				setSelectionBounds(bounds);
			},
			onHoverChange: (state) => {
				setHoverState(state);
			},
			debugOverlay: visualSettings().debugOverlay,
			visualSettings: visualSettings(),
		});
		editorHandle = app;
		app.setDebugMode(editorMode() === "debug");
		if (editorMode() === "debug") {
			app.compileShader();
		}

		onCleanup(() => {
			preview.destroy();
			app.destroy();
			editorHandle = null;
			previewHandle = null;
		});
	});

	onCleanup(() => {
		uiMessageTimeoutMap.forEach((timeout) => {
			window.clearTimeout(timeout);
		});
		uiMessageTimeoutMap.clear();
		setUiMessages([]);
	});

	const status = previewStatus();
	const compileTimestamp = createMemo(() => formatCompileTime(lastCompileAt()));
	const optimizationSuggestions = createMemo(() =>
		buildOptimizationSuggestions(latestShaderResult()),
	);
	const settingsSelectClass =
		"w-full rounded border border-[#2a3342] bg-[#0f131b] px-2 py-1.5 text-[12px] text-[#f4f5f7] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]";
	const settingsRangeClass = "w-full accent-[#5fa8ff]";

	const formatNodeStatus = (node: SelectedNode) => {
		const definition = node.typeId ? getNodeDefinition(node.typeId) : null;
		const category = definition?.category ?? "Node";
		const label = definition?.label ?? "Node";
		const parts = [`Node ${node.id}`, category];
		if (label !== category) {
			parts.push(label);
		}
		return parts.join(" | ");
	};

	const formatConnectionStatus = (connection: SelectedConnection) =>
		`Connection ${connection.from.nodeId}:${connection.from.portId} -> ${connection.to.nodeId}:${connection.to.portId} | ${connection.type}`;

	const parseConnectionId = (id: string) => {
		const [fromPart, toPart] = id.split("->");
		if (!fromPart || !toPart) {
			return null;
		}
		const fromNodeId = Number.parseInt(fromPart.split(":")[0] ?? "", 10);
		const toNodeId = Number.parseInt(toPart.split(":")[0] ?? "", 10);
		if (!Number.isFinite(fromNodeId) || !Number.isFinite(toNodeId)) {
			return null;
		}
		return { fromNodeId, toNodeId };
	};

	const statusBarText = createMemo(() => {
		const hover = hoverState();
		if (hover.kind === "socket") {
			return `Socket ${hover.socket.portName} | ${hover.socket.portType}`;
		}
		if (hover.kind === "node") {
			return formatNodeStatus(hover.node);
		}
		if (hover.kind === "connection") {
			return formatConnectionStatus(hover.connection);
		}
		const selection = selectionState();
		if (selection.kind === "node") {
			return formatNodeStatus(selection.node);
		}
		if (selection.kind === "connection") {
			return formatConnectionStatus(selection.connection);
		}
		return null;
	});
	const socketHoverState = createMemo(() => {
		const hover = hoverState();
		return hover.kind === "socket" ? hover.socket : null;
	});
	const connectionHoverState = createMemo(() => {
		const hover = hoverState();
		return hover.kind === "connection" ? hover : null;
	});
	const connectionHoverStage = createMemo(() => {
		if (editorMode() !== "debug") {
			return null;
		}
		return activeDebugStep()?.stage ?? "fragment";
	});
	const connectionHoverExpression = createMemo(() => {
		if (editorMode() !== "debug") {
			return null;
		}
		const hover = connectionHoverState();
		const trace = debugTrace();
		if (!hover || !trace) {
			return null;
		}
		const stage = activeDebugStep()?.stage ?? "fragment";
		const connectionKey = `${stage}:${hover.connection.id}`;
		const fromKey = `${stage}:${hover.connection.from.nodeId}:${hover.connection.from.portId}`;
		return (
			trace.connectionExpressions[connectionKey] ??
			trace.portExpressions[fromKey] ??
			null
		);
	});

	return (
		<div class="relative h-full">
			<div
				class="relative h-full text-[#f4f5f7]"
				style={{
					"background-color": formatPortColor(visualSettings().backgroundColor),
				}}
			>
				<div class="relative h-full min-w-0" ref={stageRef}>
					<canvas ref={canvasRef} id="editor-canvas" class="h-full w-full" />
					<UiMessageStack
						items={uiMessages()}
						getToneClass={getUiMessageToneClass}
						getToneLabel={getUiMessageToneLabel}
						onDismiss={removeUiMessage}
					/>
					<ContextMenuOverlay
						state={contextMenu()}
						position={menuPosition()}
						onClose={closeContextMenu}
						onItem={handleContextMenuItem}
						setMenuRef={setMenuRef}
					/>
					<NodeRenameOverlay
						state={nodeRenameState()}
						value={nodeRenameValue()}
						onChange={setNodeRenameValue}
						onApply={applyNodeRename}
						onKeyDown={handleNodeRenameKeyDown}
						setInputRef={setRenameInputRef}
					/>
					<SocketEditorOverlay
						state={socketEditorState()}
						value={socketEditorValue()}
						onChange={updateSocketEditorValue}
						onClose={closeSocketEditor}
					/>
					<SocketTooltip state={socketHoverState()} />
					<ConnectionTooltip
						state={editorMode() === "debug" ? connectionHoverState() : null}
						expression={connectionHoverExpression()}
						stage={connectionHoverStage()}
					/>
					<FloatingSelectionToolbar
						selection={selectionState()}
						bounds={selectionBounds()}
						stageRef={stageRef}
						isBypassed={selectionBypassed()}
						canCopy={canCopySelection()}
						canCreateGroup={canCreateGroup()}
						canChangeColor={selectionState().kind === "node"}
						canSavePreset={canSavePreset()}
						onCopy={copySelection}
						onCreateGroup={createGroupFromSelection}
						onConvertToGroup={convertSelectionToGroup}
						onDelete={deleteSelection}
						onSavePreset={savePresetFromSelection}
						onReplaceNode={openReplaceNodePalette}
						onToggleBypass={toggleSelectionBypass}
						onChangeColorTag={updateSelectionColorTag}
					/>
					<LeftSidebar
						onCreateNode={createNodeFromPalette}
						onLoadShader={loadShaderFromLibrary}
						presets={presets()}
						onInsertPreset={insertPreset}
						onDeletePreset={deletePreset}
					/>
					<SelectionPanel
						selection={selectionState()}
						nodeTitle={selectionTitle()}
						onNodeTitleChange={updateSelectionTitle}
						onNodeTitleCommit={commitSelectionTitle}
						onDeleteSelection={deleteSelection}
						previewStatus={status}
						previewSample={previewSample()}
						previewFps={previewFps()}
						showFps={editorMode() === "debug" && status.tone !== "error"}
						previewResolution={previewResolution()}
						onPreviewResolutionChange={updatePreviewResolution}
						previewFocus={previewFocus()}
						onPreviewFocusChange={updatePreviewFocus}
						previewOptions={previewOptions()}
						onPreviewOptionsChange={updatePreviewOptions}
						setPreviewRef={setPreviewRef}
						onPreviewExport={exportPreviewPng}
						textureName={textureName()}
						connectionCount={latestShaderResult()?.connectionCount ?? null}
						shaderComplexity={latestShaderResult()?.complexity ?? null}
						optimizationSuggestions={optimizationSuggestions()}
						nodeColorTag={selectionColorTag()}
						onNodeColorTagChange={updateSelectionColorTag}
						groupTitle={groupTitle()}
						onGroupTitleChange={updateGroupTitle}
						onGroupTitleCommit={commitGroupTitle}
						groupColor={groupColor()}
						groupHasCustomColor={groupHasCustomColor()}
						onGroupColorChange={updateGroupColor}
						onGroupColorReset={resetGroupColor}
						debugMode={editorMode() === "debug"}
						debugTrace={debugTrace()}
						debugStepIndex={debugStepIndex()}
						debugStatus={debugStatus()}
						debugBreakpoints={debugBreakpoints()}
						onDebugStepInto={stepIntoDebug}
						onDebugStepOver={stepOverDebug}
						onDebugContinue={continueDebug}
						onDebugReset={resetDebugSession}
						onToggleBreakpoint={toggleDebugBreakpoint}
					/>
					<StatusBar text={statusBarText()} />
				</div>
			</div>
			<ActionBar
				actionMenus={actionMenus()}
				openActionMenu={openActionMenu()}
				onOpenSearch={openNodeSearch}
				onOpenSettings={() => setShowSettings(true)}
				onToggleActionMenu={toggleActionMenu}
				onRunMenuItem={runActionMenuItem}
				setActionMenuRef={setActionMenuRef}
				searchValue={nodeSearchQuery()}
				onSearchChange={handleNodeSearchInput}
				onSearchBlur={handleNodeSearchBlur}
				onCompileShader={compileShader}
				onExportShader={exportGlsl}
				exportDisabled={previewStatus().tone === "error"}
				activeMode={editorMode()}
				onModeChange={updateEditorMode}
				compileStatus={compileStatus()}
				compileMs={latestShaderResult()?.compileMs ?? null}
				lastCompileAt={compileTimestamp()}
			/>
			<SettingsModal
				open={showSettings()}
				visualSettings={visualSettings()}
				settingsSelectClass={settingsSelectClass}
				settingsRangeClass={settingsRangeClass}
				textureName={textureName()}
				setTextureInputRef={setTextureInputRef}
				formatPortColor={formatPortColor}
				parseHexColorNumber={parseHexColorNumber}
				parseNumberInput={parseNumberInput}
				clamp01={clamp01}
				clampNumber={clampNumber}
				onClose={closeSettings}
				onResetVisualSettings={resetVisualSettings}
				onUpdateVisualSettings={updateVisualSettings}
				onTextureChange={handleTextureChange}
				onClearTexture={clearTexture}
			/>
			<PresetModal
				open={showPresetModal()}
				name={presetName()}
				description={presetDescription()}
				onNameChange={setPresetName}
				onDescriptionChange={setPresetDescription}
				onSave={savePreset}
				onClose={closePresetModal}
			/>
			<ShortcutsModal
				open={showShortcuts()}
				groups={shortcutGroups}
				onClose={() => setShowShortcuts(false)}
			/>
			<ExportModal
				open={showExportModal()}
				result={exportResult()}
				onClose={closeExportModal}
				onDownload={handleExportDownload}
			/>
		</div>
	);
}
