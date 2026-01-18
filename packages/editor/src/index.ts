import {
	Application,
	Container,
	type FederatedPointerEvent,
	Graphics,
	type Text,
} from "pixi.js";
import { createConnectionSystem } from "./connections";
import { applyPan, applyZoom } from "./controls";
import { createDebugOverlay } from "./debug";
import {
	arePortTypesCompatible,
	createEditorState,
	nodeDimensions,
	portStyles,
	resolveConnectionType,
	zoomLimits,
} from "./editor-state";
import { GRAPH_SCHEMA_VERSION } from "./graph-version";
import { createGridRenderer, getAdaptiveGridSteps } from "./grid";
import { createGroupSystem, maxGroupDepth } from "./groups";
import { createHistoryManager } from "./history";
import {
	getDefaultNodeState,
	getDefinitionSockets,
	getNodeDefinition,
	getNodeDefinitions,
	normalizeNodeState,
} from "./node-definitions";
import { createNodeSystem } from "./nodes";
import { portTypeColors } from "./ports";
import { createSearchPalette, type SearchEntry } from "./search";
import { parseGraph, parseGraphWithReport } from "./serialization";
import { compileGraphToGlsl } from "./shader";
import { defaultPorts, nodeTemplates } from "./templates";
import type {
	Connection,
	ContextMenuItem,
	ContextMenuState,
	DebugVisualizationState,
	EditorApp,
	EditorHoverState,
	EditorSelectionState,
	GroupView,
	InitCanvasOptions,
	NodeParamValue,
	NodeRenameState,
	NodeSocketValue,
	NodeState,
	NodeTemplate,
	NodeView,
	PortRef,
	PortType,
	SelectedConnection,
	SelectedNode,
	SelectionBounds,
	SelectionClipboardPayload,
	SerializableGraph,
	SerializablePort,
	ShaderCompileResult,
	ShaderCompileStatus,
	ShaderPreviewTarget,
	SocketEditorState,
	SocketHoverState,
	UiMessageTone,
} from "./types";
import {
	defaultVisualSettings,
	type EditorVisualSettings,
} from "./visual-settings";

export {
	getMathOperationId,
	getMathOperationLabel,
	isMathTemplateId,
	mathOperationEntries,
} from "./math-ops";
export {
	getDefaultNodeState,
	getDefinitionSockets,
	getInputSelection,
	getInputSelectOptions,
	getNodeDefinition,
	getNodeDefinitions,
} from "./node-definitions";
export { portTypeColors, portTypeLabels, portTypeOrder } from "./ports";
export type {
	ContextMenuItem,
	ContextMenuState,
	DebugVisualizationState,
	EditorApp,
	EditorHoverState,
	EditorSelectionState,
	NodeDefinition,
	NodeParamSpec,
	NodeParamValue,
	NodeRenameState,
	NodeSocket,
	NodeSocketUiSpec,
	NodeSocketValue,
	NodeState,
	PortType,
	SelectedConnection,
	SelectedGroup,
	SelectedNode,
	SelectionBounds,
	SelectionClipboardPayload,
	ShaderCompileOptions,
	ShaderCompileResult,
	ShaderCompileStatus,
	ShaderComplexity,
	ShaderDebugNodeInfo,
	ShaderDebugStep,
	ShaderDebugTrace,
	ShaderPerformanceWarnings,
	ShaderPreviewTarget,
	SocketEditorState,
	SocketHoverState,
	UiMessage,
	UiMessageTone,
} from "./types";
export type { EditorVisualSettings } from "./visual-settings";
export { defaultVisualSettings } from "./visual-settings";

