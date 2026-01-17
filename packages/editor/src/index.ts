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
import { createGridRenderer } from "./grid";
import { createGroupSystem } from "./groups";
import { createHistoryManager } from "./history";
import {
	getDefaultNodeState,
	getDefinitionPorts,
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
	EditorApp,
	EditorHoverState,
	EditorSelectionState,
	InitCanvasOptions,
	NodeParamValue,
	NodeRenameState,
	NodeState,
	NodeTemplate,
	NodeView,
	SelectedConnection,
	SelectedNode,
	SerializableGraph,
	SerializablePort,
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
	getInputSelection,
	getInputSelectOptions,
	getNodeDefinition,
	getNodeDefinitions,
} from "./node-definitions";
export { portTypeColors, portTypeLabels, portTypeOrder } from "./ports";
export type {
	ContextMenuItem,
	ContextMenuState,
	EditorApp,
	EditorHoverState,
	EditorSelectionState,
	NodeDefinition,
	NodeParamSpec,
	NodeParamValue,
	NodeRenameState,
	NodeState,
	SelectedConnection,
	SelectedGroup,
	SelectedNode,
	ShaderCompileResult,
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
	const connectionsLayer = new Graphics();
	const groupLayer = new Container();
	const nodesLayer = new Container();
	const selectionLayer = new Graphics();

	camera.addChild(grid);
	camera.addChild(connectionsLayer);
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
	let lastHoverSerialized = "";
	let hoveredNodeId: number | null = null;
	let hoveredConnectionId: string | null = null;

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

	const buildSelectedNode = (node: NodeView): SelectedNode => {
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
	};

	const buildHoverState = (): EditorHoverState => {
		if (hoveredNodeId !== null) {
			const node = nodeState.nodes.get(hoveredNodeId);
			if (node) {
				return { kind: "node", node: buildSelectedNode(node) };
			}
		}

		if (hoveredConnectionId) {
			const connection = connectionState.connections.get(hoveredConnectionId);
			if (connection) {
				return {
					kind: "connection",
					connection: buildSelectedConnection(connection),
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
	let pendingShaderFrame: number | null = null;
	let pendingShaderSnapshot: SerializableGraph | null = null;

	let commitHistory = () => {};
	let renderConnections = () => {};
	let updateNodePorts = (
		_nodeId: number,
		_ports: SerializablePort[],
		_options?: { preserveNames?: boolean },
	) => false;
	let nodeRenameState: NodeRenameState | null = null;
	let startConnectionDrag: (
		event: FederatedPointerEvent,
		nodeId: number,
		portId: string,
	) => void = () => {};
	let cancelConnectionDrag = () => {};
	let startNodeDrag: (event: FederatedPointerEvent, id: number) => void =
		() => {};
	let startGroupDrag: (event: FederatedPointerEvent, id: number) => void =
		() => {};

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
		},
	});

	const {
		renderFooterLabel,
		renderBodyLabel,
		renderPort,
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
	} = nodeSystem;
	updateNodePorts = nodeSystem.updateNodePorts;

	let selectGroup: (groupId: number, append: boolean) => void = () => {};

	const groupSystem = createGroupSystem({
		groupLayer,
		nodeState,
		groupState,
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
		getGroupPortForRef,
		getGroupPortWorldPosition,
		findGroupPortAt,
		renderAllGroups,
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

		const style = visualSettings.connections.style;
		const samples = 12;
		if (style === "straight") {
			for (let i = 1; i <= samples; i += 1) {
				const t = i / samples;
				const pointX = from.x + (to.x - from.x) * t;
				const pointY = from.y + (to.y - from.y) * t;
				if (isPointInRect(pointX, pointY, rect)) {
					return true;
				}
			}
			return false;
		}

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
			dragState.isDragging = false;
			dragState.pointerId = null;
			dragState.anchorId = null;
			dragState.groupId = null;
			dragState.startPositions.clear();
			dragState.groupStart = null;
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
		dragState.anchorId = id;
		dragState.offsetX = world.x - node.container.position.x;
		dragState.offsetY = world.y - node.container.position.y;
		dragState.startPositions = startPositions;
		canvas.setPointerCapture(event.pointerId);
	};

	startGroupDrag = (event: FederatedPointerEvent, id: number) => {
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
		group.nodeIds.forEach((nodeId) => {
			const node = nodeState.nodes.get(nodeId);
			if (node) {
				startPositions.set(nodeId, {
					x: node.container.position.x,
					y: node.container.position.y,
				});
			}
		});

		dragState.isDragging = true;
		dragState.pointerId = event.pointerId;
		dragState.anchorId = null;
		dragState.groupId = id;
		dragState.offsetX = world.x - group.container.position.x;
		dragState.offsetY = world.y - group.container.position.y;
		dragState.startPositions = startPositions;
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
		if (pendingShaderFrame !== null) {
			return;
		}

		pendingShaderFrame = requestAnimationFrame(() => {
			pendingShaderFrame = null;
			if (!pendingShaderSnapshot) {
				return;
			}
			pendingShaderSnapshot = null;
			const compileStart = performance.now();
			const result = compileGraphToGlsl(
				nodeState.nodes,
				connectionState.connections,
			);
			const compileMs = performance.now() - compileStart;
			result.compileMs = compileMs;
			if (debugOverlay) {
				debugOverlay.recordShaderMessages(result.messages, compileMs);
			}
			onShaderChange(result);
		});
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
		nodeState,
		connectionState,
		dragState,
		interactionState,
		portStyles,
		getConnectionStyles: () => visualSettings.connections,
		portTypeColors,
		arePortTypesCompatible,
		resolveConnectionType,
		emitUiMessage,
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
		findGroupPortAt,
		isNodeHidden,
		commitHistory: () => commitHistory(),
	});

	startConnectionDrag = connectionSystem.startConnectionDrag;
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
	type ClipboardPayload = {
		nodes: SerializableGraph["nodes"];
		connections: SerializableGraph["connections"];
		bounds: { minX: number; minY: number; maxX: number; maxY: number };
	};
	let clipboard: ClipboardPayload | null = null;
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

	const openNodeRename = (nodeId: number) => {
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

	const createNodeWithHistory = (
		position: { x: number; y: number },
		options: {
			id?: number;
			title?: string;
			ports?: SerializablePort[];
			select?: boolean;
			typeId?: string;
			state?: NodeState;
		} = {},
	) => {
		createNode(position, options);
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

	const searchEntries: SearchEntry[] = [
		{
			id: "blank-node",
			label: "Blank Node",
			keywords: "blank node",
			category: "General",
			action: () => createNodeWithHistory(getSpawnPosition()),
		},
		...nodeTemplates.map((template) => ({
			id: template.id,
			label: template.label,
			keywords: `${template.label} ${template.title} ${template.category}`,
			category: template.category,
			action: () => spawnTemplateAt(getSpawnPosition(), template),
		})),
	];

	const searchPalette = createSearchPalette({
		container: canvas.parentElement ?? document.body,
		entries: searchEntries,
		categoryOrder: [
			"General",
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

	const openSearchPalette = () => {
		if (searchPalette.isOpen()) {
			return;
		}
		hideContextMenu();
		closeNodeRename();
		searchPalette.open();
	};

	const hideSearchPalette = () => {
		searchPalette.close();
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

		return { nodes, connections, bounds };
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

		const anchor = position ?? getSpawnPosition();
		const nudge = pasteNudge * 24;
		pasteNudge += 1;

		const offsetX = anchor.x + nudge - clipboard.bounds.minX;
		const offsetY = anchor.y + nudge - clipboard.bounds.minY;

		const idMap = new Map<number, number>();
		const createdIds: number[] = [];

		clearSelection();
		clipboard.nodes.forEach((node) => {
			const options: {
				title: string;
				select: boolean;
				state?: NodeState;
				typeId?: string;
				ports?: SerializablePort[];
			} = {
				title: node.title,
				select: false,
				...(node.state ? { state: cloneNodeState(node.state) } : {}),
				...(node.typeId ? { typeId: node.typeId } : {}),
			};
			if (!node.typeId) {
				options.ports = node.ports;
			}
			const created = createNode(
				{ x: node.x + offsetX, y: node.y + offsetY },
				options,
			);
			idMap.set(node.id, created.id);
			createdIds.push(created.id);
		});

		clipboard.connections.forEach((connection) => {
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

			if (
				!arePortTypesCompatible(fromData.port.type, connection.type) ||
				!arePortTypesCompatible(toData.port.type, connection.type)
			) {
				return;
			}

			const id = `${fromRef.nodeId}:${fromRef.portId}->${toRef.nodeId}:${toRef.portId}`;
			connectionState.connections.set(id, {
				id,
				from: fromRef,
				to: toRef,
				type: connection.type,
			});
		});

		createdIds.forEach((id) => {
			toggleSelection(id);
		});
		commitHistory();
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

	const groupSelectedNodes = () => {
		if (nodeState.selectedIds.size < 2) {
			emitUiMessage("warning", "Select at least two nodes to create a group.");
			return;
		}
		const selectedIds = Array.from(nodeState.selectedIds);
		const alreadyGrouped = selectedIds.some(
			(nodeId) => getGroupForNode(nodeId) !== undefined,
		);
		if (alreadyGrouped) {
			emitUiMessage(
				"warning",
				"Ungroup selected nodes before creating a new group.",
			);
			return;
		}

		const group = createGroup(selectedIds, { collapsed: false });
		clearSelection();
		clearGroupSelectionWithEmit();
		selectGroup(group.id, false);
		commitHistory();
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

	type SelectionBounds = {
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
	};

	const getSelectionBounds = (): SelectionBounds | null => {
		let bounds: SelectionBounds | null = null;
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
		if (nodeState.selectedIds.size > 0) {
			const removed = Array.from(nodeState.selectedIds);
			if (deleteSelectedNode()) {
				removeNodesFromGroups(removed);
				commitHistory();
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
			emitSelectionChange();
			return;
		}

		if (connectionState.selectedIds.size > 0) {
			connectionState.selectedIds.forEach((id) => {
				connectionState.connections.delete(id);
			});
			connectionState.selectedIds.clear();
			commitHistory();
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

	createContextMenuItem("ungroup-selected", "Ungroup", () => {
		ungroupSelection();
	});

	createContextMenuItem("collapse-group", "Collapse Group", () => {
		collapseSelectedGroup();
	});

	createContextMenuItem("expand-group", "Expand Group", () => {
		expandSelectedGroup();
	});

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

		const rect = canvas.getBoundingClientRect();
		const screenX = event.clientX - rect.left;
		const screenY = event.clientY - rect.top;
		const world = getWorldFromClient(event.clientX, event.clientY);

		contextMenuState.worldX = world.x;
		contextMenuState.worldY = world.y;

		const selectedNodeIds = Array.from(nodeState.selectedIds);
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

			if (item.id === "ungroup-selected") {
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
					dragState.isDragging = false;
					dragState.pointerId = null;
					dragState.groupId = null;
					dragState.startPositions.clear();
					dragState.groupStart = null;
					return;
				}

				const world = getWorldFromClient(event.clientX, event.clientY);
				const nextX = world.x - dragState.offsetX;
				const nextY = world.y - dragState.offsetY;
				const deltaX = nextX - dragState.groupStart.x;
				const deltaY = nextY - dragState.groupStart.y;

				dragState.startPositions.forEach((start, nodeId) => {
					const node = nodeState.nodes.get(nodeId);
					if (!node) {
						return;
					}
					node.container.position.set(start.x + deltaX, start.y + deltaY);
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
				dragState.isDragging = false;
				dragState.pointerId = null;
				dragState.anchorId = null;
				dragState.startPositions.clear();
				return;
			}

			const world = getWorldFromClient(event.clientX, event.clientY);
			const anchorNextX = world.x - dragState.offsetX;
			const anchorNextY = world.y - dragState.offsetY;
			const deltaX = anchorNextX - anchorStart.x;
			const deltaY = anchorNextY - anchorStart.y;

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
			dragState.isDragging = false;
			dragState.pointerId = null;
			dragState.anchorId = null;
			dragState.groupId = null;
			dragState.startPositions.clear();
			dragState.groupStart = null;
			if (nodeState.suppressPanPointerId === event.pointerId) {
				nodeState.suppressPanPointerId = null;
			}
			canvas.releasePointerCapture(event.pointerId);
			if (didMove) {
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

	const handleWheel = (event: WheelEvent) => {
		const isPinchZoom = event.ctrlKey || event.metaKey;
		const isPixelDelta = event.deltaMode === 0;
		const hasScrollDelta = event.deltaX !== 0 || event.deltaY !== 0;
		const shouldPan = !isPinchZoom && isPixelDelta && hasScrollDelta;
		event.preventDefault();

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
	canvas.addEventListener("pointerup", stopPanning);
	canvas.addEventListener("pointercancel", stopPanning);
	canvas.addEventListener("contextmenu", handleContextMenu);
	canvas.addEventListener("wheel", handleWheel, { passive: false });
	window.addEventListener("resize", handleResolutionChange);

	const exportGlsl = () => {
		const compileStart = performance.now();
		const result = compileGraphToGlsl(
			nodeState.nodes,
			connectionState.connections,
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
			(target.tagName === "INPUT" || target.tagName === "TEXTAREA")
		) {
			return;
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
		if (!event.dataTransfer.types.includes("Files")) {
			return;
		}
		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
	};

	const handleDrop = (event: DragEvent) => {
		if (!event.dataTransfer) {
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
		canvas.removeEventListener("pointerdown", handlePointerDown);
		canvas.removeEventListener("pointermove", handlePointerMove);
		canvas.removeEventListener("pointerup", stopPanning);
		canvas.removeEventListener("pointercancel", stopPanning);
		canvas.removeEventListener("contextmenu", handleContextMenu);
		canvas.removeEventListener("wheel", handleWheel);
		canvas.removeEventListener("dragover", handleDragOver);
		canvas.removeEventListener("drop", handleDrop);
		fileInput.removeEventListener("change", handleFileChange);
		fileInput.remove();
		searchPalette.dispose();
		window.removeEventListener("keydown", handleKeyDown);
		window.removeEventListener("keyup", handleKeyUp);
		window.removeEventListener("resize", handleResolutionChange);
		originalDestroy();
	};

	const editorApp = app as EditorApp;
	editorApp.closeContextMenu = hideContextMenu;
	editorApp.closeNodeRename = closeNodeRename;
	editorApp.exportGlsl = exportGlsl;
	editorApp.openSearchPalette = openSearchPalette;
	editorApp.undo = undoHistory;
	editorApp.redo = redoHistory;
	editorApp.copySelected = copySelected;
	editorApp.cutSelected = cutSelected;
	editorApp.paste = () => {
		pasteClipboard();
	};
	editorApp.deleteSelected = deleteSelection;
	editorApp.resetView = resetView;
	editorApp.frameSelection = frameSelection;
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
		const ports = getDefinitionPorts(node.typeId, normalized);
		if (ports.length > 0) {
			const didUpdate = updateNodePorts(nodeId, ports, {
				preserveNames: true,
			});
			if (didUpdate) {
				renderConnections();
			}
		}
		renderFooterLabel(node);
		renderBodyLabel(node);
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
	editorApp.updateVisualSettings = (settings) => {
		updateVisualSettings(settings);
	};
	emitSelectionChange();
	return editorApp;
}
