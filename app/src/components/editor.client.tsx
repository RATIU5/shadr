import {
	type ContextMenuItem,
	type ContextMenuState,
	defaultVisualSettings,
	type EditorApp,
	type EditorHoverState,
	type EditorSelectionState,
	type EditorVisualSettings,
	getDefaultNodeState,
	getNodeDefinition,
	initCanvas,
	type NodeParamValue,
	type NodeRenameState,
	type NodeState,
	type SelectedConnection,
	type SelectedNode,
	type ShaderCompileResult,
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
import { ContextMenuOverlay } from "./editor/context-menu-overlay";
import { ExportModal } from "./editor/export-modal";
import { NodeRenameOverlay } from "./editor/node-rename-overlay";
import { PreviewPanel } from "./editor/preview-panel";
import { SelectionPanel } from "./editor/selection-panel";
import { SettingsModal } from "./editor/settings-modal";
import { ShortcutsModal } from "./editor/shortcuts-modal";
import { StatusBar } from "./editor/status-bar";
import type {
	ActionMenuDefinition,
	ActionMenuId,
	PreviewStatus,
	ShortcutGroup,
	UiMessageItem,
} from "./editor/types";
import { UiMessageStack } from "./editor/ui-message-stack";

type PreviewHandle = {
	updateShader: (result: ShaderCompileResult) => void;
	updateTexture: (file: File | null) => void;
	destroy: () => void;
};

const uiMessageTimeouts: Record<UiMessageTone, number> = {
	info: 4000,
	warning: 6000,
	error: 8000,
};

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

const createShaderPreview = (
	canvas: HTMLCanvasElement,
	setStatus: (status: PreviewStatus) => void,
): PreviewHandle => {
	const gl = canvas.getContext("webgl");
	if (!gl) {
		setStatus({
			tone: "error",
			message: "WebGL is unavailable for shader preview.",
		});
		return {
			updateShader: () => {},
			updateTexture: () => {},
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

	const resizeCanvas = () => {
		const dpr = window.devicePixelRatio || 1;
		const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
		const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
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

		animationId = window.requestAnimationFrame(renderFrame);
	};

	animationId = window.requestAnimationFrame(renderFrame);

	return {
		updateShader: (result) => {
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

			const error = updateProgram(result.vertexSource, result.fragmentSource);
			if (error) {
				setStatus({
					tone: "error",
					message: `Preview compile failed: ${error}`,
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
				const details = [...compileErrors];
				if (nodeCountWarning) {
					details.push(nodeCountWarning);
				} else if (nodeCountInfo) {
					details.push(nodeCountInfo);
				}
				setStatus({
					tone: "error",
					message: "Preview errors:",
					details,
					compileMs,
				});
				return;
			}

			if (compileWarnings.length > 0) {
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
		destroy: () => {
			window.cancelAnimationFrame(animationId);
			resizeObserver.disconnect();
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
	const [previewStatus, setPreviewStatus] = createSignal<PreviewStatus>({
		tone: "info",
		message: "Add a Fragment Output node to preview shaders.",
	});
	const [contextMenu, setContextMenu] = createSignal<ContextMenuState | null>(
		null,
	);
	const [uiMessages, setUiMessages] = createSignal<UiMessageItem[]>([]);
	const [menuPosition, setMenuPosition] = createSignal({ x: 0, y: 0 });
	const [textureName, setTextureName] = createSignal("No texture selected");
	const [latestShaderResult, setLatestShaderResult] =
		createSignal<ShaderCompileResult | null>(null);
	const [nodeRenameState, setNodeRenameState] =
		createSignal<NodeRenameState | null>(null);
	const [nodeRenameValue, setNodeRenameValue] = createSignal("");
	const [selectionState, setSelectionState] =
		createSignal<EditorSelectionState>({
			kind: "none",
		});
	const [hoverState, setHoverState] = createSignal<EditorHoverState>({
		kind: "none",
	});
	const [selectionTitle, setSelectionTitle] = createSignal("");
	const [visualSettings, setVisualSettings] =
		createSignal<EditorVisualSettings>(defaultVisualSettingsState);
	const [showSettings, setShowSettings] = createSignal(false);
	const [showShortcuts, setShowShortcuts] = createSignal(false);
	const [showExportModal, setShowExportModal] = createSignal(false);
	const [exportResult, setExportResult] =
		createSignal<ShaderCompileResult | null>(null);
	const [openActionMenu, setOpenActionMenu] = createSignal<ActionMenuId | null>(
		null,
	);
	const [visualSettingsLoaded, setVisualSettingsLoaded] = createSignal(false);

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

	const updateVisualSettings = (
		update: (current: EditorVisualSettings) => EditorVisualSettings,
	) => {
		setVisualSettings((current) => update(current));
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
			id: "file",
			label: "File",
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
			id: "edit",
			label: "Edit",
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
					id: "delete",
					label: "Delete",
					action: () => runEditorAction((app) => app.deleteSelected()),
				},
			],
		},
		{
			id: "view",
			label: "View",
			items: [
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

	const updateSelectionNodeState = (
		params: Record<string, NodeParamValue>,
		ui?: NodeState["ui"],
	) => {
		const selection = selectionState();
		if (!editorHandle || selection.kind !== "node") {
			return;
		}
		editorHandle.updateNodeState(selection.node.id, {
			version: selection.node.state?.version ?? 1,
			params,
			ui,
		});
	};

	const deleteSelection = () => {
		editorHandle?.deleteSelected();
	};

	const selectionPortDefaults = createMemo<Record<string, string>>(() => {
		const selection = selectionState();
		if (selection.kind !== "node") {
			return {};
		}
		const fallback: Record<string, string> = {};
		selection.node.ports.forEach((port) => {
			fallback[port.id] = port.name;
		});
		if (!selection.node.typeId) {
			return fallback;
		}
		const definition = getNodeDefinition(selection.node.typeId);
		if (!definition) {
			return fallback;
		}
		const defaults = getDefaultNodeState(definition.id) ?? {
			version: 1,
			params: {},
		};
		const normalized: NodeState = {
			version: selection.node.state?.version ?? defaults.version,
			params: { ...defaults.params, ...(selection.node.state?.params ?? {}) },
			ui: { ...defaults.ui, ...(selection.node.state?.ui ?? {}) },
		};
		const ports = definition.buildPorts(normalized);
		if (ports.length === 0) {
			return fallback;
		}
		const next: Record<string, string> = {};
		ports.forEach((port) => {
			next[port.id] = port.name;
		});
		return next;
	});

	const commitSelectionPortName = (portId: string, name: string) => {
		const selection = selectionState();
		if (!editorHandle || selection.kind !== "node") {
			return;
		}
		const currentPort = selection.node.ports.find((port) => port.id === portId);
		if (!currentPort) {
			return;
		}
		const defaults = selectionPortDefaults();
		const fallbackName = defaults[portId] ?? currentPort.name;
		const nextName = name.trim() || fallbackName;
		if (!nextName || nextName === currentPort.name) {
			return;
		}
		editorHandle.updateNodePortName(selection.node.id, portId, nextName);
	};

	const resetSelectionPortName = (portId: string) => {
		const selection = selectionState();
		if (!editorHandle || selection.kind !== "node") {
			return;
		}
		const defaults = selectionPortDefaults();
		const fallbackName = defaults[portId];
		if (!fallbackName) {
			return;
		}
		const currentPort = selection.node.ports.find((port) => port.id === portId);
		if (!currentPort || currentPort.name === fallbackName) {
			return;
		}
		editorHandle.updateNodePortName(selection.node.id, portId, fallbackName);
	};

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
		const settings = visualSettings();
		if (!editorHandle) {
			return;
		}
		editorHandle.updateVisualSettings(settings);
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

		const preview = createShaderPreview(previewRef, setPreviewStatus);
		previewHandle = preview;
		const app = await initCanvas(canvasRef, {
			onShaderChange: (result) => {
				setLatestShaderResult(result);
				preview.updateShader(result);
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
			onSelectionChange: (state) => {
				setSelectionState(state);
			},
			onHoverChange: (state) => {
				setHoverState(state);
			},
			debugOverlay: visualSettings().debugOverlay,
			visualSettings: visualSettings(),
		});
		editorHandle = app;

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
	const settingsSelectClass =
		"w-full rounded-lg border border-[#2a3342] bg-[#0f131b] px-2 py-1.5 text-[12px] text-[#f4f5f7] focus:outline-none focus:border-[#4f8dd9] focus:ring-2 focus:ring-[rgba(79,141,217,0.2)]";
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

	const statusBarText = createMemo(() => {
		const hover = hoverState();
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
					<SelectionPanel
						selection={selectionState()}
						nodeTitle={selectionTitle()}
						onNodeTitleChange={updateSelectionTitle}
						onNodeTitleCommit={commitSelectionTitle}
						onNodeStateUpdate={updateSelectionNodeState}
						onDeleteSelection={deleteSelection}
						portDefaults={selectionPortDefaults()}
						onPortNameCommit={commitSelectionPortName}
						onPortNameReset={resetSelectionPortName}
					/>
					<PreviewPanel
						status={status}
						textureName={textureName()}
						setPreviewRef={setPreviewRef}
					/>
					<StatusBar text={statusBarText()} />
				</div>
			</div>
			<ActionBar
				actionMenus={actionMenus()}
				openActionMenu={openActionMenu()}
				onOpenSearch={() => runEditorAction((app) => app.openSearchPalette())}
				onOpenSettings={() => setShowSettings(true)}
				onToggleActionMenu={toggleActionMenu}
				onRunMenuItem={runActionMenuItem}
				setActionMenuRef={setActionMenuRef}
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