export async function initCanvas(
	canvas: HTMLCanvasElement,
	options: InitCanvasOptions = {},
): Promise<EditorApp> {
	const mergeVisualSettings = (
		base: EditorVisualSettings,
		overrides?: Partial<EditorVisualSettings>,
	): EditorVisualSettings => {
		const resolvedOverrides = overrides ?? {};
		return {
			backgroundColor:
				typeof resolvedOverrides.backgroundColor === "number"
					? resolvedOverrides.backgroundColor
					: base.backgroundColor,
			debugOverlay:
				typeof resolvedOverrides.debugOverlay === "boolean"
					? resolvedOverrides.debugOverlay
					: base.debugOverlay,
			grid: { ...base.grid, ...(resolvedOverrides.grid ?? {}) },
			nodes: { ...base.nodes, ...(resolvedOverrides.nodes ?? {}) },
			groups: { ...base.groups, ...(resolvedOverrides.groups ?? {}) },
			connections: {
				...base.connections,
				...(resolvedOverrides.connections ?? {}),
			},
		};
	};

	const initialDefaults = {
		...defaultVisualSettings,
		debugOverlay:
			typeof options.debugOverlay === "boolean"
				? options.debugOverlay
				: defaultVisualSettings.debugOverlay,
	};

	let visualSettings = mergeVisualSettings(
		initialDefaults,
		options.visualSettings,
	);

	const app = new Application();

	const resizeTo = canvas.parentElement ?? undefined;
	const resolution =
		typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

	const initOptions = {
		canvas,
		resolution,
		autoDensity: true,
		...(resizeTo ? { resizeTo } : {}),
	};

	await app.init(initOptions);

	let currentResolution = resolution;
	const backgroundState = {
		width: 0,
		height: 0,
		color: visualSettings.backgroundColor,
	};

	const updateBackground = () => {
		const screen = app.renderer.screen;
		const width = screen.width;
		const height = screen.height;
		if (
			width !== backgroundState.width ||
			height !== backgroundState.height ||
			visualSettings.backgroundColor !== backgroundState.color
		) {
			backgroundState.width = width;
			backgroundState.height = height;
			backgroundState.color = visualSettings.backgroundColor;
			backgroundLayer.clear();
			backgroundLayer
				.rect(0, 0, width, height)
				.fill({ color: visualSettings.backgroundColor, alpha: 1 });
		}
	};

	const camera = new Container();
	const backgroundLayer = new Graphics();
	const grid = new Graphics();
	const snapLayer = new Graphics();
	const connectionsLayer = new Graphics();
	const connectionLabelLayer = new Container();
	const groupLayer = new Container();
	const nodesLayer = new Container();
	const selectionLayer = new Graphics();

	connectionLabelLayer.eventMode = "none";

	camera.addChild(grid);
	camera.addChild(snapLayer);
	camera.addChild(connectionsLayer);
	camera.addChild(connectionLabelLayer);
	camera.addChild(groupLayer);
	camera.addChild(nodesLayer);
	camera.addChild(selectionLayer);
	app.stage.addChild(backgroundLayer);
	app.stage.addChild(camera);

	const textObjects = new Set<Text>();
	const maxTextResolution = 4;
	const clampTextResolution = (value: number) =>
		Math.min(maxTextResolution, Math.max(1, value));
	const getTextResolution = () => {
		const baseResolution = app.renderer.resolution || 1;
		const zoom = camera.scale.x || 1;
		return clampTextResolution(baseResolution * Math.max(1, zoom));
	};
	let currentTextResolution = getTextResolution();

	const registerText = (text: Text) => {
		textObjects.add(text);
		text.style = { ...text.style, resolution: currentTextResolution };
		return text;
	};

	const syncTextResolution = () => {
		const nextResolution = getTextResolution();
		if (nextResolution === currentTextResolution) {
			return;
		}
		currentTextResolution = nextResolution;
		textObjects.forEach((text) => {
			text.style = { ...text.style, resolution: nextResolution };
		});
	};

	let lastCameraScale = camera.scale.x || 1;
	app.ticker.add(() => {
		const scale = camera.scale.x || 1;
		if (Math.abs(scale - lastCameraScale) < 0.001) {
			return;
		}
		lastCameraScale = scale;
		syncTextResolution();
	});

	const { updateScene } = createGridRenderer({
		app,
		camera,
		grid,
		getSettings: () => visualSettings.grid,
	});

	const {
		interactionState,
		dragState,
		nodeState,
		groupState,
		connectionState,
		historyState,
		contextMenuState,
	} = createEditorState();

	let lastSelectionSerialized = "";
	let suppressSelectionEmit = false;
	let lastSelectionBoundsSerialized = "";
	let emitSelectionBoundsChange: () => void = () => {};
	let lastHoverSerialized = "";
	let hoveredNodeId: number | null = null;
	let hoveredConnectionId: string | null = null;
	let hoveredSocket: { nodeId: number; portId: string } | null = null;
	let suppressNextContextMenu = false;
	let connectionFlowActive = false;
	let connectionFlowPulseUntil = 0;
	const connectionFlowPulseMs = 700;
	const dragGhostAlpha = 0.55;
	let debugMode = false;
	let debugVisualizationState: DebugVisualizationState | null = null;

	const isConnectionFlowActive = () =>
		connectionFlowActive || performance.now() < connectionFlowPulseUntil;

	const pulseConnectionFlow = () => {
		connectionFlowPulseUntil = Math.max(
			connectionFlowPulseUntil,
			performance.now() + connectionFlowPulseMs,
		);
	};

	const getDebugState = () => debugVisualizationState;

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

	const cloneNodeState = (state: NodeState): NodeState => {
		const params: Record<string, NodeState["params"][string]> = {};
		for (const [key, value] of Object.entries(state.params ?? {})) {
			if (Array.isArray(value)) {
				params[key] = [...value];
			} else if (isVectorValue(value)) {
				params[key] = {
					x: value.x,
					y: value.y,
					...(value.z !== undefined ? { z: value.z } : {}),
					...(value.w !== undefined ? { w: value.w } : {}),
				};
			} else if (isColorValue(value)) {
				params[key] = {
					r: value.r,
					g: value.g,
					b: value.b,
					a: value.a,
				};
			} else {
				params[key] = value as NodeState["params"][string];
			}
		}
		const cloned: NodeState = {
			version: state.version,
			params,
		};
		if (state.ui) {
			cloned.ui = { ...state.ui };
		}
		return cloned;
	};

	const cloneSocketValues = (
		socketValues: Record<string, NodeSocketValue>,
	): Record<string, NodeSocketValue> => {
		const cloned: Record<string, NodeSocketValue> = {};
		Object.entries(socketValues).forEach(([key, value]) => {
			if (Array.isArray(value)) {
				cloned[key] = [...value];
			} else if (isVectorValue(value as NodeParamValue)) {
				const vector = value as {
					x: number;
					y: number;
					z?: number;
					w?: number;
				};
				cloned[key] = {
					x: vector.x,
					y: vector.y,
					...(vector.z !== undefined ? { z: vector.z } : {}),
					...(vector.w !== undefined ? { w: vector.w } : {}),
				};
			} else if (isColorValue(value as NodeParamValue)) {
				const color = value as { r: number; g: number; b: number; a: number };
				cloned[key] = {
					r: color.r,
					g: color.g,
					b: color.b,
					a: color.a,
				};
			} else {
				cloned[key] = value;
			}
		});
		return cloned;
	};

	const setNodeAlpha = (nodeId: number, alpha: number) => {
		const node = nodeState.nodes.get(nodeId);
		if (!node) {
			return;
		}
		node.container.alpha = alpha;
	};

	const setNodesAlpha = (nodeIds: number[], alpha: number) => {
		nodeIds.forEach((nodeId) => {
			setNodeAlpha(nodeId, alpha);
		});
	};

	const buildSelectedNode = (node: NodeView): SelectedNode => {
		const connectedInputs = new Set<string>();
		connectionState.connections.forEach((connection) => {
			if (connection.to.nodeId === node.id) {
				connectedInputs.add(connection.to.portId);
			}
		});
		const selectedNode: SelectedNode = {
			id: node.id,
			title: node.title.text,
			ports: node.ports.map((port) => ({
				id: port.id,
				name: port.name,
				type: port.type,
				direction: port.direction,
			})),
		};
		if (node.typeId) {
			selectedNode.typeId = node.typeId;
		}
		if (node.state) {
			selectedNode.state = cloneNodeState(node.state);
		}
		if (node.socketValues) {
			selectedNode.socketValues = cloneSocketValues(node.socketValues);
		}
		if (connectedInputs.size > 0) {
			selectedNode.connectedInputs = Array.from(connectedInputs);
		}
		return selectedNode;
	};

	const buildSelectedConnection = (
		connection: Connection,
	): SelectedConnection => ({
		id: connection.id,
		from: connection.from,
		to: connection.to,
		type: connection.type,
	});

	const buildSelectionState = (): EditorSelectionState => {
		const selectedNodes = Array.from(nodeState.selectedIds).sort(
			(a, b) => a - b,
		);
		const selectedGroups = Array.from(groupState.selectedIds).sort(
			(a, b) => a - b,
		);
		const selectedConnections = Array.from(connectionState.selectedIds).sort();
		const total =
			selectedNodes.length + selectedGroups.length + selectedConnections.length;

		if (total === 0) {
			return { kind: "none" };
		}

		if (
			total > 1 ||
			selectedNodes.length > 1 ||
			selectedGroups.length > 1 ||
			selectedConnections.length > 1
		) {
			return {
				kind: "multi",
				nodes: selectedNodes,
				groups: selectedGroups,
				connections: selectedConnections,
			};
		}

		if (selectedNodes.length === 1) {
			const node = nodeState.nodes.get(selectedNodes[0]);
			if (!node) {
				return { kind: "none" };
			}
			return {
				kind: "node",
				node: buildSelectedNode(node),
			};
		}

		if (selectedGroups.length === 1) {
			const group = groupState.groups.get(selectedGroups[0]);
			if (!group) {
				return { kind: "none" };
			}
			return {
				kind: "group",
				group: {
					id: group.id,
					title: group.label,
					nodeIds: Array.from(group.nodeIds),
					collapsed: group.collapsed,
					color: group.color ?? null,
				},
			};
		}

		if (selectedConnections.length === 1) {
			const connection = connectionState.connections.get(
				selectedConnections[0],
			);
			if (!connection) {
				return { kind: "none" };
			}
			return {
				kind: "connection",
				connection: buildSelectedConnection(connection),
			};
		}

		return { kind: "none" };
	};

	const emitSelectionChange = () => {
		if (suppressSelectionEmit) {
			return;
		}
		const onSelectionChange = options.onSelectionChange;
		if (!onSelectionChange) {
			return;
		}
		const next = buildSelectionState();
		const serialized = JSON.stringify(next);
		if (serialized === lastSelectionSerialized) {
			return;
		}
		lastSelectionSerialized = serialized;
		onSelectionChange(next);
		emitSelectionBoundsChange();
	};

	const buildSocketHoverState = (): SocketHoverState | null => {
		if (!hoveredSocket) {
			return null;
		}
		const portData = getNodePort(hoveredSocket);
		if (!portData) {
			return null;
		}

		const { node, port } = portData;
		const world = getPortWorldPosition(node, port);
		const screen = getScreenFromWorld(world.x, world.y);
		let isConnected = false;
		let connectionType: PortType | undefined;
		let upstream:
			| {
					nodeId: number;
					portId: string;
					portName: string;
					portType: PortType;
					value: NodeSocketValue | null;
			  }
			| undefined;

		if (port.direction === "input") {
			for (const connection of connectionState.connections.values()) {
				if (
					connection.to.nodeId === node.id &&
					connection.to.portId === port.id
				) {
					isConnected = true;
					connectionType = connection.type;
					const sourceNode = nodeState.nodes.get(connection.from.nodeId);
					const sourcePort = sourceNode?.ports.find(
						(candidate) => candidate.id === connection.from.portId,
					);
					if (sourceNode && sourcePort) {
						upstream = {
							nodeId: sourceNode.id,
							portId: sourcePort.id,
							portName: sourcePort.name,
							portType: sourcePort.type,
							value: sourceNode.socketValues?.[sourcePort.id] ?? null,
						};
					}
					break;
				}
			}
		} else {
			for (const connection of connectionState.connections.values()) {
				if (
					connection.from.nodeId === node.id &&
					connection.from.portId === port.id
				) {
					isConnected = true;
					connectionType = connection.type;
					upstream = {
						nodeId: node.id,
						portId: port.id,
						portName: port.name,
						portType: port.type,
						value: node.socketValues?.[port.id] ?? null,
					};
					break;
				}
			}
		}

		return {
			nodeId: node.id,
			portId: port.id,
			portName: port.name,
			direction: port.direction,
			portType: port.type,
			screenX: screen.x,
			screenY: screen.y,
			isConnected,
			...(connectionType ? { connectionType } : {}),
			...(upstream ? { upstream } : {}),
		};
	};

	const buildHoverState = (): EditorHoverState => {
		const socket = buildSocketHoverState();
		if (socket) {
			return { kind: "socket", socket };
		}
		if (hoveredNodeId !== null) {
			const node = nodeState.nodes.get(hoveredNodeId);
			if (node) {
				return { kind: "node", node: buildSelectedNode(node) };
			}
		}

		if (hoveredConnectionId) {
			const connection = connectionState.connections.get(hoveredConnectionId);
			if (connection) {
				const getWorldPositionForRef = (ref: PortRef) => {
					const groupPort = getGroupPortForRef(ref);
					if (groupPort) {
						return getGroupPortWorldPosition(groupPort.group, groupPort.port);
					}
					const data = getNodePort(ref);
					if (!data) {
						return null;
					}
					return getPortWorldPosition(data.node, data.port);
				};
				const fromPos = getWorldPositionForRef(connection.from);
				const toPos = getWorldPositionForRef(connection.to);
				const midPoint =
					fromPos && toPos
						? {
								x: (fromPos.x + toPos.x) / 2,
								y: (fromPos.y + toPos.y) / 2,
							}
						: { x: 0, y: 0 };
				const screen = getScreenFromWorld(midPoint.x, midPoint.y);
				return {
					kind: "connection",
					connection: buildSelectedConnection(connection),
					screenX: screen.x,
					screenY: screen.y,
				};
			}
		}

		return { kind: "none" };
	};

	const emitHoverChange = () => {
		const onHoverChange = options.onHoverChange;
		if (!onHoverChange) {
			return;
		}
		const next = buildHoverState();
		const serialized = JSON.stringify(next);
		if (serialized === lastHoverSerialized) {
			return;
		}
		lastHoverSerialized = serialized;
		onHoverChange(next);
	};

	const debugOverlay = createDebugOverlay({
		app,
		camera,
		nodeState,
		groupState,
		connectionState,
		interactionState,
		dragState,
		registerText,
	});
	debugOverlay.setEnabled(visualSettings.debugOverlay);

	let lastShaderSnapshot = "";
	let pendingShaderTimeout: number | null = null;
	let pendingShaderSnapshot: SerializableGraph | null = null;
	let lastShaderCompile = 0;
	const shaderCompileThrottleMs = 1000 / 30;

	let commitHistory = () => {};
	let renderConnections = () => {};
	let updateNodePorts = (
		_nodeId: number,
		_ports: SerializablePort[],
		_options?: { preserveNames?: boolean },
	) => false;
	let nodeRenameState: NodeRenameState | null = null;
	let socketEditorState: SocketEditorState | null = null;
	let startConnectionDrag: (
		event: FederatedPointerEvent,
		nodeId: number,
		portId: string,
	) => void = () => {};
	let cancelConnectionDrag = () => {};
	let openSocketEditor: (nodeId: number, portId: string) => void = () => {};
	let closeSocketEditor = () => {};
	let startNodeDrag: (event: FederatedPointerEvent, id: number) => void =
		() => {};
	let startGroupDrag: (event: FederatedPointerEvent, id: number) => void =
		() => {};
	let openNodeRename: (nodeId: number) => void = () => {};
	let handleSocketQuickDisconnect: (
		nodeId: number,
		portId: string,
		direction: "input" | "output",
	) => void = () => {};

	const nodeSystem = createNodeSystem({
		nodesLayer,
		connectionsLayer,
		nodeState,
		connectionState,
		nodeDimensions,
		portStyles,
		defaultPorts,
		portTypeColors,
		getNodeStyles: () => visualSettings.nodes,
		registerText,
		onStartNodeDrag: (event, nodeId) => startNodeDrag(event, nodeId),
		onStartConnectionDrag: (event, nodeId, portId) =>
			startConnectionDrag(event, nodeId, portId),
		onCancelConnectionDrag: () => cancelConnectionDrag(),
		onStartSocketEdit: (nodeId, portId) => openSocketEditor(nodeId, portId),
		onRequestNodeRename: (nodeId) => openNodeRename(nodeId),
		onSocketHoverChange: (state) => {
			hoveredSocket = state;
			emitHoverChange();
		},
		onSocketQuickDisconnect: (nodeId, portId, direction) => {
			suppressNextContextMenu = true;
			handleSocketQuickDisconnect(nodeId, portId, direction);
		},
		getActiveSocketEditor: () =>
			socketEditorState
				? {
						nodeId: socketEditorState.nodeId,
						socketId: socketEditorState.socketId,
					}
				: null,
		onSelectionChange: emitSelectionChange,
		onNodeHoverChange: (nodeId) => {
			hoveredNodeId = nodeId;
			emitHoverChange();
		},
		onConnectionsPruned: (count) => {
			emitUiMessage(
				"warning",
				`Port updates removed ${count} incompatible connection(s).`,
			);
			renderAllNodes();
			emitSelectionChange();
		},
		getDebugState,
	});

	const {
		renderFooterLabel,
		renderBodyLabel,
		renderPort,
		updateNodeLayout,
		getPortWorldPosition,
		getNodePort,
		clearSelection,
		updateSelection,
		toggleSelection,
		ensureSelectedForDrag,
		updateNodeTitle,
		createNode,
		clearGraph,
		deleteSelectedNode,
		renderAllNodes,
		updatePerformanceWarnings,
	} = nodeSystem;
	updateNodePorts = nodeSystem.updateNodePorts;

	const updateDebugVisualizationState = (
		state: DebugVisualizationState | null,
	) => {
		debugVisualizationState = state;
		renderAllNodes();
		renderConnections();
	};

	handleSocketQuickDisconnect = (nodeId, portId, direction) => {
		const removals: string[] = [];
		connectionState.connections.forEach((connection, id) => {
			if (direction === "input") {
				if (
					connection.to.nodeId === nodeId &&
					connection.to.portId === portId
				) {
					removals.push(id);
				}
				return;
			}
			if (
				connection.from.nodeId === nodeId &&
				connection.from.portId === portId
			) {
				removals.push(id);
			}
		});
		if (removals.length === 0) {
			return;
		}
		removals.forEach((id) => {
			connectionState.connections.delete(id);
			connectionState.selectedIds.delete(id);
		});
		renderAllNodes();
		emitSelectionChange();
		commitHistory();
	};

	let selectGroup: (groupId: number, append: boolean) => void = () => {};
	let toggleGroupCollapsed: (groupId: number) => void = () => {};

	const groupSystem = createGroupSystem({
		groupLayer,
		nodeState,
		groupState,
		connectionState,
		nodeDimensions,
		portStyles,
		portTypeColors,
		getGroupStyles: () => visualSettings.groups,
		registerText,
		onStartGroupDrag: (event, groupId) => startGroupDrag(event, groupId),
		onStartConnectionDrag: (event, nodeId, portId) =>
			startConnectionDrag(event, nodeId, portId),
		onSelectGroup: (groupId, event) => {
			const clientEvent = event as unknown as PointerEvent;
			if (!clientEvent.shiftKey) {
				clearSelection();
			}
			selectGroup(groupId, clientEvent.shiftKey);
		},
		onToggleGroupCollapsed: (groupId) => toggleGroupCollapsed(groupId),
	});

	const {
		createGroup,
		updateAllGroupLayouts,
		setGroupCollapsed,
		clearGroupSelection,
		selectGroup: selectGroupImpl,
		clearGroups,
		deleteGroups,
		ungroupGroups,
		removeNodesFromGroups,
		getGroupForNode,
		isNodeHidden,
		isGroupHidden,
		getGroupDepth,
		getGroupNodeIds,
		canSetGroupParent,
		setGroupParent,
		getGroupPortForRef,
		getGroupPortWorldPosition,
		findGroupPortAt,
		renderAllGroups,
		updateGroupLabel,
		updateGroupColor,
	} = groupSystem;
	const selectGroupWithEmit = (groupId: number, append: boolean) => {
		selectGroupImpl(groupId, append);
		emitSelectionChange();
	};
	const clearGroupSelectionWithEmit = () => {
		const hadSelection = groupState.selectedIds.size > 0;
		clearGroupSelection();
		if (hadSelection) {
			emitSelectionChange();
		}
	};
	selectGroup = selectGroupWithEmit;
	toggleGroupCollapsed = (groupId: number) => {
		const group = groupState.groups.get(groupId);
		if (!group) {
			return;
		}
		const nextCollapsed = !group.collapsed;
		setGroupCollapsed(group, nextCollapsed);
		if (nextCollapsed) {
			clearSelection();
		}
		clearGroupSelectionWithEmit();
		selectGroup(group.id, false);
		commitHistory();
	};

	const clearGraphWithGroups = () => {
		clearGroups();
		clearGraph();
		hoveredNodeId = null;
		hoveredConnectionId = null;
		emitHoverChange();
	};

	const clearConnectionSelection = () => {
		if (connectionState.selectedIds.size === 0) {
			return;
		}
		connectionState.selectedIds.clear();
		emitSelectionChange();
	};

	const selectSingleConnection = (id: string) => {
		if (connectionState.selectedIds.size === 1) {
			const [selected] = connectionState.selectedIds;
			if (selected === id) {
				return;
			}
		}
		connectionState.selectedIds.clear();
		connectionState.selectedIds.add(id);
		emitSelectionChange();
	};

	const toggleConnectionSelection = (id: string) => {
		if (connectionState.selectedIds.has(id)) {
			connectionState.selectedIds.delete(id);
		} else {
			connectionState.selectedIds.add(id);
		}
		emitSelectionChange();
	};

	const getSpawnPosition = () => {
		return {
			x: camera.pivot.x - nodeDimensions.width / 2,
			y: camera.pivot.y - nodeDimensions.height / 2,
		};
	};

	const getWorldFromClient = (clientX: number, clientY: number) => {
		const rect = canvas.getBoundingClientRect();
		const cursorX = clientX - rect.left;
		const cursorY = clientY - rect.top;
		const screen = app.renderer.screen;
		const scale = camera.scale.x || 1;

		return {
			x: camera.pivot.x + (cursorX - screen.width / 2) / scale,
			y: camera.pivot.y + (cursorY - screen.height / 2) / scale,
		};
	};

	const getScreenFromWorld = (worldX: number, worldY: number) => {
		const screen = app.renderer.screen;
		const scale = camera.scale.x || 1;
		return {
			x: (worldX - camera.pivot.x) * scale + screen.width / 2,
			y: (worldY - camera.pivot.y) * scale + screen.height / 2,
		};
	};

	const snapState = {
		isActive: false,
		x: 0,
		y: 0,
	};
	const snapIndicatorScreenDistance = 8;
	const snapIndicatorSize = 6;
	const snapIndicatorColor = 0x7cc0ff;
	const snapIndicatorAlpha = 0.85;

	const clearSnapIndicator = () => {
		if (!snapState.isActive) {
			return;
		}
		snapState.isActive = false;
		snapLayer.clear();
	};

	const renderSnapIndicator = (x: number, y: number) => {
		const scale = camera.scale.x || 1;
		const size = snapIndicatorSize / scale;
		const strokeWidth = 1 / scale;

		if (snapState.isActive && snapState.x === x && snapState.y === y) {
			return;
		}

		snapState.isActive = true;
		snapState.x = x;
		snapState.y = y;
		snapLayer.clear();
		snapLayer.setStrokeStyle({
			width: strokeWidth,
			color: snapIndicatorColor,
			alpha: snapIndicatorAlpha,
			cap: "round",
			join: "round",
		});
		snapLayer.moveTo(x - size, y);
		snapLayer.lineTo(x + size, y);
		snapLayer.moveTo(x, y - size);
		snapLayer.lineTo(x, y + size);
		snapLayer.stroke();
	};

	const getSnapPoint = (x: number, y: number) => {
		const scale = camera.scale.x || 1;
		const { minorStep } = getAdaptiveGridSteps(visualSettings.grid, scale);
		const threshold = snapIndicatorScreenDistance / scale;
		const snapX = Math.round(x / minorStep) * minorStep;
		const snapY = Math.round(y / minorStep) * minorStep;
		const withinX = Math.abs(x - snapX) <= threshold;
		const withinY = Math.abs(y - snapY) <= threshold;

		if (withinX && withinY) {
			return { x: snapX, y: snapY };
		}
		return null;
	};

	const selectionState = {
		isActive: false,
		pointerId: null as number | null,
		startX: 0,
		startY: 0,
		endX: 0,
		endY: 0,
		append: false,
	};

	const isPointInRect = (
		pointX: number,
		pointY: number,
		rect: { minX: number; minY: number; maxX: number; maxY: number },
	) =>
		pointX >= rect.minX &&
		pointX <= rect.maxX &&
		pointY >= rect.minY &&
		pointY <= rect.maxY;

	const isRectOverlap = (
		a: { minX: number; minY: number; maxX: number; maxY: number },
		b: { minX: number; minY: number; maxX: number; maxY: number },
	) =>
		a.minX <= b.maxX &&
		a.maxX >= b.minX &&
		a.minY <= b.maxY &&
		a.maxY >= b.minY;

	const getSelectionRect = () => {
		const minX = Math.min(selectionState.startX, selectionState.endX);
		const maxX = Math.max(selectionState.startX, selectionState.endX);
		const minY = Math.min(selectionState.startY, selectionState.endY);
		const maxY = Math.max(selectionState.startY, selectionState.endY);
		return { minX, minY, maxX, maxY };
	};

	const getConnectionControls = (fromX: number, toX: number) => {
		const deltaX = toX - fromX;
		const absDeltaX = Math.abs(deltaX);
		const curve = Math.max(40, absDeltaX * 0.5);
		return {
			controlX1: fromX + (deltaX >= 0 ? curve : -curve),
			controlX2: toX - (deltaX >= 0 ? curve : -curve),
		};
	};

	const bezierPoint = (
		t: number,
		p0: number,
		p1: number,
		p2: number,
		p3: number,
	) => {
		const inv = 1 - t;
		return (
			inv * inv * inv * p0 +
			3 * inv * inv * t * p1 +
			3 * inv * t * t * p2 +
			t * t * t * p3
		);
	};

	const resolveConnectionStyle = (
		from: { x: number; y: number },
		to: { x: number; y: number },
	) => {
		const { connections } = visualSettings;
		if (connections.lodEnabled) {
			const scale = camera.scale.x || 1;
			const screenDistance = Math.hypot(to.x - from.x, to.y - from.y) * scale;
			if (screenDistance >= connections.lodDistance) {
				return "straight";
			}
		}
		return connections.style;
	};

	const buildConnectionPolyline = (
		style: "straight" | "step" | "orthogonal",
		from: { x: number; y: number },
		to: { x: number; y: number },
	) => {
		if (style === "straight") {
			return [from, to];
		}
		const midX =
			style === "step"
				? (from.x + to.x) / 2
				: (() => {
						const deltaX = to.x - from.x;
						const absDeltaX = Math.abs(deltaX);
						const direction = deltaX >= 0 ? 1 : -1;
						const minOffset = 30;
						const maxOffset = 140;
						const desired = Math.min(
							maxOffset,
							Math.max(minOffset, absDeltaX * 0.5),
						);
						const clamped =
							absDeltaX < minOffset
								? absDeltaX / 2
								: Math.min(desired, absDeltaX * 0.8);
						return from.x + clamped * direction;
					})();
		return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
	};

	const isConnectionInRect = (
		from: { x: number; y: number },
		to: { x: number; y: number },
		rect: { minX: number; minY: number; maxX: number; maxY: number },
	) => {
		if (isPointInRect(from.x, from.y, rect)) {
			return true;
		}
		if (isPointInRect(to.x, to.y, rect)) {
			return true;
		}

		const style = resolveConnectionStyle(from, to);
		const samples = 12;
		if (style === "curved") {
			const { controlX1, controlX2 } = getConnectionControls(from.x, to.x);
			for (let i = 1; i <= samples; i += 1) {
				const t = i / samples;
				const pointX = bezierPoint(t, from.x, controlX1, controlX2, to.x);
				const pointY = bezierPoint(t, from.y, from.y, to.y, to.y);
				if (isPointInRect(pointX, pointY, rect)) {
					return true;
				}
			}
			return false;
		}

		const points = buildConnectionPolyline(style, from, to);
		for (let index = 1; index < points.length; index += 1) {
			const start = points[index - 1];
			const end = points[index];
			if (!start || !end) {
				continue;
			}
			for (let i = 1; i <= samples; i += 1) {
				const t = i / samples;
				const pointX = start.x + (end.x - start.x) * t;
				const pointY = start.y + (end.y - start.y) * t;
				if (isPointInRect(pointX, pointY, rect)) {
					return true;
				}
			}
		}
		return false;
	};

	const applySelectionFromRect = () => {
		const rect = getSelectionRect();
		suppressSelectionEmit = true;
		const nextNodeSelection = new Set(
			selectionState.append ? nodeState.selectedIds : [],
		);
		nodeState.nodes.forEach((node, id) => {
			if (isNodeHidden(id)) {
				return;
			}
			const bounds = {
				minX: node.container.position.x,
				minY: node.container.position.y,
				maxX: node.container.position.x + node.width,
				maxY: node.container.position.y + node.height,
			};
			if (isRectOverlap(rect, bounds)) {
				nextNodeSelection.add(id);
			}
		});
		updateSelection(nextNodeSelection);

		const nextGroupSelection = new Set(
			selectionState.append ? groupState.selectedIds : [],
		);
		groupState.groups.forEach((group) => {
			if (isGroupHidden(group.id)) {
				return;
			}
			const bounds = {
				minX: group.container.position.x,
				minY: group.container.position.y,
				maxX: group.container.position.x + group.width,
				maxY: group.container.position.y + group.height,
			};
			if (isRectOverlap(rect, bounds)) {
				nextGroupSelection.add(group.id);
			}
		});
		clearGroupSelectionWithEmit();
		nextGroupSelection.forEach((id) => {
			selectGroup(id, true);
		});

		const nextConnectionSelection = new Set(
			selectionState.append ? connectionState.selectedIds : [],
		);
		connectionState.connections.forEach((connection) => {
			const from = getNodePort(connection.from);
			const to = getNodePort(connection.to);
			if (!from || !to) {
				return;
			}
			if (isNodeHidden(from.node.id) || isNodeHidden(to.node.id)) {
				return;
			}
			const fromPos = getPortWorldPosition(from.node, from.port);
			const toPos = getPortWorldPosition(to.node, to.port);
			if (isConnectionInRect(fromPos, toPos, rect)) {
				nextConnectionSelection.add(connection.id);
			}
		});
		connectionState.selectedIds = nextConnectionSelection;
		suppressSelectionEmit = false;
		emitSelectionChange();
	};

	const renderSelectionBox = () => {
		selectionLayer.clear();
		if (!selectionState.isActive) {
			return;
		}

		const rect = getSelectionRect();
		const scale = camera.scale.x || 1;
		selectionLayer.setStrokeStyle({
			width: 1 / scale,
			color: 0x6aa8ff,
			alpha: 0.9,
			cap: "round",
			join: "round",
		});
		selectionLayer.rect(
			rect.minX,
			rect.minY,
			rect.maxX - rect.minX,
			rect.maxY - rect.minY,
		);
		selectionLayer.fill({ color: 0x6aa8ff, alpha: 0.12 });
		selectionLayer.stroke();
	};

	const touchState = {
		points: new Map<number, { id: number; clientX: number; clientY: number }>(),
		gesture: {
			isActive: false,
			startDistance: 0,
			startScale: 1,
			startPivotX: 0,
			startPivotY: 0,
			lastCenterX: 0,
			lastCenterY: 0,
		},
	};

	const updateTouchPoint = (event: PointerEvent) => {
		touchState.points.set(event.pointerId, {
			id: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
		});
	};

	const removeTouchPoint = (event: PointerEvent) => {
		touchState.points.delete(event.pointerId);
	};

	const getTouchPoints = () => Array.from(touchState.points.values());

	const getTouchCenter = (points: { clientX: number; clientY: number }[]) => ({
		x: (points[0].clientX + points[1].clientX) / 2,
		y: (points[0].clientY + points[1].clientY) / 2,
	});

	const getTouchDistance = (
		first: { clientX: number; clientY: number },
		second: { clientX: number; clientY: number },
	) =>
		Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);

	const cancelActiveInteractions = () => {
		if (connectionState.active) {
			cancelConnectionDrag();
		}

		if (selectionState.isActive) {
			selectionState.isActive = false;
			selectionState.pointerId = null;
			renderSelectionBox();
		}

		if (dragState.isDragging) {
			if (dragState.isDuplicating) {
				setNodesAlpha(dragState.duplicateIds, 1);
			}
			dragState.isDragging = false;
			dragState.pointerId = null;
			dragState.anchorId = null;
			dragState.groupId = null;
			dragState.startPositions.clear();
			dragState.groupStartPositions.clear();
			dragState.groupStart = null;
			dragState.isDuplicating = false;
			dragState.duplicateIds = [];
		}

		if (interactionState.isPanning) {
			interactionState.isPanning = false;
			interactionState.pointerId = null;
			interactionState.panMode = "default";
		}
	};

	const beginTouchGesture = () => {
		const points = getTouchPoints();
		if (points.length < 2) {
			return;
		}

		cancelActiveInteractions();

		const center = getTouchCenter(points);
		touchState.gesture.isActive = true;
		touchState.gesture.startDistance = getTouchDistance(points[0], points[1]);
		touchState.gesture.startScale = camera.scale.x || 1;
		touchState.gesture.startPivotX = camera.pivot.x;
		touchState.gesture.startPivotY = camera.pivot.y;
		touchState.gesture.lastCenterX = center.x;
		touchState.gesture.lastCenterY = center.y;
	};

	const applyTouchGesture = () => {
		const points = getTouchPoints();
		if (points.length < 2) {
			return;
		}

		const center = getTouchCenter(points);
		const distance = getTouchDistance(points[0], points[1]);
		const scaleRatio =
			touchState.gesture.startDistance > 0
				? distance / touchState.gesture.startDistance
				: 1;
		const nextScale = Math.min(
			zoomLimits.max,
			Math.max(zoomLimits.min, touchState.gesture.startScale * scaleRatio),
		);

		const screen = app.renderer.screen;
		const rect = canvas.getBoundingClientRect();
		const cursorX = center.x - rect.left;
		const cursorY = center.y - rect.top;
		const offsetX = cursorX - screen.width / 2;
		const offsetY = cursorY - screen.height / 2;
		const currentScale = camera.scale.x || 1;
		const worldX = camera.pivot.x + offsetX / currentScale;
		const worldY = camera.pivot.y + offsetY / currentScale;

		if (nextScale !== currentScale) {
			camera.scale.set(nextScale, nextScale);
			camera.pivot.x = worldX - offsetX / nextScale;
			camera.pivot.y = worldY - offsetY / nextScale;
		}

		const deltaX = center.x - touchState.gesture.lastCenterX;
		const deltaY = center.y - touchState.gesture.lastCenterY;
		touchState.gesture.lastCenterX = center.x;
		touchState.gesture.lastCenterY = center.y;

		if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
			const panState = applyPan(
				{
					pivotX: camera.pivot.x,
					pivotY: camera.pivot.y,
					scale: camera.scale.x || 1,
				},
				{ deltaX, deltaY },
			);
			camera.pivot.x = panState.pivotX;
			camera.pivot.y = panState.pivotY;
		}
	};

	const endTouchGestureIfNeeded = () => {
		if (touchState.points.size >= 2) {
			return;
		}
		if (!touchState.gesture.isActive) {
			return;
		}

		touchState.gesture.isActive = false;
		if (
			camera.pivot.x !== touchState.gesture.startPivotX ||
			camera.pivot.y !== touchState.gesture.startPivotY ||
			(camera.scale.x || 1) !== touchState.gesture.startScale
		) {
			commitHistory();
		}
	};

	startNodeDrag = (event: FederatedPointerEvent, id: number) => {
		closeSocketEditor();
		const node = nodeState.nodes.get(id);
		if (!node) {
			return;
		}

		const clientEvent = event as unknown as PointerEvent;
		if (interactionState.spacePressed || clientEvent.button === 1) {
			return;
		}

		clearConnectionSelection();
		clearGroupSelectionWithEmit();

		if (clientEvent.shiftKey) {
			nodeState.suppressPanPointerId = event.pointerId;
			toggleSelection(id);
			return;
		}

		if (interactionState.pointerId === event.pointerId) {
			interactionState.isPanning = false;
			interactionState.pointerId = null;
		}

		connectionState.hoverId = null;
		if (hoveredConnectionId !== null) {
			hoveredConnectionId = null;
			emitHoverChange();
		}
		nodeState.suppressPanPointerId = event.pointerId;
		ensureSelectedForDrag(id);

		let dragAnchorId = id;
		let duplicateResult: {
			idMap: Map<number, number>;
			createdIds: number[];
		} | null = null;
		if (clientEvent.altKey) {
			duplicateResult = duplicateSelectionForDrag();
			if (duplicateResult) {
				dragState.isDuplicating = true;
				dragState.duplicateIds = duplicateResult.createdIds;
				dragAnchorId = duplicateResult.idMap.get(id) ?? dragAnchorId;
			}
		}
		if (!duplicateResult) {
			dragState.isDuplicating = false;
			dragState.duplicateIds = [];
		}

		const anchorNode = nodeState.nodes.get(dragAnchorId);
		if (!anchorNode) {
			return;
		}

		const world = getWorldFromClient(clientEvent.clientX, clientEvent.clientY);
		const startPositions = new Map<number, { x: number; y: number }>();
		nodeState.selectedIds.forEach((selectedId) => {
			const selectedNode = nodeState.nodes.get(selectedId);
			if (selectedNode) {
				startPositions.set(selectedId, {
					x: selectedNode.container.position.x,
					y: selectedNode.container.position.y,
				});
			}
		});

		dragState.isDragging = true;
		dragState.pointerId = event.pointerId;
		dragState.anchorId = dragAnchorId;
		dragState.offsetX = world.x - anchorNode.container.position.x;
		dragState.offsetY = world.y - anchorNode.container.position.y;
		dragState.startPositions = startPositions;
		canvas.setPointerCapture(event.pointerId);
	};

	startGroupDrag = (event: FederatedPointerEvent, id: number) => {
		closeSocketEditor();
		const group = groupState.groups.get(id);
		if (!group) {
			return;
		}

		const clientEvent = event as unknown as PointerEvent;
		if (interactionState.spacePressed || clientEvent.button === 1) {
			return;
		}

		clearConnectionSelection();
		if (!clientEvent.shiftKey) {
			clearSelection();
		}

		nodeState.suppressPanPointerId = event.pointerId;
		selectGroup(id, clientEvent.shiftKey);

		const world = getWorldFromClient(clientEvent.clientX, clientEvent.clientY);
		const startPositions = new Map<number, { x: number; y: number }>();
		getGroupNodeIds(group.id).forEach((nodeId) => {
			const node = nodeState.nodes.get(nodeId);
			if (node) {
				startPositions.set(nodeId, {
					x: node.container.position.x,
					y: node.container.position.y,
				});
			}
		});
		const groupStartPositions = new Map<number, { x: number; y: number }>();
		getGroupDescendantIds(group.id).forEach((childId) => {
			const child = groupState.groups.get(childId);
			if (!child || !child.collapsed) {
				return;
			}
			groupStartPositions.set(childId, {
				x: child.collapsedPosition.x,
				y: child.collapsedPosition.y,
			});
		});

		dragState.isDragging = true;
		dragState.pointerId = event.pointerId;
		dragState.anchorId = null;
		dragState.groupId = id;
		dragState.offsetX = world.x - group.container.position.x;
		dragState.offsetY = world.y - group.container.position.y;
		dragState.startPositions = startPositions;
		dragState.groupStartPositions = groupStartPositions;
		dragState.groupStart = {
			x: group.container.position.x,
			y: group.container.position.y,
		};
		canvas.setPointerCapture(event.pointerId);
	};

	const buildShaderSnapshot = (snapshot: SerializableGraph) => ({
		nodes: snapshot.nodes.map((node) => ({
			id: node.id,
			typeId: node.typeId,
			state: node.state,
			ports: node.ports.map((port) => ({
				id: port.id,
				type: port.type,
				direction: port.direction,
			})),
		})),
		connections: snapshot.connections.map((connection) => ({
			from: connection.from,
			to: connection.to,
			type: connection.type,
		})),
	});

	const emitCompileStatus = (status: ShaderCompileStatus) => {
		options.onCompileStatus?.(status);
	};

	const getCompileStatusForResult = (result: ShaderCompileResult) =>
		result.messages.some((message) => message.kind === "error")
			? "failed"
			: "success";

	const updateShaderFromSnapshot = (snapshot: SerializableGraph) => {
		const onShaderChange = options.onShaderChange;
		if (!onShaderChange) {
			return;
		}

		const shaderSnapshot = buildShaderSnapshot(snapshot);
		const serialized = JSON.stringify(shaderSnapshot);
		if (serialized === lastShaderSnapshot) {
			return;
		}

		lastShaderSnapshot = serialized;
		pendingShaderSnapshot = snapshot;
		if (pendingShaderTimeout !== null) {
			return;
		}

		const now = performance.now();
		const elapsed = now - lastShaderCompile;
		const delay =
			elapsed >= shaderCompileThrottleMs
				? 0
				: shaderCompileThrottleMs - elapsed;

		pendingShaderTimeout = window.setTimeout(() => {
			pendingShaderTimeout = null;
			if (!pendingShaderSnapshot) {
				return;
			}
			pendingShaderSnapshot = null;
			pulseConnectionFlow();
			emitCompileStatus("compiling");
			const compileStart = performance.now();
			lastShaderCompile = compileStart;
			const result = compileGraphToGlsl(
				nodeState.nodes,
				connectionState.connections,
				{
					trace: debugMode,
				},
			);
			const compileMs = performance.now() - compileStart;
			result.compileMs = compileMs;
			updatePerformanceWarnings(result.performanceWarnings);
			if (debugOverlay) {
				debugOverlay.recordShaderMessages(result.messages, compileMs);
			}
			emitCompileStatus(getCompileStatusForResult(result));
			onShaderChange(result);
		}, delay);
	};

	const emitUiMessage = (tone: UiMessageTone, message: string) => {
		if (debugOverlay) {
			debugOverlay.recordUiMessage({ tone, message });
		}
		if (options.onUiMessage) {
			options.onUiMessage({ tone, message });
			return;
		}

		const prefix =
			tone === "error" ? "Error: " : tone === "warning" ? "Warning: " : "";
		window.alert(`${prefix}${message}`);
	};

	const connectionSystem = createConnectionSystem({
		canvas,
		camera,
		connectionsLayer,
		labelLayer: connectionLabelLayer,
		nodeState,
		connectionState,
		dragState,
		interactionState,
		portStyles,
		getConnectionStyles: () => visualSettings.connections,
		getFlowActive: isConnectionFlowActive,
		portTypeColors,
		arePortTypesCompatible,
		resolveConnectionType,
		emitUiMessage,
		getDebugState,
		getWorldFromClient,
		getNodePort,
		getPortWorldPosition: (node, port) => {
			const groupPort = getGroupPortForRef({
				nodeId: node.id,
				portId: port.id,
			});
			if (groupPort) {
				return getGroupPortWorldPosition(groupPort.group, groupPort.port);
			}
			return getPortWorldPosition(node, port);
		},
		getPortDragView: (ref) => {
			const groupPort = getGroupPortForRef(ref);
			if (groupPort) {
				return {
					port: groupPort.port,
					render: () => updateAllGroupLayouts(),
				};
			}
			const data = getNodePort(ref);
			if (!data) {
				return null;
			}
			return {
				port: data.port,
				render: () => renderPort(data.node, data.port),
			};
		},
		registerText,
		findGroupPortAt,
		isNodeHidden,
		commitHistory: () => commitHistory(),
	});

	startConnectionDrag = (event, nodeId, portId) => {
		closeSocketEditor();
		connectionSystem.startConnectionDrag(event, nodeId, portId);
	};
	cancelConnectionDrag = connectionSystem.cancelConnectionDrag;

	renderConnections = connectionSystem.renderConnections;
	const {
		findHoveredConnection,
		updateActiveConnectionTarget,
		finalizeConnectionDrag,
	} = connectionSystem;

	const applyVisualSettings = (next: EditorVisualSettings) => {
		visualSettings = next;
		debugOverlay.setEnabled(visualSettings.debugOverlay);
		updateBackground();
		updateScene();
		renderAllNodes();
		renderAllGroups();
		renderConnections();
	};

	const updateVisualSettings = (overrides: Partial<EditorVisualSettings>) => {
		applyVisualSettings(mergeVisualSettings(visualSettings, overrides));
	};

	const setDebugMode = (enabled: boolean) => {
		debugMode = enabled;
	};

	const historyManager = createHistoryManager({
		camera,
		zoomLimits,
		nodeState,
		groupState,
		connectionState,
		historyState,
		arePortTypesCompatible,
		createNode,
		createGroup,
		clearGraph: clearGraphWithGroups,
		clearSelection,
		getNodePort,
		updateShaderFromSnapshot,
		updateNodePorts,
	});

	const {
		buildGraphSnapshot,
		commitHistory: commitHistoryImpl,
		setHistoryCurrent,
		undoHistory: undoHistoryImpl,
		redoHistory: redoHistoryImpl,
		applyGraphSnapshot,
	} = historyManager;

	const graphAutosaveKey = `shadr.graph.autosave.v${GRAPH_SCHEMA_VERSION}`;
	let autosaveTimeout: number | null = null;
	let lastAutosaveSerialized: string | null = null;

	const clearAutosaveTimeout = () => {
		if (autosaveTimeout === null) {
			return;
		}
		window.clearTimeout(autosaveTimeout);
		autosaveTimeout = null;
	};

	const writeAutosave = (serialized: string) => {
		try {
			window.localStorage.setItem(graphAutosaveKey, serialized);
			lastAutosaveSerialized = serialized;
		} catch {
			// Ignore storage failures (private mode or quota issues).
		}
	};

	const scheduleAutosave = (serialized?: string | null) => {
		const nextSerialized = serialized ?? historyState.currentSerialized;
		if (!nextSerialized || nextSerialized === lastAutosaveSerialized) {
			return;
		}
		clearAutosaveTimeout();
		autosaveTimeout = window.setTimeout(() => {
			writeAutosave(nextSerialized);
			autosaveTimeout = null;
		}, 300);
	};

	const clearAutosaveStorage = () => {
		try {
			window.localStorage.removeItem(graphAutosaveKey);
		} catch {
			// Ignore storage failures (private mode or quota issues).
		}
	};

	const restoreAutosavedGraph = () => {
		let stored: string | null = null;
		try {
			stored = window.localStorage.getItem(graphAutosaveKey);
		} catch {
			return false;
		}
		if (!stored) {
			return false;
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(stored);
		} catch {
			clearAutosaveStorage();
			emitUiMessage("warning", "Autosaved graph was invalid and was cleared.");
			return false;
		}

		const snapshot = parseGraph(parsed);
		if (!snapshot) {
			clearAutosaveStorage();
			emitUiMessage(
				"warning",
				"Autosaved graph data is missing required fields and was cleared.",
			);
			return false;
		}

		const { snapshot: sanitizedSnapshot, droppedConnections } =
			applyGraphSnapshot(snapshot);
		historyState.past = [];
		historyState.future = [];
		setHistoryCurrent(sanitizedSnapshot);
		lastAutosaveSerialized = historyState.currentSerialized ?? stored;

		if (droppedConnections > 0) {
			emitUiMessage(
				"warning",
				`Autosaved graph contained ${droppedConnections} invalid connection(s) that were removed.`,
			);
		}
		emitUiMessage("info", "Restored autosaved graph.");
		return true;
	};

	const undoHistory = () => {
		undoHistoryImpl();
		scheduleAutosave();
	};

	const redoHistory = () => {
		redoHistoryImpl();
		scheduleAutosave();
	};

	commitHistory = () => {
		commitHistoryImpl();
		scheduleAutosave();
	};

	const contextMenuItems: ContextMenuItem[] = [];
	type ClipboardPayload = SelectionClipboardPayload;
	let clipboard: SelectionClipboardPayload | null = null;
	let pasteNudge = 0;

	const emitContextMenuChange = (state: ContextMenuState) => {
		if (options.onContextMenuChange) {
			options.onContextMenuChange(state);
		}
	};

	const syncContextMenuState = () => {
		if (!contextMenuState.isOpen) {
			emitContextMenuChange({
				isOpen: false,
				screenX: 0,
				screenY: 0,
				items: [],
			});
			return;
		}

		emitContextMenuChange({
			isOpen: true,
			screenX: contextMenuState.screenX,
			screenY: contextMenuState.screenY,
			items: contextMenuItems.map((item) => ({
				id: item.id,
				label: item.label,
				action: item.action,
				enabled: item.enabled,
			})),
		});
	};

	const hideContextMenu = () => {
		if (!contextMenuState.isOpen) {
			return;
		}

		contextMenuState.isOpen = false;
		syncContextMenuState();
	};

	const closeNodeRename = () => {
		if (!nodeRenameState) {
			return;
		}
		nodeRenameState = null;
		if (options.onNodeRenameChange) {
			options.onNodeRenameChange(null);
		}
	};

	const emitSocketEditorChange = (state: SocketEditorState | null) => {
		if (options.onSocketEditorChange) {
			options.onSocketEditorChange(state);
		}
	};

	closeSocketEditor = () => {
		if (!socketEditorState) {
			return;
		}
		const previous = socketEditorState;
		socketEditorState = null;
		emitSocketEditorChange(null);
		const node = nodeState.nodes.get(previous.nodeId);
		if (node) {
			updateNodeLayout(node, nodeState.selectedIds.has(previous.nodeId));
		}
	};

	const setContextMenuItemEnabled = (
		item: ContextMenuItem,
		enabled: boolean,
	) => {
		item.enabled = enabled;
	};

	const createContextMenuItem = (
		id: string,
		label: string,
		action: () => void,
	) => {
		const item: ContextMenuItem = {
			id,
			label,
			action,
			enabled: true,
		};
		contextMenuItems.push(item);
		return item;
	};

	openNodeRename = (nodeId: number) => {
		const node = nodeState.nodes.get(nodeId);
		if (!node || isNodeHidden(nodeId)) {
			return;
		}
		const { x: screenX, y: screenY } = getScreenFromWorld(
			node.container.position.x + node.title.position.x,
			node.container.position.y + node.title.position.y,
		);
		nodeRenameState = {
			nodeId,
			title: node.title.text,
			screenX,
			screenY,
			scale: camera.scale.x || 1,
		};
		if (options.onNodeRenameChange) {
			options.onNodeRenameChange(nodeRenameState);
		}
	};

	openSocketEditor = (nodeId: number, portId: string) => {
		const node = nodeState.nodes.get(nodeId);
		if (!node || !node.typeId || isNodeHidden(nodeId)) {
			return;
		}
		const port = node.ports.find((candidate) => candidate.id === portId);
		if (!port || port.direction !== "input") {
			return;
		}
		const isConnected = Array.from(connectionState.connections.values()).some(
			(connection) =>
				connection.to.nodeId === nodeId && connection.to.portId === portId,
		);
		if (isConnected) {
			return;
		}
		const sockets = getDefinitionSockets(node.typeId, node.state);
		const socket = sockets.find((candidate) => candidate.id === portId);
		if (!socket?.uiSpec) {
			return;
		}
		if (
			socketEditorState &&
			socketEditorState.nodeId === nodeId &&
			socketEditorState.socketId === portId
		) {
			return;
		}
		closeSocketEditor();
		const position = getPortWorldPosition(node, port);
		const { x: screenX, y: screenY } = getScreenFromWorld(
			position.x + portStyles.radius + portStyles.labelOffset,
			position.y - portStyles.radius,
		);
		const value =
			node.socketValues?.[portId] ??
			socket.value ??
			socket.defaultValue ??
			null;
		socketEditorState = {
			nodeId,
			socketId: portId,
			label: socket.label,
			dataType: socket.dataType,
			uiSpec: socket.uiSpec,
			value,
			screenX,
			screenY,
			scale: camera.scale.x || 1,
		};
		emitSocketEditorChange(socketEditorState);
		updateNodeLayout(node, nodeState.selectedIds.has(nodeId));
	};

	const createNodeWithHistory = (
		position: { x: number; y: number },
		options: {
			id?: number;
			title?: string;
			ports?: SerializablePort[];
			select?: boolean;
			typeId?: string;
			state?: NodeState;
			socketValues?: Record<string, NodeSocketValue>;
		} = {},
	) => {
		createNode(position, options);
		commitHistory();
	};

	const getPortPositionForRef = (
		ref: PortRef,
	): { x: number; y: number } | null => {
		const groupPort = getGroupPortForRef(ref);
		if (groupPort) {
			return getGroupPortWorldPosition(groupPort.group, groupPort.port);
		}
		const data = getNodePort(ref);
		if (!data) {
			return null;
		}
		return getPortWorldPosition(data.node, data.port);
	};

	const createRerouteNode = (
		position: { x: number; y: number },
		type: PortType,
	) => {
		const baseState = getDefaultNodeState("reroute");
		const state: NodeState = {
			version: baseState?.version ?? 1,
			params: {
				...(baseState?.params ?? {}),
				type,
			},
		};
		return createNode(position, {
			title: "Reroute",
			typeId: "reroute",
			state,
			select: false,
		});
	};

	const insertRerouteOnConnection = (
		connectionId: string,
		position: { x: number; y: number },
	) => {
		const connection = connectionState.connections.get(connectionId);
		if (!connection) {
			return;
		}
		const fromData = getNodePort(connection.from);
		const toData = getNodePort(connection.to);
		if (!fromData || !toData) {
			emitUiMessage("warning", "Unable to insert reroute here.");
			return;
		}

		const rerouteType = connection.type;
		const reroute = createRerouteNode(position, rerouteType);
		const rerouteIn: PortRef = { nodeId: reroute.id, portId: "in" };
		const rerouteOut: PortRef = { nodeId: reroute.id, portId: "out" };

		connectionState.connections.delete(connection.id);
		connectionState.selectedIds.delete(connection.id);

		const addConnection = (
			from: PortRef,
			to: PortRef,
			fromType: PortType,
			toType: PortType,
		) => {
			if (!arePortTypesCompatible(fromType, toType)) {
				return;
			}
			const id = `${from.nodeId}:${from.portId}->${to.nodeId}:${to.portId}`;
			const connectionType = resolveConnectionType(fromType, toType);
			connectionState.connections.set(id, {
				id,
				from,
				to,
				type: connectionType,
			});
		};

		addConnection(connection.from, rerouteIn, fromData.port.type, rerouteType);
		addConnection(rerouteOut, connection.to, rerouteType, toData.port.type);
		emitSelectionChange();
		commitHistory();
	};

	const straightenConnection = (connectionId: string) => {
		const connection = connectionState.connections.get(connectionId);
		if (!connection) {
			return;
		}
		const fromData = getNodePort(connection.from);
		const toData = getNodePort(connection.to);
		if (!fromData || !toData) {
			emitUiMessage("warning", "Unable to straighten this connection.");
			return;
		}
		const fromPos = getPortPositionForRef(connection.from);
		const toPos = getPortPositionForRef(connection.to);
		if (!fromPos || !toPos) {
			emitUiMessage("warning", "Unable to straighten this connection.");
			return;
		}

		const rerouteType = connection.type;
		const midX = (fromPos.x + toPos.x) / 2;
		const first = createRerouteNode({ x: midX, y: fromPos.y }, rerouteType);
		const second = createRerouteNode({ x: midX, y: toPos.y }, rerouteType);

		const firstIn: PortRef = { nodeId: first.id, portId: "in" };
		const firstOut: PortRef = { nodeId: first.id, portId: "out" };
		const secondIn: PortRef = { nodeId: second.id, portId: "in" };
		const secondOut: PortRef = { nodeId: second.id, portId: "out" };

		connectionState.connections.delete(connection.id);
		connectionState.selectedIds.delete(connection.id);

		const addConnection = (
			from: PortRef,
			to: PortRef,
			fromType: PortType,
			toType: PortType,
		) => {
			if (!arePortTypesCompatible(fromType, toType)) {
				return;
			}
			const id = `${from.nodeId}:${from.portId}->${to.nodeId}:${to.portId}`;
			const connectionType = resolveConnectionType(fromType, toType);
			connectionState.connections.set(id, {
				id,
				from,
				to,
				type: connectionType,
			});
		};

		addConnection(connection.from, firstIn, fromData.port.type, rerouteType);
		addConnection(firstOut, secondIn, rerouteType, rerouteType);
		addConnection(secondOut, connection.to, rerouteType, toData.port.type);
		commitHistory();
	};

	const spawnTemplateAt = (
		position: { x: number; y: number },
		template: NodeTemplate,
	) => {
		createNodeWithHistory(position, {
			title: template.title,
			typeId: template.id,
		});
	};
	const templateById = new Map(
		nodeTemplates.map((template) => [template.id, template]),
	);

	const recentStorageKey = "shadr-node-recents-v1";
	const maxRecentNodes = 8;
	const loadRecentNodes = () => {
		try {
			const raw = localStorage.getItem(recentStorageKey);
			if (!raw) {
				return [];
			}
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) {
				return [];
			}
			return parsed.filter(
				(value): value is string => typeof value === "string",
			);
		} catch {
			return [];
		}
	};
	const saveRecentNodes = (next: string[]) => {
		try {
			localStorage.setItem(recentStorageKey, JSON.stringify(next));
		} catch {
			// Ignore storage errors.
		}
	};
	let recentNodeIds = loadRecentNodes();
	const pushRecentNode = (typeId: string) => {
		recentNodeIds = [
			typeId,
			...recentNodeIds.filter((id) => id !== typeId),
		].slice(0, maxRecentNodes);
		saveRecentNodes(recentNodeIds);
	};

	const createNodeFromTemplate = (
		typeId: string,
		position?: { x: number; y: number },
	) => {
		const template = templateById.get(typeId);
		if (!template) {
			emitUiMessage("error", `Unknown node template: ${typeId}`);
			return false;
		}
		spawnTemplateAt(position ?? getSpawnPosition(), template);
		pushRecentNode(typeId);
		return true;
	};

	const addNodeToGroup = (nodeId: number, groupId: number) => {
		const group = groupState.groups.get(groupId);
		if (!group) {
			return;
		}
		group.nodeIds.add(nodeId);
		groupState.nodeToGroup.set(nodeId, groupId);
		updateAllGroupLayouts();
	};

	const replaceNodeType = (nodeId: number, typeId: string) => {
		const node = nodeState.nodes.get(nodeId);
		if (!node) {
			return false;
		}
		const definition = getNodeDefinition(typeId);
		if (!definition) {
			emitUiMessage("warning", "Unable to replace with an unknown node.");
			return false;
		}

		const groupId = getGroupForNode(nodeId);
		const position = {
			x: node.container.position.x,
			y: node.container.position.y,
		};
		const oldPorts = node.ports.map((port) => ({
			id: port.id,
			name: port.name,
			type: port.type,
			direction: port.direction,
		}));
		const relatedConnections = Array.from(connectionState.connections.values())
			.filter(
				(connection) =>
					connection.from.nodeId === nodeId || connection.to.nodeId === nodeId,
			)
			.map((connection) => ({ ...connection }));

		relatedConnections.forEach((connection) => {
			connectionState.connections.delete(connection.id);
			connectionState.selectedIds.delete(connection.id);
		});
		node.container.destroy({ children: true });
		nodeState.nodes.delete(nodeId);
		removeNodesFromGroups([nodeId]);

		const normalizedState = normalizeNodeState(typeId, undefined) ?? undefined;
		const newNode = createNode(position, {
			title: node.title.text,
			select: false,
			typeId,
			...(normalizedState ? { state: normalizedState } : {}),
		});
		if (typeof groupId === "number") {
			addNodeToGroup(newNode.id, groupId);
		}

		const portMap = buildPortMapping(newNode, oldPorts);
		relatedConnections.forEach((connection) => {
			const fromNodeId =
				connection.from.nodeId === nodeId ? newNode.id : connection.from.nodeId;
			const toNodeId =
				connection.to.nodeId === nodeId ? newNode.id : connection.to.nodeId;
			if (fromNodeId === toNodeId) {
				return;
			}
			const fromPortId =
				connection.from.nodeId === nodeId
					? (portMap.get(connection.from.portId) ?? null)
					: connection.from.portId;
			const toPortId =
				connection.to.nodeId === nodeId
					? (portMap.get(connection.to.portId) ?? null)
					: connection.to.portId;
			if (!fromPortId || !toPortId) {
				return;
			}

			const fromRef = { nodeId: fromNodeId, portId: fromPortId };
			const toRef = { nodeId: toNodeId, portId: toPortId };
			const fromData = getNodePort(fromRef);
			const toData = getNodePort(toRef);
			if (!fromData || !toData) {
				return;
			}
			if (
				fromData.port.direction !== "output" ||
				toData.port.direction !== "input"
			) {
				return;
			}
			if (!arePortTypesCompatible(fromData.port.type, toData.port.type)) {
				return;
			}
			const id = `${fromRef.nodeId}:${fromRef.portId}->${toRef.nodeId}:${toRef.portId}`;
			const connectionType = resolveConnectionType(
				fromData.port.type,
				toData.port.type,
			);
			connectionState.connections.set(id, {
				id,
				from: fromRef,
				to: toRef,
				type: connectionType,
			});
		});

		clearSelection();
		toggleSelection(newNode.id);
		commitHistory();
		return true;
	};

	let lastPointerWorld: { x: number; y: number } | null = null;
	let isPointerOnCanvas = false;
	let searchSpawnPosition: { x: number; y: number } | null = null;
	const getSearchSpawnPosition = () =>
		searchSpawnPosition ?? getSpawnPosition();

	const definitionById = new Map(
		getNodeDefinitions().map((definition) => [definition.id, definition]),
	);
	const searchEntries: SearchEntry[] = [
		{
			id: "blank-node",
			label: "Blank Node",
			keywords: "blank node",
			category: "General",
			action: () => createNodeWithHistory(getSearchSpawnPosition()),
		},
		...nodeTemplates.map((template) => {
			const definition = definitionById.get(template.id);
			const tags = definition?.tags ?? [];
			const description = definition?.description ?? "";
			return {
				id: template.id,
				label: template.label,
				keywords: [
					template.label,
					template.title,
					template.category,
					template.id,
					description,
					...tags,
				].join(" "),
				category: template.category,
				action: () => {
					spawnTemplateAt(getSearchSpawnPosition(), template);
					pushRecentNode(template.id);
				},
			};
		}),
	];

	const searchPalette = createSearchPalette({
		container: canvas.parentElement ?? document.body,
		entries: searchEntries,
		recentEntryIds: recentNodeIds,
		categoryOrder: [
			"General",
			"Recent",
			"Inputs",
			"Constants",
			"Math",
			"Vector",
			"Color",
			"Texture/UV",
			"Conversion",
			"Logic",
			"Output",
		],
	});

	const openSearchPalette = (query?: string) => {
		if (!searchPalette.isOpen()) {
			hideContextMenu();
			closeNodeRename();
		}
		searchSpawnPosition =
			isPointerOnCanvas && lastPointerWorld
				? lastPointerWorld
				: getSpawnPosition();
		searchPalette.setRecentEntryIds(recentNodeIds);
		searchPalette.open(query);
	};

	const hideSearchPalette = () => {
		searchPalette.close();
	};

	let replaceTargetNodeId: number | null = null;
	const replaceEntries: SearchEntry[] = nodeTemplates.map((template) => {
		const definition = definitionById.get(template.id);
		const tags = definition?.tags ?? [];
		const description = definition?.description ?? "";
		return {
			id: template.id,
			label: template.label,
			keywords: [
				template.label,
				template.title,
				template.category,
				template.id,
				description,
				...tags,
			].join(" "),
			category: template.category,
			action: () => {
				if (replaceTargetNodeId === null) {
					return;
				}
				replaceNodeType(replaceTargetNodeId, template.id);
				replaceTargetNodeId = null;
			},
		};
	});

	const replacePalette = createSearchPalette({
		container: canvas.parentElement ?? document.body,
		entries: replaceEntries,
		recentEntryIds: recentNodeIds,
		categoryOrder: [
			"Recent",
			"Inputs",
			"Constants",
			"Math",
			"Vector",
			"Color",
			"Texture/UV",
			"Conversion",
			"Logic",
			"Output",
		],
	});

	const openReplacePalette = (query?: string) => {
		const selectedIds = Array.from(nodeState.selectedIds);
		if (selectedIds.length !== 1) {
			emitUiMessage("warning", "Select a single node to replace.");
			return;
		}
		if (!replacePalette.isOpen()) {
			hideContextMenu();
			closeNodeRename();
		}
		replaceTargetNodeId = selectedIds[0] ?? null;
		replacePalette.setRecentEntryIds(recentNodeIds);
		replacePalette.open(query);
	};

	const buildSelectionClipboard = (): ClipboardPayload | null => {
		if (nodeState.selectedIds.size === 0) {
			return null;
		}

		const nodes = Array.from(nodeState.selectedIds)
			.map((id) => nodeState.nodes.get(id))
			.filter((node): node is NonNullable<typeof node> => Boolean(node))
			.map((node) => ({
				id: node.id,
				title: node.title.text,
				x: node.container.position.x,
				y: node.container.position.y,
				ports: node.ports.map((port) => ({
					id: port.id,
					name: port.name,
					type: port.type,
					direction: port.direction,
				})),
				...(node.state ? { state: cloneNodeState(node.state) } : {}),
				...(node.socketValues
					? { socketValues: cloneSocketValues(node.socketValues) }
					: {}),
				...(node.typeId ? { typeId: node.typeId } : {}),
			}));

		if (nodes.length === 0) {
			return null;
		}

		const selectedIds = new Set(nodes.map((node) => node.id));
		const connections = Array.from(connectionState.connections.values())
			.filter(
				(connection) =>
					selectedIds.has(connection.from.nodeId) &&
					selectedIds.has(connection.to.nodeId),
			)
			.map((connection) => ({
				from: connection.from,
				to: connection.to,
				type: connection.type,
			}));

		const bounds = nodes.reduce(
			(acc, node) => ({
				minX: Math.min(acc.minX, node.x),
				minY: Math.min(acc.minY, node.y),
				maxX: Math.max(acc.maxX, node.x),
				maxY: Math.max(acc.maxY, node.y),
			}),
			{
				minX: nodes[0].x,
				minY: nodes[0].y,
				maxX: nodes[0].x,
				maxY: nodes[0].y,
			},
		);

		return { version: GRAPH_SCHEMA_VERSION, nodes, connections, bounds };
	};

	const parseSelectionClipboardText = (
		text: string,
	): SelectionClipboardPayload | null => {
		try {
			const raw = JSON.parse(text);
			if (typeof raw !== "object" || raw === null) {
				return null;
			}
			const record = raw as Record<string, unknown>;
			const bounds = record.bounds as Record<string, unknown> | undefined;
			if (
				!bounds ||
				typeof bounds.minX !== "number" ||
				typeof bounds.minY !== "number" ||
				typeof bounds.maxX !== "number" ||
				typeof bounds.maxY !== "number"
			) {
				return null;
			}
			const version =
				typeof record.version === "number"
					? record.version
					: GRAPH_SCHEMA_VERSION;
			const normalized = parseGraph({
				version,
				nodes: record.nodes,
				connections: record.connections,
			});
			if (!normalized) {
				return null;
			}
			return {
				version: normalized.version,
				nodes: normalized.nodes,
				connections: normalized.connections,
				bounds: {
					minX: bounds.minX,
					minY: bounds.minY,
					maxX: bounds.maxX,
					maxY: bounds.maxY,
				},
			};
		} catch {
			return null;
		}
	};

	const filterSocketValuesForDefinition = (
		typeId: string,
		state: NodeState | undefined,
		socketValues?: Record<string, NodeSocketValue>,
	) => {
		if (!socketValues) {
			return undefined;
		}
		const sockets = getDefinitionSockets(typeId, state);
		if (sockets.length === 0) {
			return undefined;
		}
		const validIds = new Set(sockets.map((socket) => socket.id));
		const filtered: Record<string, NodeSocketValue> = {};
		Object.entries(socketValues).forEach(([key, value]) => {
			if (validIds.has(key)) {
				filtered[key] = value;
			}
		});
		return Object.keys(filtered).length > 0 ? filtered : undefined;
	};

	const buildPortMapping = (
		node: NodeView,
		sourcePorts: SerializablePort[],
	) => {
		const mapping = new Map<string, string>();
		const used = new Set<string>();
		const isCompatible = (fromType: PortType, toType: PortType) =>
			arePortTypesCompatible(fromType, toType) ||
			arePortTypesCompatible(toType, fromType);

		const findMatch = (port: SerializablePort) => {
			const exact = node.ports.find(
				(candidate) =>
					candidate.id === port.id && candidate.direction === port.direction,
			);
			if (exact) {
				return exact;
			}
			const byName = node.ports.find(
				(candidate) =>
					candidate.direction === port.direction &&
					candidate.name === port.name &&
					!used.has(candidate.id) &&
					isCompatible(port.type, candidate.type),
			);
			if (byName) {
				return byName;
			}
			return node.ports.find(
				(candidate) =>
					candidate.direction === port.direction &&
					!used.has(candidate.id) &&
					isCompatible(port.type, candidate.type),
			);
		};

		sourcePorts.forEach((port) => {
			const match = findMatch(port);
			if (!match) {
				return;
			}
			mapping.set(port.id, match.id);
			used.add(match.id);
		});
		return mapping;
	};

	const pasteSelectionPayload = (
		payload: SelectionClipboardPayload,
		position?: { x: number; y: number },
	) => {
		const anchor = position ?? getSpawnPosition();
		const nudge = pasteNudge * 24;
		pasteNudge += 1;

		const offsetX = anchor.x + nudge - payload.bounds.minX;
		const offsetY = anchor.y + nudge - payload.bounds.minY;

		const idMap = new Map<number, number>();
		const portMaps = new Map<number, Map<string, string>>();
		const createdIds: number[] = [];

		clearSelection();
		payload.nodes.forEach((node) => {
			const definition = node.typeId ? getNodeDefinition(node.typeId) : null;
			const options: {
				title: string;
				select: boolean;
				state?: NodeState;
				socketValues?: Record<string, NodeSocketValue>;
				typeId?: string;
				ports?: SerializablePort[];
			} = {
				title: node.title,
				select: false,
			};
			if (definition && node.typeId) {
				const normalizedState =
					normalizeNodeState(node.typeId, node.state) ?? undefined;
				options.typeId = node.typeId;
				if (normalizedState) {
					options.state = normalizedState;
				}
				const filteredValues = filterSocketValuesForDefinition(
					node.typeId,
					normalizedState,
					node.socketValues,
				);
				if (filteredValues) {
					options.socketValues = filteredValues;
				}
			} else {
				options.ports = node.ports;
				if (node.socketValues) {
					options.socketValues = cloneSocketValues(node.socketValues);
				}
			}
			const created = createNode(
				{ x: node.x + offsetX, y: node.y + offsetY },
				options,
			);
			idMap.set(node.id, created.id);
			portMaps.set(node.id, buildPortMapping(created, node.ports));
			createdIds.push(created.id);
		});

		payload.connections.forEach((connection) => {
			const fromNodeId = idMap.get(connection.from.nodeId);
			const toNodeId = idMap.get(connection.to.nodeId);
			if (!fromNodeId || !toNodeId) {
				return;
			}
			if (fromNodeId === toNodeId) {
				return;
			}

			const fromPortMap = portMaps.get(connection.from.nodeId);
			const toPortMap = portMaps.get(connection.to.nodeId);
			const fromPortId =
				fromPortMap?.get(connection.from.portId) ?? connection.from.portId;
			const toPortId =
				toPortMap?.get(connection.to.portId) ?? connection.to.portId;

			const fromRef = { nodeId: fromNodeId, portId: fromPortId };
			const toRef = { nodeId: toNodeId, portId: toPortId };
			const fromData = getNodePort(fromRef);
			const toData = getNodePort(toRef);
			if (!fromData || !toData) {
				return;
			}

			if (
				fromData.port.direction !== "output" ||
				toData.port.direction !== "input"
			) {
				return;
			}

			if (!arePortTypesCompatible(fromData.port.type, toData.port.type)) {
				return;
			}

			const id = `${fromRef.nodeId}:${fromRef.portId}->${toRef.nodeId}:${toRef.portId}`;
			const connectionType = resolveConnectionType(
				fromData.port.type,
				toData.port.type,
			);
			connectionState.connections.set(id, {
				id,
				from: fromRef,
				to: toRef,
				type: connectionType,
			});
		});

		createdIds.forEach((id) => {
			toggleSelection(id);
		});
		commitHistory();
	};

	const copySelected = () => {
		const payload = buildSelectionClipboard();
		if (!payload) {
			emitUiMessage("warning", "Select at least one node to copy.");
			return false;
		}

		clipboard = payload;
		pasteNudge = 0;
		return true;
	};

	const getSelectionClipboardJson = () => {
		const payload = buildSelectionClipboard();
		if (!payload) {
			return null;
		}
		return JSON.stringify(payload);
	};

	const cutSelected = () => {
		if (!copySelected()) {
			return;
		}

		const removed = Array.from(nodeState.selectedIds);
		if (deleteSelectedNode()) {
			removeNodesFromGroups(removed);
			commitHistory();
		}
	};

	const pasteClipboard = (position?: { x: number; y: number }) => {
		if (!clipboard) {
			emitUiMessage("warning", "Nothing to paste yet.");
			return;
		}
		pasteSelectionPayload(clipboard, position);
	};

	const pasteSelectionFromText = (
		text: string,
		position?: { x: number; y: number },
	) => {
		const payload = parseSelectionClipboardText(text);
		if (!payload) {
			emitUiMessage("warning", "Clipboard selection JSON is invalid.");
			return false;
		}
		pasteSelectionPayload(payload, position);
		return true;
	};

	const duplicateSelectionForDrag = () => {
		const payload = buildSelectionClipboard();
		if (!payload) {
			return null;
		}

		const idMap = new Map<number, number>();
		const createdIds: number[] = [];

		clearSelection();
		payload.nodes.forEach((node) => {
			const options: {
				title: string;
				select: boolean;
				state?: NodeState;
				socketValues?: Record<string, NodeSocketValue>;
				typeId?: string;
				ports?: SerializablePort[];
			} = {
				title: node.title,
				select: false,
				...(node.state ? { state: cloneNodeState(node.state) } : {}),
				...(node.socketValues
					? { socketValues: cloneSocketValues(node.socketValues) }
					: {}),
				...(node.typeId ? { typeId: node.typeId } : {}),
			};
			if (!node.typeId) {
				options.ports = node.ports;
			}
			const created = createNode({ x: node.x, y: node.y }, options);
			idMap.set(node.id, created.id);
			createdIds.push(created.id);
		});

		payload.connections.forEach((connection) => {
			const fromNodeId = idMap.get(connection.from.nodeId);
			const toNodeId = idMap.get(connection.to.nodeId);
			if (!fromNodeId || !toNodeId) {
				return;
			}

			const fromRef = { nodeId: fromNodeId, portId: connection.from.portId };
			const toRef = { nodeId: toNodeId, portId: connection.to.portId };
			if (fromRef.nodeId === toRef.nodeId) {
				return;
			}
			const fromData = getNodePort(fromRef);
			const toData = getNodePort(toRef);
			if (!fromData || !toData) {
				return;
			}

			if (
				fromData.port.direction !== "output" ||
				toData.port.direction !== "input"
			) {
				return;
			}

			if (!arePortTypesCompatible(fromData.port.type, toData.port.type)) {
				return;
			}

			const id = `${fromRef.nodeId}:${fromRef.portId}->${toRef.nodeId}:${toRef.portId}`;
			const connectionType = resolveConnectionType(
				fromData.port.type,
				toData.port.type,
			);
			connectionState.connections.set(id, {
				id,
				from: fromRef,
				to: toRef,
				type: connectionType,
			});
		});

		createdIds.forEach((id) => {
			toggleSelection(id);
		});
		setNodesAlpha(createdIds, dragGhostAlpha);
		return { idMap, createdIds };
	};

	const duplicateSelection = () => {
		if (!copySelected()) {
			return;
		}
		pasteClipboard();
	};

	const getSelectedGroupFromNodes = () => {
		if (nodeState.selectedIds.size === 0) {
			return null;
		}
		const selectedIds = Array.from(nodeState.selectedIds);
		const firstGroupId = getGroupForNode(selectedIds[0]);
		if (firstGroupId === undefined) {
			return null;
		}
		const matches = selectedIds.every(
			(nodeId) => getGroupForNode(nodeId) === firstGroupId,
		);
		if (!matches) {
			return null;
		}
		return groupState.groups.get(firstGroupId) ?? null;
	};

	const createGroupFromSelection = (
		allowSingle: boolean,
		collapsed: boolean,
	) => {
		if (nodeState.selectedIds.size === 0) {
			emitUiMessage("warning", "Select at least one node to create a group.");
			return;
		}
		if (!allowSingle && nodeState.selectedIds.size < 2) {
			emitUiMessage("warning", "Select at least two nodes to create a group.");
			return;
		}
		const selectedIds = Array.from(nodeState.selectedIds);
		const parentIds = new Set<number | null>();
		selectedIds.forEach((nodeId) => {
			const parentId = getGroupForNode(nodeId);
			parentIds.add(typeof parentId === "number" ? parentId : null);
		});
		if (parentIds.size > 1) {
			emitUiMessage(
				"warning",
				"Select nodes within a single group to nest them.",
			);
			return;
		}
		const parentId = parentIds.values().next().value ?? null;
		if (parentId !== null && getGroupDepth(parentId) + 1 > maxGroupDepth) {
			emitUiMessage(
				"warning",
				`Group nesting limit (${maxGroupDepth}) reached.`,
			);
			return;
		}

		const group = createGroup(selectedIds, {
			collapsed,
			parentId,
		});
		clearSelection();
		clearGroupSelectionWithEmit();
		selectGroup(group.id, false);
		commitHistory();
	};

	const groupSelectedNodes = () => {
		createGroupFromSelection(false, false);
	};

	const convertSelectionToGroup = () => {
		createGroupFromSelection(true, false);
	};

	const createCollapsedGroupFromSelection = () => {
		createGroupFromSelection(false, true);
	};

	const collapseSelectedGroup = () => {
		const group =
			groupState.selectedIds.size > 0
				? (groupState.groups.get(Array.from(groupState.selectedIds)[0]) ?? null)
				: getSelectedGroupFromNodes();
		if (!group || group.collapsed) {
			return;
		}
		setGroupCollapsed(group, true);
		clearSelection();
		selectGroup(group.id, false);
		commitHistory();
	};

	const expandSelectedGroup = () => {
		if (groupState.selectedIds.size === 0) {
			return;
		}
		const group = groupState.groups.get(Array.from(groupState.selectedIds)[0]);
		if (!group || !group.collapsed) {
			return;
		}
		setGroupCollapsed(group, false);
		commitHistory();
	};

	const ungroupSelection = () => {
		if (groupState.selectedIds.size > 0) {
			const groupIds = Array.from(groupState.selectedIds);
			ungroupGroups(groupIds);
			commitHistory();
			return;
		}
		const group = getSelectedGroupFromNodes();
		if (!group) {
			emitUiMessage("warning", "Select nodes from a single group to ungroup.");
			return;
		}
		ungroupGroups([group.id]);
		commitHistory();
	};

	const explodeGroupSelection = () => {
		ungroupSelection();
	};

	type WorldSelectionBounds = {
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
	};

	const getSelectionBounds = (): WorldSelectionBounds | null => {
		let bounds: WorldSelectionBounds | null = null;
		const applyBounds = (
			minX: number,
			minY: number,
			maxX: number,
			maxY: number,
		) => {
			if (!bounds) {
				bounds = { minX, minY, maxX, maxY };
				return;
			}
			bounds.minX = Math.min(bounds.minX, minX);
			bounds.minY = Math.min(bounds.minY, minY);
			bounds.maxX = Math.max(bounds.maxX, maxX);
			bounds.maxY = Math.max(bounds.maxY, maxY);
		};

		nodeState.selectedIds.forEach((id) => {
			const node = nodeState.nodes.get(id);
			if (!node || isNodeHidden(id)) {
				return;
			}
			const x = node.container.position.x;
			const y = node.container.position.y;
			applyBounds(x, y, x + node.width, y + node.height);
		});

		groupState.selectedIds.forEach((id) => {
			const group = groupState.groups.get(id);
			if (!group) {
				return;
			}
			if (isGroupHidden(group.id)) {
				return;
			}
			const x = group.container.position.x;
			const y = group.container.position.y;
			applyBounds(x, y, x + group.width, y + group.height);
		});

		connectionState.selectedIds.forEach((id) => {
			const connection = connectionState.connections.get(id);
			if (!connection) {
				return;
			}
			[connection.from, connection.to].forEach((ref) => {
				const groupPort = getGroupPortForRef(ref);
				if (groupPort) {
					const portPosition = getGroupPortWorldPosition(
						groupPort.group,
						groupPort.port,
					);
					applyBounds(
						portPosition.x,
						portPosition.y,
						portPosition.x,
						portPosition.y,
					);
					return;
				}
				const data = getNodePort(ref);
				if (!data) {
					return;
				}
				const portPosition = getPortWorldPosition(data.node, data.port);
				applyBounds(
					portPosition.x,
					portPosition.y,
					portPosition.x,
					portPosition.y,
				);
			});
		});

		return bounds;
	};

	const buildSelectionBounds = (): SelectionBounds | null => {
		const worldBounds = getSelectionBounds();
		if (!worldBounds) {
			return null;
		}
		const minScreen = getScreenFromWorld(worldBounds.minX, worldBounds.minY);
		const maxScreen = getScreenFromWorld(worldBounds.maxX, worldBounds.maxY);
		return {
			world: worldBounds,
			screen: {
				minX: minScreen.x,
				minY: minScreen.y,
				maxX: maxScreen.x,
				maxY: maxScreen.y,
			},
		};
	};

	emitSelectionBoundsChange = () => {
		const onSelectionBoundsChange = options.onSelectionBoundsChange;
		if (!onSelectionBoundsChange) {
			return;
		}
		const next = buildSelectionBounds();
		const serialized = next ? JSON.stringify(next) : "";
		if (serialized === lastSelectionBoundsSerialized) {
			return;
		}
		lastSelectionBoundsSerialized = serialized;
		onSelectionBoundsChange(next);
	};

	type LayoutNode = {
		id: number;
		node: NodeView;
		x: number;
		y: number;
		width: number;
		height: number;
		centerX: number;
		centerY: number;
	};

	const getSelectedLayoutNodes = (): LayoutNode[] =>
		Array.from(nodeState.selectedIds)
			.map((id) => nodeState.nodes.get(id))
			.filter((node): node is NodeView => Boolean(node))
			.filter((node) => !isNodeHidden(node.id))
			.map((node) => {
				const x = node.container.position.x;
				const y = node.container.position.y;
				return {
					id: node.id,
					node,
					x,
					y,
					width: node.width,
					height: node.height,
					centerX: x + node.width / 2,
					centerY: y + node.height / 2,
				};
			});

	const alignSelectedNodes = (
		mode:
			| "left"
			| "right"
			| "top"
			| "bottom"
			| "center-horizontal"
			| "center-vertical",
	) => {
		const nodes = getSelectedLayoutNodes();
		if (nodes.length < 2) {
			return;
		}

		const bounds = nodes.reduce(
			(acc, node) => ({
				minX: Math.min(acc.minX, node.x),
				minY: Math.min(acc.minY, node.y),
				maxX: Math.max(acc.maxX, node.x + node.width),
				maxY: Math.max(acc.maxY, node.y + node.height),
			}),
			{
				minX: nodes[0].x,
				minY: nodes[0].y,
				maxX: nodes[0].x + nodes[0].width,
				maxY: nodes[0].y + nodes[0].height,
			},
		);
		const centerX = (bounds.minX + bounds.maxX) / 2;
		const centerY = (bounds.minY + bounds.maxY) / 2;

		nodes.forEach(({ node, width, height }) => {
			switch (mode) {
				case "left":
					node.container.position.x = bounds.minX;
					break;
				case "right":
					node.container.position.x = bounds.maxX - width;
					break;
				case "top":
					node.container.position.y = bounds.minY;
					break;
				case "bottom":
					node.container.position.y = bounds.maxY - height;
					break;
				case "center-horizontal":
					node.container.position.x = centerX - width / 2;
					break;
				case "center-vertical":
					node.container.position.y = centerY - height / 2;
					break;
				default:
					break;
			}
		});

		emitSelectionBoundsChange();
		commitHistory();
	};

	const distributeSelectedNodes = (axis: "horizontal" | "vertical") => {
		const nodes = getSelectedLayoutNodes();
		if (nodes.length < 3) {
			return;
		}

		if (axis === "horizontal") {
			const sorted = [...nodes].sort((a, b) => a.centerX - b.centerX);
			const minCenter = sorted[0].centerX;
			const maxCenter = sorted[sorted.length - 1].centerX;
			const span = maxCenter - minCenter;
			if (span <= 0) {
				return;
			}
			const spacing = span / (sorted.length - 1);
			sorted.forEach((node, index) => {
				const targetCenter = minCenter + spacing * index;
				node.node.container.position.x = targetCenter - node.width / 2;
			});
		} else {
			const sorted = [...nodes].sort((a, b) => a.centerY - b.centerY);
			const minCenter = sorted[0].centerY;
			const maxCenter = sorted[sorted.length - 1].centerY;
			const span = maxCenter - minCenter;
			if (span <= 0) {
				return;
			}
			const spacing = span / (sorted.length - 1);
			sorted.forEach((node, index) => {
				const targetCenter = minCenter + spacing * index;
				node.node.container.position.y = targetCenter - node.height / 2;
			});
		}

		emitSelectionBoundsChange();
		commitHistory();
	};

	const findGroupDropTarget = (
		worldX: number,
		worldY: number,
		excludeGroupId: number,
	): GroupView | null => {
		let candidate: GroupView | null = null;
		groupState.groups.forEach((group) => {
			if (group.id === excludeGroupId || isGroupHidden(group.id)) {
				return;
			}
			const bounds = {
				minX: group.container.position.x,
				minY: group.container.position.y,
				maxX: group.container.position.x + group.width,
				maxY: group.container.position.y + group.height,
			};
			if (!isPointInRect(worldX, worldY, bounds)) {
				return;
			}
			if (!candidate || getGroupDepth(group.id) > getGroupDepth(candidate.id)) {
				candidate = group;
			}
		});
		return candidate;
	};

	const getGroupDescendantIds = (groupId: number) => {
		const ids: number[] = [];
		const root = groupState.groups.get(groupId);
		if (!root) {
			return ids;
		}
		const stack = Array.from(root.childGroupIds);
		while (stack.length > 0) {
			const nextId = stack.pop();
			if (typeof nextId !== "number") {
				continue;
			}
			const group = groupState.groups.get(nextId);
			if (!group) {
				continue;
			}
			ids.push(group.id);
			group.childGroupIds.forEach((childId) => {
				stack.push(childId);
			});
		}
		return ids;
	};

	const resetView = () => {
		camera.scale.set(1, 1);
		camera.pivot.x = 0;
		camera.pivot.y = 0;
		commitHistory();
	};

	const frameSelection = () => {
		const bounds = getSelectionBounds();
		if (!bounds) {
			return;
		}
		const screen = app.renderer.screen;
		const padding = 80;
		const availableWidth = Math.max(1, screen.width - padding * 2);
		const availableHeight = Math.max(1, screen.height - padding * 2);
		const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
		const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
		const targetScale = Math.min(
			availableWidth / boundsWidth,
			availableHeight / boundsHeight,
		);
		const nextScale = Math.max(
			zoomLimits.min,
			Math.min(zoomLimits.max, targetScale),
		);
		camera.scale.set(nextScale, nextScale);
		camera.pivot.x = (bounds.minX + bounds.maxX) / 2;
		camera.pivot.y = (bounds.minY + bounds.maxY) / 2;
		commitHistory();
	};

	const deleteSelection = () => {
		closeNodeRename();
		closeSocketEditor();
		if (nodeState.selectedIds.size > 0) {
			const removed = Array.from(nodeState.selectedIds);
			if (deleteSelectedNode()) {
				removeNodesFromGroups(removed);
				commitHistory();
				renderAllNodes();
				emitSelectionChange();
			}
			return;
		}

		if (groupState.selectedIds.size > 0) {
			const groupIds = Array.from(groupState.selectedIds);
			const nodeIds = new Set<number>();
			for (const groupId of groupIds) {
				const group = groupState.groups.get(groupId);
				if (!group) {
					continue;
				}
				for (const nodeId of group.nodeIds) {
					nodeIds.add(nodeId);
				}
			}
			connectionState.connections.forEach((connection, id) => {
				if (
					nodeIds.has(connection.from.nodeId) ||
					nodeIds.has(connection.to.nodeId)
				) {
					connectionState.connections.delete(id);
				}
			});
			deleteGroups(groupIds);
			commitHistory();
			renderAllNodes();
			emitSelectionChange();
			return;
		}

		if (connectionState.selectedIds.size > 0) {
			connectionState.selectedIds.forEach((id) => {
				connectionState.connections.delete(id);
			});
			connectionState.selectedIds.clear();
			commitHistory();
			renderAllNodes();
			emitSelectionChange();
		}
	};

	const saveGraph = () => {
		const snapshot = buildGraphSnapshot();
		const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "shadr-graph.json";
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	};

	createContextMenuItem("add-node", "Add Node...", () => {
		openSearchPalette();
	});

	createContextMenuItem("rename-node", "Rename Node", () => {
		const [nodeId] = Array.from(nodeState.selectedIds);
		if (typeof nodeId === "number") {
			openNodeRename(nodeId);
		}
	});

	createContextMenuItem("group-selected", "Group Selected", () => {
		groupSelectedNodes();
	});

	createContextMenuItem("group-selected-collapsed", "Create Node Group", () => {
		createCollapsedGroupFromSelection();
	});

	createContextMenuItem("ungroup-selected", "Ungroup", () => {
		ungroupSelection();
	});

	createContextMenuItem("explode-group", "Explode Group", () => {
		explodeGroupSelection();
	});

	createContextMenuItem("replace-node", "Replace Node", () => {
		openReplacePalette();
	});

	createContextMenuItem("collapse-group", "Collapse Group", () => {
		collapseSelectedGroup();
	});

	createContextMenuItem("expand-group", "Expand Group", () => {
		expandSelectedGroup();
	});

	createContextMenuItem("align-left", "Align Left", () => {
		alignSelectedNodes("left");
	});

	createContextMenuItem("align-right", "Align Right", () => {
		alignSelectedNodes("right");
	});

	createContextMenuItem("align-top", "Align Top", () => {
		alignSelectedNodes("top");
	});

	createContextMenuItem("align-bottom", "Align Bottom", () => {
		alignSelectedNodes("bottom");
	});

	createContextMenuItem(
		"align-center-horizontal",
		"Align Horizontal Center",
		() => {
			alignSelectedNodes("center-horizontal");
		},
	);

	createContextMenuItem(
		"align-center-vertical",
		"Align Vertical Center",
		() => {
			alignSelectedNodes("center-vertical");
		},
	);

	createContextMenuItem(
		"distribute-horizontal",
		"Distribute Horizontally",
		() => {
			distributeSelectedNodes("horizontal");
		},
	);

	createContextMenuItem("distribute-vertical", "Distribute Vertically", () => {
		distributeSelectedNodes("vertical");
	});

	createContextMenuItem(
		"straighten-connection",
		"Straighten Connection",
		() => {
			if (contextMenuState.targetConnectionId) {
				straightenConnection(contextMenuState.targetConnectionId);
			}
		},
	);

	createContextMenuItem("copy-selected", "Copy Selected", () => {
		copySelected();
	});

	createContextMenuItem("cut-selected", "Cut Selected", () => {
		cutSelected();
	});

	createContextMenuItem("paste", "Paste", () => {
		pasteClipboard({
			x: contextMenuState.worldX,
			y: contextMenuState.worldY,
		});
	});

	createContextMenuItem("delete-selected", "Delete Selected", () => {
		deleteSelection();
	});

	createContextMenuItem("frame-selection", "Frame Selection", () => {
		frameSelection();
	});

	createContextMenuItem("reset-view", "Reset View", () => {
		resetView();
	});

	const showContextMenu = (event: MouseEvent) => {
		event.preventDefault();
		closeNodeRename();
		closeSocketEditor();

		const rect = canvas.getBoundingClientRect();
		const screenX = event.clientX - rect.left;
		const screenY = event.clientY - rect.top;
		const world = getWorldFromClient(event.clientX, event.clientY);

		contextMenuState.worldX = world.x;
		contextMenuState.worldY = world.y;
		contextMenuState.targetConnectionId = findHoveredConnection(
			world.x,
			world.y,
		);

		const selectedNodeIds = Array.from(nodeState.selectedIds);
		const selectedLayoutNodes = getSelectedLayoutNodes();
		const canAlign = selectedLayoutNodes.length > 1;
		const canDistribute = selectedLayoutNodes.length > 2;
		const selectedGroup =
			groupState.selectedIds.size > 0
				? (groupState.groups.get(Array.from(groupState.selectedIds)[0]) ?? null)
				: null;
		const groupFromNodes = getSelectedGroupFromNodes();
		const canGroup =
			nodeState.selectedIds.size >= 2 &&
			selectedNodeIds.every((nodeId) => getGroupForNode(nodeId) === undefined);
		const canUngroup = Boolean(selectedGroup || groupFromNodes);
		const canCollapse =
			(selectedGroup ?? groupFromNodes) !== null &&
			!(selectedGroup ?? groupFromNodes)?.collapsed;
		const canExpand = Boolean(selectedGroup?.collapsed);
		const hasSelection =
			nodeState.selectedIds.size > 0 ||
			groupState.selectedIds.size > 0 ||
			connectionState.selectedIds.size > 0;

		contextMenuItems.forEach((item) => {
			if (item.id === "group-selected") {
				setContextMenuItemEnabled(item, canGroup);
				return;
			}

			if (item.id === "group-selected-collapsed") {
				setContextMenuItemEnabled(item, canGroup);
				return;
			}

			if (item.id === "ungroup-selected") {
				setContextMenuItemEnabled(item, canUngroup);
				return;
			}

			if (item.id === "explode-group") {
				setContextMenuItemEnabled(item, canUngroup);
				return;
			}

			if (item.id === "collapse-group") {
				setContextMenuItemEnabled(item, canCollapse);
				return;
			}

			if (item.id === "expand-group") {
				setContextMenuItemEnabled(item, canExpand);
				return;
			}

			if (
				item.id === "align-left" ||
				item.id === "align-right" ||
				item.id === "align-top" ||
				item.id === "align-bottom" ||
				item.id === "align-center-horizontal" ||
				item.id === "align-center-vertical"
			) {
				setContextMenuItemEnabled(item, canAlign);
				return;
			}

			if (
				item.id === "distribute-horizontal" ||
				item.id === "distribute-vertical"
			) {
				setContextMenuItemEnabled(item, canDistribute);
				return;
			}

			if (item.id === "straighten-connection") {
				setContextMenuItemEnabled(
					item,
					contextMenuState.targetConnectionId !== null,
				);
				return;
			}

			if (item.id === "frame-selection") {
				setContextMenuItemEnabled(item, hasSelection);
				return;
			}

			if (item.id === "delete-selected") {
				setContextMenuItemEnabled(
					item,
					nodeState.selectedIds.size > 0 ||
						groupState.selectedIds.size > 0 ||
						connectionState.selectedIds.size > 0,
				);
				return;
			}

			if (item.id === "rename-node") {
				const [nodeId] = selectedNodeIds;
				setContextMenuItemEnabled(
					item,
					nodeState.selectedIds.size === 1 &&
						typeof nodeId === "number" &&
						!isNodeHidden(nodeId),
				);
				return;
			}

			if (item.id === "replace-node") {
				const [nodeId] = selectedNodeIds;
				setContextMenuItemEnabled(
					item,
					nodeState.selectedIds.size === 1 &&
						typeof nodeId === "number" &&
						!isNodeHidden(nodeId),
				);
				return;
			}

			if (item.id === "copy-selected" || item.id === "cut-selected") {
				setContextMenuItemEnabled(item, nodeState.selectedIds.size > 0);
				return;
			}

			if (item.id === "paste") {
				setContextMenuItemEnabled(item, Boolean(clipboard));
				return;
			} else {
				setContextMenuItemEnabled(item, true);
			}
		});

		contextMenuState.screenX = screenX;
		contextMenuState.screenY = screenY;
		contextMenuState.isOpen = true;
		syncContextMenuState();
	};

	applyVisualSettings(visualSettings);
	const didRestoreAutosave = restoreAutosavedGraph();
	if (!didRestoreAutosave) {
		setHistoryCurrent(buildGraphSnapshot());
	}
	app.ticker.add(() => {
		updateBackground();
		updateScene();
		updateAllGroupLayouts();
		renderConnections();
		emitSelectionBoundsChange();
		if (debugOverlay) {
			debugOverlay.update();
		}
	});

	const handlePointerDown = (event: PointerEvent) => {
		if (event.pointerType === "touch") {
			updateTouchPoint(event);
			if (touchState.points.size >= 2 && !touchState.gesture.isActive) {
				event.preventDefault();
				beginTouchGesture();
				return;
			}
		}

		if (event.pointerType !== "touch") {
			lastPointerWorld = getWorldFromClient(event.clientX, event.clientY);
			isPointerOnCanvas = true;
		}

		closeSocketEditor();

		const isMiddleButton = event.button === 1;
		const isSpacePan = event.button === 0 && interactionState.spacePressed;

		if (!isMiddleButton && event.button !== 0) {
			return;
		}

		if (contextMenuState.isOpen) {
			hideContextMenu();
			return;
		}

		if (nodeState.suppressPanPointerId === event.pointerId) {
			return;
		}

		connectionState.hoverId = null;
		if (hoveredConnectionId !== null) {
			hoveredConnectionId = null;
			emitHoverChange();
		}
		if (!isMiddleButton && !isSpacePan && event.button === 0) {
			const world = getWorldFromClient(event.clientX, event.clientY);
			const hoveredConnection = findHoveredConnection(world.x, world.y);
			if (hoveredConnection) {
				if (event.altKey) {
					insertRerouteOnConnection(hoveredConnection, world);
					return;
				}
				clearSelection();
				clearGroupSelectionWithEmit();
				if (event.shiftKey) {
					toggleConnectionSelection(hoveredConnection);
				} else {
					selectSingleConnection(hoveredConnection);
				}
				return;
			}
		}
		if (isMiddleButton) {
			event.preventDefault();
		}

		if (!isMiddleButton && !isSpacePan) {
			if (interactionState.isPanning) {
				interactionState.isPanning = false;
				interactionState.pointerId = null;
				interactionState.panMode = "default";
			}
			if (!event.shiftKey) {
				clearSelection();
				clearGroupSelectionWithEmit();
				clearConnectionSelection();
			}

			const world = getWorldFromClient(event.clientX, event.clientY);
			selectionState.isActive = true;
			selectionState.pointerId = event.pointerId;
			selectionState.startX = world.x;
			selectionState.startY = world.y;
			selectionState.endX = world.x;
			selectionState.endY = world.y;
			selectionState.append = event.shiftKey;
			renderSelectionBox();
			applySelectionFromRect();
			canvas.setPointerCapture(event.pointerId);
			return;
		}

		interactionState.isPanning = true;
		interactionState.panMode = isMiddleButton
			? "middle"
			: isSpacePan
				? "space"
				: "default";
		interactionState.pointerId = event.pointerId;
		interactionState.lastX = event.clientX;
		interactionState.lastY = event.clientY;
		interactionState.startPivotX = camera.pivot.x;
		interactionState.startPivotY = camera.pivot.y;
		canvas.setPointerCapture(event.pointerId);
	};

	const handlePointerMove = (event: PointerEvent) => {
		if (
			event.pointerType === "touch" &&
			touchState.points.has(event.pointerId)
		) {
			updateTouchPoint(event);
			if (touchState.gesture.isActive) {
				applyTouchGesture();
				return;
			}
		}

		if (event.pointerType !== "touch") {
			lastPointerWorld = getWorldFromClient(event.clientX, event.clientY);
			isPointerOnCanvas = true;
		}

		if (
			connectionState.active &&
			connectionState.active.pointerId === event.pointerId
		) {
			const world = getWorldFromClient(event.clientX, event.clientY);
			connectionState.active.x = world.x;
			connectionState.active.y = world.y;
			updateActiveConnectionTarget(world.x, world.y);
			return;
		}

		if (
			selectionState.isActive &&
			selectionState.pointerId === event.pointerId
		) {
			const world = getWorldFromClient(event.clientX, event.clientY);
			selectionState.endX = world.x;
			selectionState.endY = world.y;
			renderSelectionBox();
			applySelectionFromRect();
			return;
		}

		if (dragState.isDragging && dragState.pointerId === event.pointerId) {
			if (dragState.groupId !== null) {
				const group = groupState.groups.get(dragState.groupId);
				if (!group || !dragState.groupStart) {
					if (dragState.isDuplicating) {
						setNodesAlpha(dragState.duplicateIds, 1);
					}
					dragState.isDragging = false;
					dragState.pointerId = null;
					dragState.groupId = null;
					dragState.startPositions.clear();
					dragState.groupStartPositions.clear();
					dragState.groupStart = null;
					dragState.isDuplicating = false;
					dragState.duplicateIds = [];
					clearSnapIndicator();
					return;
				}

				const world = getWorldFromClient(event.clientX, event.clientY);
				const nextX = world.x - dragState.offsetX;
				const nextY = world.y - dragState.offsetY;
				const snap = getSnapPoint(nextX, nextY);
				const snappedX = snap ? snap.x : nextX;
				const snappedY = snap ? snap.y : nextY;
				if (snap) {
					renderSnapIndicator(snap.x, snap.y);
				} else {
					clearSnapIndicator();
				}
				const deltaX = snappedX - dragState.groupStart.x;
				const deltaY = snappedY - dragState.groupStart.y;

				dragState.startPositions.forEach((start, nodeId) => {
					const node = nodeState.nodes.get(nodeId);
					if (!node) {
						return;
					}
					node.container.position.set(start.x + deltaX, start.y + deltaY);
				});

				dragState.groupStartPositions.forEach((start, childId) => {
					const child = groupState.groups.get(childId);
					if (!child || !child.collapsed) {
						return;
					}
					child.collapsedPosition = {
						x: start.x + deltaX,
						y: start.y + deltaY,
					};
					child.container.position.set(
						child.collapsedPosition.x,
						child.collapsedPosition.y,
					);
				});

				if (group.collapsed) {
					group.collapsedPosition = {
						x: dragState.groupStart.x + deltaX,
						y: dragState.groupStart.y + deltaY,
					};
					group.container.position.set(
						dragState.groupStart.x + deltaX,
						dragState.groupStart.y + deltaY,
					);
				}
				return;
			}

			const anchorId = dragState.anchorId;
			const anchorStart = anchorId
				? dragState.startPositions.get(anchorId)
				: undefined;
			if (!anchorId || !anchorStart) {
				if (dragState.isDuplicating) {
					setNodesAlpha(dragState.duplicateIds, 1);
				}
				dragState.isDragging = false;
				dragState.pointerId = null;
				dragState.anchorId = null;
				dragState.startPositions.clear();
				dragState.groupStartPositions.clear();
				dragState.isDuplicating = false;
				dragState.duplicateIds = [];
				return;
			}

			const world = getWorldFromClient(event.clientX, event.clientY);
			const anchorNextX = world.x - dragState.offsetX;
			const anchorNextY = world.y - dragState.offsetY;
			const snap = getSnapPoint(anchorNextX, anchorNextY);
			const snappedX = snap ? snap.x : anchorNextX;
			const snappedY = snap ? snap.y : anchorNextY;
			if (snap) {
				renderSnapIndicator(snap.x, snap.y);
			} else {
				clearSnapIndicator();
			}
			const deltaX = snappedX - anchorStart.x;
			const deltaY = snappedY - anchorStart.y;

			dragState.startPositions.forEach((start, nodeId) => {
				const node = nodeState.nodes.get(nodeId);
				if (!node) {
					return;
				}

				node.container.position.set(start.x + deltaX, start.y + deltaY);
			});
			return;
		}

		if (
			!interactionState.isPanning ||
			interactionState.pointerId !== event.pointerId
		) {
			const world = getWorldFromClient(event.clientX, event.clientY);
			const nextHover = findHoveredConnection(world.x, world.y);
			if (nextHover !== connectionState.hoverId) {
				connectionState.hoverId = nextHover;
				hoveredConnectionId = nextHover;
				emitHoverChange();
			}
			return;
		}

		const scale = camera.scale.x || 1;
		const deltaX = event.clientX - interactionState.lastX;
		const deltaY = event.clientY - interactionState.lastY;

		interactionState.lastX = event.clientX;
		interactionState.lastY = event.clientY;

		const nextState = applyPan(
			{
				pivotX: camera.pivot.x,
				pivotY: camera.pivot.y,
				scale,
			},
			{
				deltaX,
				deltaY,
			},
		);

		camera.pivot.x = nextState.pivotX;
		camera.pivot.y = nextState.pivotY;
	};

	const stopPanning = (event: PointerEvent) => {
		if (
			event.pointerType === "touch" &&
			touchState.points.has(event.pointerId)
		) {
			removeTouchPoint(event);
			endTouchGestureIfNeeded();
			if (touchState.gesture.isActive) {
				return;
			}
		}

		if (
			connectionState.active &&
			connectionState.active.pointerId === event.pointerId
		) {
			finalizeConnectionDrag(event);
			renderAllNodes();
			emitSelectionChange();
			if (nodeState.suppressPanPointerId === event.pointerId) {
				nodeState.suppressPanPointerId = null;
			}
			canvas.releasePointerCapture(event.pointerId);
			return;
		}

		if (
			selectionState.isActive &&
			selectionState.pointerId === event.pointerId
		) {
			selectionState.isActive = false;
			selectionState.pointerId = null;
			renderSelectionBox();
			canvas.releasePointerCapture(event.pointerId);
			return;
		}

		if (dragState.pointerId === event.pointerId) {
			let didMove = false;
			let didReparent = false;
			const wasDuplicating = dragState.isDuplicating;
			const duplicatedIds = dragState.duplicateIds;
			const draggedGroupId = dragState.groupId;
			dragState.startPositions.forEach((start, nodeId) => {
				const node = nodeState.nodes.get(nodeId);
				if (!node) {
					return;
				}
				if (
					node.container.position.x !== start.x ||
					node.container.position.y !== start.y
				) {
					didMove = true;
				}
			});
			if (draggedGroupId !== null) {
				const world = getWorldFromClient(event.clientX, event.clientY);
				const dropTarget = findGroupDropTarget(
					world.x,
					world.y,
					draggedGroupId,
				);
				if (dropTarget) {
					const draggedGroup = groupState.groups.get(draggedGroupId);
					const parentId = draggedGroup?.parentId ?? null;
					if (dropTarget.id !== parentId) {
						const validation = canSetGroupParent(draggedGroupId, dropTarget.id);
						if (!validation.ok) {
							emitUiMessage(
								"warning",
								validation.reason ??
									`Group nesting limit (${maxGroupDepth}) reached.`,
							);
						} else {
							setGroupParent(draggedGroupId, dropTarget.id);
							didReparent = true;
						}
					}
				}
			}
			if (wasDuplicating) {
				setNodesAlpha(duplicatedIds, 1);
			}
			dragState.isDragging = false;
			dragState.pointerId = null;
			dragState.anchorId = null;
			dragState.groupId = null;
			dragState.startPositions.clear();
			dragState.groupStartPositions.clear();
			dragState.groupStart = null;
			dragState.isDuplicating = false;
			dragState.duplicateIds = [];
			clearSnapIndicator();
			if (nodeState.suppressPanPointerId === event.pointerId) {
				nodeState.suppressPanPointerId = null;
			}
			canvas.releasePointerCapture(event.pointerId);
			if (didMove || didReparent || wasDuplicating) {
				commitHistory();
			}
			return;
		}

		if (interactionState.pointerId !== event.pointerId) {
			if (nodeState.suppressPanPointerId === event.pointerId) {
				nodeState.suppressPanPointerId = null;
			}
			return;
		}

		interactionState.isPanning = false;
		interactionState.pointerId = null;
		if (nodeState.suppressPanPointerId === event.pointerId) {
			nodeState.suppressPanPointerId = null;
		}
		canvas.releasePointerCapture(event.pointerId);
		if (
			interactionState.startPivotX !== camera.pivot.x ||
			interactionState.startPivotY !== camera.pivot.y
		) {
			commitHistory();
		}
	};

	const handlePointerLeave = () => {
		isPointerOnCanvas = false;
	};

	const handleWheel = (event: WheelEvent) => {
		const isPinchZoom = event.ctrlKey || event.metaKey;
		const isPixelDelta = event.deltaMode === 0;
		const hasScrollDelta = event.deltaX !== 0 || event.deltaY !== 0;
		const shouldPan = !isPinchZoom && isPixelDelta && hasScrollDelta;
		event.preventDefault();
		closeSocketEditor();

		if (shouldPan) {
			const panState = applyPan(
				{
					pivotX: camera.pivot.x,
					pivotY: camera.pivot.y,
					scale: camera.scale.x || 1,
				},
				{
					deltaX: event.deltaX,
					deltaY: event.deltaY,
				},
			);
			camera.pivot.x = panState.pivotX;
			camera.pivot.y = panState.pivotY;
			commitHistory();
			return;
		}

		const screen = app.renderer.screen;
		const rect = canvas.getBoundingClientRect();
		const cursorX = event.clientX - rect.left;
		const cursorY = event.clientY - rect.top;
		const scale = camera.scale.x || 1;
		const nextState = applyZoom(
			{
				pivotX: camera.pivot.x,
				pivotY: camera.pivot.y,
				scale,
			},
			{
				cursorX,
				cursorY,
				deltaY: event.deltaY,
				screenHeight: screen.height,
				screenWidth: screen.width,
				limits: zoomLimits,
			},
		);

		if (nextState.scale === scale) {
			return;
		}

		camera.scale.set(nextState.scale, nextState.scale);
		camera.pivot.x = nextState.pivotX;
		camera.pivot.y = nextState.pivotY;
		commitHistory();
	};

	const handleContextMenu = (event: MouseEvent) => {
		if (suppressNextContextMenu) {
			event.preventDefault();
			suppressNextContextMenu = false;
			return;
		}
		showContextMenu(event);
	};

	const handleResolutionChange = () => {
		if (typeof window === "undefined") {
			return;
		}
		const nextResolution = window.devicePixelRatio || 1;
		if (nextResolution === currentResolution) {
			return;
		}
		currentResolution = nextResolution;
		app.renderer.resolution = nextResolution;
		const width = Math.max(1, Math.floor(canvas.clientWidth));
		const height = Math.max(1, Math.floor(canvas.clientHeight));
		app.renderer.resize(width, height);
		syncTextResolution();
	};

	canvas.addEventListener("pointerdown", handlePointerDown);
	canvas.addEventListener("pointermove", handlePointerMove);
	canvas.addEventListener("pointerleave", handlePointerLeave);
	canvas.addEventListener("pointerup", stopPanning);
	canvas.addEventListener("pointercancel", stopPanning);
	canvas.addEventListener("contextmenu", handleContextMenu);
	canvas.addEventListener("wheel", handleWheel, { passive: false });
	window.addEventListener("resize", handleResolutionChange);

	const compileShader = () => {
		const onShaderChange = options.onShaderChange;
		if (!onShaderChange) {
			return;
		}
		pulseConnectionFlow();
		emitCompileStatus("compiling");
		const compileStart = performance.now();
		const result = compileGraphToGlsl(
			nodeState.nodes,
			connectionState.connections,
			{
				trace: debugMode,
			},
		);
		const compileMs = performance.now() - compileStart;
		result.compileMs = compileMs;
		updatePerformanceWarnings(result.performanceWarnings);
		if (debugOverlay) {
			debugOverlay.recordShaderMessages(result.messages, compileMs);
		}
		emitCompileStatus(getCompileStatusForResult(result));
		onShaderChange(result);
	};

	const compilePreviewShader = (target?: ShaderPreviewTarget | null) => {
		pulseConnectionFlow();
		const compileStart = performance.now();
		const result = compileGraphToGlsl(
			nodeState.nodes,
			connectionState.connections,
			{
				previewTarget: target ?? null,
				trace: debugMode,
			},
		);
		const compileMs = performance.now() - compileStart;
		result.compileMs = compileMs;
		if (debugOverlay) {
			debugOverlay.recordShaderMessages(result.messages, compileMs);
		}
		return result;
	};

	const exportGlsl = () => {
		pulseConnectionFlow();
		const compileStart = performance.now();
		const result = compileGraphToGlsl(
			nodeState.nodes,
			connectionState.connections,
			{
				trace: debugMode,
			},
		);
		const compileMs = performance.now() - compileStart;
		result.compileMs = compileMs;
		if (debugOverlay) {
			debugOverlay.recordShaderMessages(result.messages, compileMs);
		}
		if (!result.hasFragmentOutput) {
			emitUiMessage(
				"error",
				"GLSL export failed. Add a Fragment Output node to the graph.",
			);
			return;
		}

		const exportErrors = result.messages
			.filter((message) => message.kind === "error")
			.map((message) => message.message);
		const exportWarnings = result.messages
			.filter((message) => message.kind === "warning")
			.map((message) => message.message);

		if (exportErrors.length > 0) {
			emitUiMessage(
				"error",
				`GLSL export failed:\n${exportErrors.map((error) => `- ${error}`).join("\n")}`,
			);
			return;
		}

		if (exportWarnings.length > 0) {
			emitUiMessage(
				"warning",
				`GLSL export warnings:\n${exportWarnings.map((error) => `- ${error}`).join("\n")}`,
			);
		}

		if (options.onExportRequest) {
			options.onExportRequest(result);
			return;
		}

		const payload = [
			"// Vertex Shader",
			result.vertexSource.trimEnd(),
			"",
			"// Fragment Shader",
			result.fragmentSource.trimEnd(),
			"",
		].join("\n");

		const blob = new Blob([payload], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "shadr-shader.glsl";
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.repeat) {
			return;
		}

		const target = event.target as HTMLElement | null;
		if (
			target &&
			(target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.tagName === "SELECT" ||
				target.isContentEditable)
		) {
			return;
		}

		if (event.key === "Tab") {
			const selectedIds = Array.from(nodeState.selectedIds);
			const orderedIds =
				selectedIds.length > 0
					? selectedIds
					: socketEditorState
						? [socketEditorState.nodeId]
						: [];
			if (orderedIds.length > 0) {
				const editableSockets: Array<{ nodeId: number; socketId: string }> = [];
				orderedIds.forEach((nodeId) => {
					const node = nodeState.nodes.get(nodeId);
					if (!node || !node.typeId) {
						return;
					}
					const sockets = getDefinitionSockets(node.typeId, node.state);
					sockets.forEach((socket) => {
						if (socket.direction !== "input" || !socket.uiSpec) {
							return;
						}
						const isConnected = Array.from(
							connectionState.connections.values(),
						).some(
							(connection) =>
								connection.to.nodeId === nodeId &&
								connection.to.portId === socket.id,
						);
						if (isConnected) {
							return;
						}
						editableSockets.push({ nodeId, socketId: socket.id });
					});
				});
				if (editableSockets.length > 0) {
					event.preventDefault();
					const currentIndex = socketEditorState
						? editableSockets.findIndex(
								(entry) =>
									entry.nodeId === socketEditorState?.nodeId &&
									entry.socketId === socketEditorState?.socketId,
							)
						: -1;
					const delta = event.shiftKey ? -1 : 1;
					const nextIndex =
						currentIndex === -1
							? 0
							: (currentIndex + delta + editableSockets.length) %
								editableSockets.length;
					const next = editableSockets[nextIndex];
					openSocketEditor(next.nodeId, next.socketId);
					return;
				}
			}
		}

		if (event.code === "Space") {
			event.preventDefault();
			interactionState.spacePressed = true;
			return;
		}

		const key = event.key.toLowerCase();
		const isMeta = event.ctrlKey || event.metaKey;

		if (searchPalette.isOpen()) {
			if (key === "escape") {
				event.preventDefault();
				hideSearchPalette();
			}
			return;
		}

		if (isMeta && key === "k") {
			event.preventDefault();
			openSearchPalette();
			return;
		}

		if (isMeta && key === "g" && event.shiftKey) {
			event.preventDefault();
			ungroupSelection();
			return;
		}

		if (isMeta && key === "g") {
			event.preventDefault();
			groupSelectedNodes();
			return;
		}

		if (isMeta && key === "d") {
			event.preventDefault();
			duplicateSelection();
			return;
		}

		if (key === "/") {
			event.preventDefault();
			openSearchPalette();
			return;
		}

		if (key === "escape") {
			hideContextMenu();
			return;
		}

		if (isMeta && key === "z" && event.shiftKey) {
			event.preventDefault();
			redoHistory();
			return;
		}

		if (isMeta && key === "z") {
			event.preventDefault();
			undoHistory();
			return;
		}

		if (isMeta && key === "y") {
			event.preventDefault();
			redoHistory();
			return;
		}

		if (isMeta && key === "s") {
			event.preventDefault();
			saveGraph();
			return;
		}

		if (isMeta && key === "o") {
			event.preventDefault();
			fileInput.click();
			return;
		}

		if (isMeta && key === "e") {
			event.preventDefault();
			exportGlsl();
			return;
		}

		if (key === "f") {
			event.preventDefault();
			frameSelection();
			return;
		}

		if (key === "n") {
			event.preventDefault();
			createNodeWithHistory(getSpawnPosition());
		}

		if (key === "backspace" || key === "delete") {
			event.preventDefault();
			deleteSelection();
		}
	};

	const fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.accept = "application/json";
	fileInput.style.display = "none";
	document.body.appendChild(fileInput);

	const loadGraphFromText = (text: string) => {
		if (!text.trim()) {
			emitUiMessage("error", "Unable to read graph file.");
			return false;
		}

		let raw: unknown;
		try {
			raw = JSON.parse(text);
		} catch {
			emitUiMessage("error", "Invalid graph JSON.");
			return false;
		}

		const report = parseGraphWithReport(raw);
		if (!report.snapshot) {
			const details =
				report.errors.length > 0
					? report.errors.map((error) => `- ${error}`).join("\n")
					: "- Graph data is missing required fields.";
			emitUiMessage("error", `Graph import failed:\n${details}`);
			return false;
		}

		const { snapshot: sanitizedSnapshot, droppedConnections } =
			applyGraphSnapshot(report.snapshot);
		historyState.past = [];
		historyState.future = [];
		setHistoryCurrent(sanitizedSnapshot);
		scheduleAutosave(historyState.currentSerialized);
		if (report.errors.length > 0) {
			emitUiMessage(
				"warning",
				`Graph loaded with warnings:\n${report.errors
					.map((error) => `- ${error}`)
					.join("\n")}`,
			);
		}
		if (droppedConnections > 0) {
			emitUiMessage(
				"warning",
				`Loaded graph contained ${droppedConnections} invalid connection(s) that were removed.`,
			);
		}
		return true;
	};

	const isJsonFile = (file: File) => {
		if (file.type === "application/json") {
			return true;
		}
		return file.name.toLowerCase().endsWith(".json");
	};

	const readGraphFile = (file: File) => {
		if (!isJsonFile(file)) {
			emitUiMessage("error", "Only JSON graph files are supported.");
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			const text = typeof reader.result === "string" ? reader.result : "";
			loadGraphFromText(text);
		};
		reader.readAsText(file);
	};

	const handleFileChange = (event: Event) => {
		const target = event.target as HTMLInputElement | null;
		const file = target?.files?.[0];
		if (!file) {
			return;
		}
		readGraphFile(file);
		target.value = "";
	};

	const handleDragOver = (event: DragEvent) => {
		if (!event.dataTransfer) {
			return;
		}
		const types = event.dataTransfer.types;
		if (types.includes("application/x-shadr-node")) {
			event.preventDefault();
			event.dataTransfer.dropEffect = "copy";
			return;
		}
		if (types.includes("Files")) {
			event.preventDefault();
			event.dataTransfer.dropEffect = "copy";
		}
	};

	const handleDrop = (event: DragEvent) => {
		if (!event.dataTransfer) {
			return;
		}
		const nodeType = event.dataTransfer.getData("application/x-shadr-node");
		if (nodeType) {
			event.preventDefault();
			const world = getWorldFromClient(event.clientX, event.clientY);
			createNodeFromTemplate(nodeType, world);
			return;
		}
		const file = event.dataTransfer.files?.[0];
		if (!file) {
			return;
		}
		event.preventDefault();
		readGraphFile(file);
	};

	fileInput.addEventListener("change", handleFileChange);
	window.addEventListener("keydown", handleKeyDown);
	canvas.addEventListener("dragover", handleDragOver);
	canvas.addEventListener("drop", handleDrop);
	const handleKeyUp = (event: KeyboardEvent) => {
		if (event.code !== "Space") {
			return;
		}

		event.preventDefault();
		interactionState.spacePressed = false;
	};

	window.addEventListener("keyup", handleKeyUp);
	updateShaderFromSnapshot(buildGraphSnapshot());

	const originalDestroy = app.destroy.bind(app);
	app.destroy = () => {
		clearAutosaveTimeout();
		if (pendingShaderTimeout !== null) {
			window.clearTimeout(pendingShaderTimeout);
			pendingShaderTimeout = null;
		}
		canvas.removeEventListener("pointerdown", handlePointerDown);
		canvas.removeEventListener("pointermove", handlePointerMove);
		canvas.removeEventListener("pointerleave", handlePointerLeave);
		canvas.removeEventListener("pointerup", stopPanning);
		canvas.removeEventListener("pointercancel", stopPanning);
		canvas.removeEventListener("contextmenu", handleContextMenu);
		canvas.removeEventListener("wheel", handleWheel);
		canvas.removeEventListener("dragover", handleDragOver);
		canvas.removeEventListener("drop", handleDrop);
		fileInput.removeEventListener("change", handleFileChange);
		fileInput.remove();
		searchPalette.dispose();
		replacePalette.dispose();
		window.removeEventListener("keydown", handleKeyDown);
		window.removeEventListener("keyup", handleKeyUp);
		window.removeEventListener("resize", handleResolutionChange);
		originalDestroy();
	};

	const editorApp = app as EditorApp;
	editorApp.closeContextMenu = hideContextMenu;
	editorApp.closeNodeRename = closeNodeRename;
	editorApp.closeSocketEditor = closeSocketEditor;
	editorApp.compileShader = compileShader;
	editorApp.compilePreviewShader = compilePreviewShader;
	editorApp.exportGlsl = exportGlsl;
	editorApp.openSearchPalette = openSearchPalette;
	editorApp.createNodeFromTemplate = createNodeFromTemplate;
	editorApp.undo = undoHistory;
	editorApp.redo = redoHistory;
	editorApp.copySelected = copySelected;
	editorApp.cutSelected = cutSelected;
	editorApp.paste = () => {
		pasteClipboard();
	};
	editorApp.getSelectionClipboardJson = getSelectionClipboardJson;
	editorApp.pasteSelectionFromText = pasteSelectionFromText;
	editorApp.deleteSelected = deleteSelection;
	editorApp.resetView = resetView;
	editorApp.frameSelection = frameSelection;
	editorApp.groupSelectedNodes = groupSelectedNodes;
	editorApp.convertSelectionToGroup = convertSelectionToGroup;
	editorApp.createCollapsedGroupFromSelection =
		createCollapsedGroupFromSelection;
	editorApp.explodeGroupSelection = explodeGroupSelection;
	editorApp.openReplacePalette = openReplacePalette;
	editorApp.saveGraph = saveGraph;
	editorApp.loadGraph = () => {
		fileInput.click();
	};
	editorApp.loadGraphFromText = loadGraphFromText;
	editorApp.getGraphJson = () =>
		historyState.currentSerialized ?? JSON.stringify(buildGraphSnapshot());
	editorApp.updateNodeState = (nodeId, state) => {
		const node = nodeState.nodes.get(nodeId);
		if (!node || !node.typeId) {
			return false;
		}

		const previous = node.state ??
			getDefaultNodeState(node.typeId) ?? { version: 1, params: {} };
		const merged: NodeState = {
			version: state.version ?? previous.version ?? 1,
			params: { ...previous.params, ...state.params },
			ui: { ...previous.ui, ...state.ui },
		};
		const normalized = normalizeNodeState(node.typeId, merged);
		if (!normalized) {
			return false;
		}

		const didChange =
			JSON.stringify(previous.params) !== JSON.stringify(normalized.params) ||
			JSON.stringify(previous.ui ?? {}) !== JSON.stringify(normalized.ui ?? {});
		if (!didChange) {
			return false;
		}

		node.state = normalized;
		const sockets = getDefinitionSockets(node.typeId, normalized);
		const nextSocketValues: Record<string, NodeSocketValue> = {};
		sockets.forEach((socket) => {
			const existing = node.socketValues?.[socket.id];
			const resolved = existing ?? socket.value ?? socket.defaultValue;
			if (resolved !== undefined) {
				nextSocketValues[socket.id] = resolved;
			}
		});
		const ports = sockets.map((socket) => ({
			id: socket.id,
			name: socket.label,
			type: socket.dataType,
			direction: socket.direction,
		}));
		if (ports.length > 0) {
			const didUpdate = updateNodePorts(nodeId, ports, {
				preserveNames: true,
			});
			if (didUpdate) {
				renderConnections();
			}
		}
		if (Object.keys(nextSocketValues).length > 0) {
			node.socketValues = nextSocketValues;
		} else {
			delete node.socketValues;
		}
		renderFooterLabel(node);
		renderBodyLabel(node);
		updateNodeLayout(node, nodeState.selectedIds.has(nodeId));
		if (
			socketEditorState &&
			socketEditorState.nodeId === nodeId &&
			socketEditorState.socketId in nextSocketValues
		) {
			socketEditorState = {
				...socketEditorState,
				value: nextSocketValues[socketEditorState.socketId] ?? null,
			};
			emitSocketEditorChange(socketEditorState);
		}
		commitHistory();
		emitSelectionChange();
		return true;
	};
	editorApp.updateNodeSocketValues = (nodeId, socketValues) => {
		const node = nodeState.nodes.get(nodeId);
		if (!node || !node.typeId) {
			return false;
		}
		const sockets = getDefinitionSockets(node.typeId, node.state);
		const allowedIds = new Set(sockets.map((socket) => socket.id));
		const nextSocketValues: Record<string, NodeSocketValue> = {};
		sockets.forEach((socket) => {
			const incoming = socketValues[socket.id];
			const existing = node.socketValues?.[socket.id];
			const resolved =
				incoming !== undefined
					? incoming
					: (existing ?? socket.value ?? socket.defaultValue);
			if (resolved !== undefined) {
				nextSocketValues[socket.id] = resolved;
			}
		});
		const filteredInput = Object.keys(socketValues).some(
			(key) => socketValues[key] !== undefined && !allowedIds.has(key),
		);
		const didChange =
			JSON.stringify(node.socketValues ?? {}) !==
				JSON.stringify(nextSocketValues) || filteredInput;
		if (!didChange) {
			return false;
		}
		if (Object.keys(nextSocketValues).length > 0) {
			node.socketValues = nextSocketValues;
		} else {
			delete node.socketValues;
		}
		if (socketEditorState?.nodeId === nodeId) {
			const nextSocket = sockets.find(
				(socket) => socket.id === socketEditorState?.socketId,
			);
			const connected = Array.from(connectionState.connections.values()).some(
				(connection) =>
					connection.to.nodeId === nodeId &&
					connection.to.portId === socketEditorState?.socketId,
			);
			if (!nextSocket?.uiSpec || connected) {
				closeSocketEditor();
			} else {
				socketEditorState = {
					...socketEditorState,
					label: nextSocket.label,
					dataType: nextSocket.dataType,
					uiSpec: nextSocket.uiSpec,
					value:
						node.socketValues?.[socketEditorState.socketId] ??
						nextSocket.value ??
						nextSocket.defaultValue ??
						null,
				};
				emitSocketEditorChange(socketEditorState);
			}
		}
		renderFooterLabel(node);
		renderBodyLabel(node);
		updateNodeLayout(node, nodeState.selectedIds.has(nodeId));
		commitHistory();
		emitSelectionChange();
		return true;
	};
	editorApp.updateNodeTitle = (nodeId, title) => {
		const didUpdate = updateNodeTitle(nodeId, title);
		if (!didUpdate) {
			return false;
		}
		commitHistory();
		emitSelectionChange();
		return true;
	};
	editorApp.updateNodePortName = (nodeId, portId, name) => {
		const node = nodeState.nodes.get(nodeId);
		if (!node) {
			return false;
		}
		const nextName = name.trim();
		if (!nextName) {
			return false;
		}
		const nextPorts = node.ports.map((port) => ({
			id: port.id,
			name: port.id === portId ? nextName : port.name,
			type: port.type,
			direction: port.direction,
		}));
		const didUpdate = updateNodePorts(nodeId, nextPorts, {
			preserveNames: false,
		});
		if (!didUpdate) {
			return false;
		}
		commitHistory();
		emitSelectionChange();
		return true;
	};
	editorApp.updateGroupTitle = (groupId, title) => {
		const group = groupState.groups.get(groupId);
		if (!group) {
			return false;
		}
		const nextTitle = title.trim();
		if (!nextTitle) {
			return false;
		}
		if (group.label === nextTitle) {
			return false;
		}
		const didUpdate = updateGroupLabel(groupId, nextTitle);
		if (!didUpdate) {
			return false;
		}
		commitHistory();
		emitSelectionChange();
		return true;
	};
	editorApp.updateGroupColor = (groupId, color) => {
		const group = groupState.groups.get(groupId);
		if (!group) {
			return false;
		}
		if ((group.color ?? null) === color) {
			return false;
		}
		const didUpdate = updateGroupColor(groupId, color);
		if (!didUpdate) {
			return false;
		}
		commitHistory();
		emitSelectionChange();
		return true;
	};
	editorApp.updateVisualSettings = (settings) => {
		updateVisualSettings(settings);
	};
	editorApp.setConnectionFlowActive = (active) => {
		connectionFlowActive = active;
	};
	editorApp.setDebugMode = (enabled) => {
		setDebugMode(enabled);
	};
	editorApp.setDebugVisualizationState = (state) => {
		updateDebugVisualizationState(state);
	};
	emitSelectionChange();
	return editorApp;
}
