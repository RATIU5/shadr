import {
	Application,
	Container,
	type FederatedPointerEvent,
	Graphics,
	Rectangle,
	Text,
} from "pixi.js";
import { createConstEditor } from "./const-editor";
import { applyPan, applyZoom } from "./controls";
import { createGridRenderer } from "./grid";
import { portTypeColors } from "./ports";
import { createSearchPalette, type SearchEntry } from "./search";
import { parseGraph } from "./serialization";
import { compileGraphToGlsl } from "./shader";
import { defaultPorts, nodeTemplates } from "./templates";
import type {
	Connection,
	ConnectionDrag,
	ContextMenuItem,
	ContextMenuState,
	EditorApp,
	InitCanvasOptions,
	NodeData,
	NodePort,
	NodeTemplate,
	NodeView,
	PortRef,
	PortType,
	SerializableConnection,
	SerializableGraph,
	SerializablePort,
} from "./types";

export { portTypeColors, portTypeLabels, portTypeOrder } from "./ports";
export type {
	ContextMenuItem,
	ContextMenuState,
	EditorApp,
	ShaderCompileResult,
} from "./types";

export async function initCanvas(
	canvas: HTMLCanvasElement,
	options: InitCanvasOptions = {},
): Promise<EditorApp> {
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

	const camera = new Container();
	const grid = new Graphics();
	const connectionsLayer = new Graphics();
	const nodesLayer = new Container();

	camera.addChild(grid);
	camera.addChild(connectionsLayer);
	camera.addChild(nodesLayer);
	app.stage.addChild(camera);

	const { updateScene } = createGridRenderer({
		app,
		camera,
		grid,
	});

	const interactionState = {
		isPanning: false,
		pointerId: null as number | null,
		lastX: 0,
		lastY: 0,
		startPivotX: 0,
		startPivotY: 0,
	};

	const dragState = {
		isDragging: false,
		pointerId: null as number | null,
		anchorId: null as number | null,
		offsetX: 0,
		offsetY: 0,
		startPositions: new Map<number, { x: number; y: number }>(),
	};

	const zoomLimits = {
		min: 0.25,
		max: 4,
	};

	const nodeDimensions = {
		width: 180,
		height: 72,
	};

	const defaultConstColor = { r: 1, g: 1, b: 1, a: 1 };
	const defaultConstVector = { x: 0, y: 0, z: 0, w: 0 };
	const getDefaultNodeData = (templateId?: string): NodeData | undefined => {
		if (templateId === "const-float") {
			return { value: 0 };
		}
		if (templateId === "const-vec2") {
			return { vector: { x: defaultConstVector.x, y: defaultConstVector.y } };
		}
		if (templateId === "const-vec3") {
			return {
				vector: {
					x: defaultConstVector.x,
					y: defaultConstVector.y,
					z: defaultConstVector.z,
				},
			};
		}
		if (templateId === "const-vec4") {
			return { vector: { ...defaultConstVector } };
		}
		if (templateId === "const-color") {
			return { color: { ...defaultConstColor } };
		}
		return undefined;
	};

	const portStyles = {
		radius: 5,
		hoverRadius: 7,
		hoverStroke: 2,
		dragStrokeValid: 0x3bb54a,
		dragStrokeInvalid: 0xe05a5a,
		dragStrokeAlpha: 0.9,
		startY: 34,
		spacing: 18,
		labelOffset: 10,
		outputLabelOffset: 72,
	};

	const arePortTypesCompatible = (first: PortType, second: PortType) =>
		first === second ||
		(first === "color" && second === "vec4") ||
		(first === "vec4" && second === "color");

	const resolveConnectionType = (
		first: PortType,
		second: PortType,
	): PortType => (first === "color" || second === "color" ? "color" : first);

	const connectionStyles = {
		width: 2,
		hoverWidth: 4,
		hoverDistance: 10,
		hoverSegments: 12,
		ghostAlpha: 0.45,
		invalidColor: 0xe05a5a,
		invalidAlpha: 0.6,
	};

	const nodeState = {
		nextId: 1,
		nodes: new Map<number, NodeView>(),
		selectedIds: new Set<number>(),
		suppressPanPointerId: null as number | null,
	};

	const connectionState = {
		connections: new Map<string, Connection>(),
		active: null as ConnectionDrag | null,
		hoverId: null as string | null,
	};

	const historyState = {
		past: [] as SerializableGraph[],
		current: null as SerializableGraph | null,
		future: [] as SerializableGraph[],
		currentSerialized: "",
	};

	let updateShaderFromSnapshot = (_snapshot: SerializableGraph) => {};
	let lastShaderSnapshot = "";
	let pendingShaderFrame: number | null = null;
	let pendingShaderSnapshot: SerializableGraph | null = null;

	const contextMenuState = {
		isOpen: false,
		screenX: 0,
		screenY: 0,
		worldX: 0,
		worldY: 0,
	};

	let commitHistory = () => {};

	const constEditor = createConstEditor({
		container: canvas.parentElement ?? document.body,
		canvas,
		getNodeById: (id) => nodeState.nodes.get(id),
		onCommit: () => commitHistory(),
	});

	const renderNode = (node: NodeView, isSelected: boolean) => {
		const isHover = node.isHover && !isSelected;
		const borderColor = isSelected ? 0x2f6fed : isHover ? 0x4a4a4a : 0x6b6b6b;
		const fillColor = isHover ? 0xfafafa : 0xf4f4f4;

		node.background.clear();
		node.background.setStrokeStyle({
			width: 2,
			color: borderColor,
			alpha: 1,
		});
		node.background.rect(0, 0, node.width, node.height);
		node.background.fill({ color: fillColor, alpha: 1 });
		node.background.stroke();
	};

	const renderConstValue = (node: NodeView) => {
		constEditor.renderValue(node);
	};

	const closeConstEditor = () => {
		constEditor.close();
	};

	const openConstEditor = (node: NodeView) => {
		constEditor.open(node);
	};

	const renderPorts = (node: NodeView) => {
		const inputs = node.ports.filter((port) => port.direction === "input");
		const outputs = node.ports.filter((port) => port.direction === "output");

		inputs.forEach((port, index) => {
			const y = portStyles.startY + index * portStyles.spacing;
			const shouldStroke = port.isHover || port.isDragTarget;
			const radius = shouldStroke ? portStyles.hoverRadius : portStyles.radius;
			port.graphics.clear();
			if (shouldStroke) {
				port.graphics.setStrokeStyle({
					width: portStyles.hoverStroke,
					color: port.isDragTarget
						? port.isDragValid
							? portStyles.dragStrokeValid
							: portStyles.dragStrokeInvalid
						: 0xffffff,
					alpha: port.isDragTarget ? portStyles.dragStrokeAlpha : 0.9,
				});
			}
			port.graphics.circle(0, y, radius);
			port.graphics.fill({ color: portTypeColors[port.type], alpha: 1 });
			if (shouldStroke) {
				port.graphics.stroke();
			}
			port.label.text = `${port.name}: ${port.type}`;
			port.label.position.set(
				portStyles.radius + portStyles.labelOffset,
				y - portStyles.radius,
			);
		});

		outputs.forEach((port, index) => {
			const y = portStyles.startY + index * portStyles.spacing;
			const shouldStroke = port.isHover || port.isDragTarget;
			const radius = shouldStroke ? portStyles.hoverRadius : portStyles.radius;
			port.graphics.clear();
			if (shouldStroke) {
				port.graphics.setStrokeStyle({
					width: portStyles.hoverStroke,
					color: port.isDragTarget
						? port.isDragValid
							? portStyles.dragStrokeValid
							: portStyles.dragStrokeInvalid
						: 0xffffff,
					alpha: port.isDragTarget ? portStyles.dragStrokeAlpha : 0.9,
				});
			}
			port.graphics.circle(node.width, y, radius);
			port.graphics.fill({ color: portTypeColors[port.type], alpha: 1 });
			if (shouldStroke) {
				port.graphics.stroke();
			}
			port.label.text = `${port.name}: ${port.type}`;
			port.label.position.set(node.width - portStyles.outputLabelOffset, y - 6);
		});
	};

	const getPortWorldPosition = (node: NodeView, port: NodePort) => {
		const ports = node.ports.filter(
			(candidate) => candidate.direction === port.direction,
		);
		const index = Math.max(
			0,
			ports.findIndex((candidate) => candidate.id === port.id),
		);
		const y = portStyles.startY + index * portStyles.spacing;
		const x = port.direction === "input" ? 0 : node.width;

		return {
			x: node.container.position.x + x,
			y: node.container.position.y + y,
		};
	};

	const getNodePort = (ref: PortRef) => {
		const node = nodeState.nodes.get(ref.nodeId);
		if (!node) {
			return null;
		}

		const port = node.ports.find((candidate) => candidate.id === ref.portId);
		if (!port) {
			return null;
		}

		return { node, port };
	};

	const getConnectionControls = (fromX: number, toX: number) => {
		const deltaX = toX - fromX;
		const absDeltaX = Math.abs(deltaX);
		const curve = Math.max(40, absDeltaX * 0.5);
		const controlX1 = fromX + (deltaX >= 0 ? curve : -curve);
		const controlX2 = toX - (deltaX >= 0 ? curve : -curve);

		return { controlX1, controlX2 };
	};

	const drawConnection = (
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		color: number,
		alpha: number,
		width: number = connectionStyles.width,
	) => {
		const scale = camera.scale.x || 1;
		const { controlX1, controlX2 } = getConnectionControls(fromX, toX);

		connectionsLayer.setStrokeStyle({
			width: width / scale,
			color,
			alpha,
		});
		connectionsLayer.moveTo(fromX, fromY);
		connectionsLayer.bezierCurveTo(controlX1, fromY, controlX2, toY, toX, toY);
		connectionsLayer.stroke();
	};

	const distanceToSegmentSquared = (
		px: number,
		py: number,
		ax: number,
		ay: number,
		bx: number,
		by: number,
	) => {
		const dx = bx - ax;
		const dy = by - ay;
		if (dx === 0 && dy === 0) {
			const deltaX = px - ax;
			const deltaY = py - ay;
			return deltaX * deltaX + deltaY * deltaY;
		}
		const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
		const clamped = Math.max(0, Math.min(1, t));
		const closestX = ax + clamped * dx;
		const closestY = ay + clamped * dy;
		const deltaX = px - closestX;
		const deltaY = py - closestY;
		return deltaX * deltaX + deltaY * deltaY;
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

	const distanceToConnectionSquared = (
		px: number,
		py: number,
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
	) => {
		const { controlX1, controlX2 } = getConnectionControls(fromX, toX);
		const samples = Math.max(4, connectionStyles.hoverSegments);
		let minDistance = Number.POSITIVE_INFINITY;
		let lastX = fromX;
		let lastY = fromY;

		for (let i = 1; i <= samples; i += 1) {
			const t = i / samples;
			const nextX = bezierPoint(t, fromX, controlX1, controlX2, toX);
			const nextY = bezierPoint(t, fromY, fromY, toY, toY);
			const segmentDistance = distanceToSegmentSquared(
				px,
				py,
				lastX,
				lastY,
				nextX,
				nextY,
			);
			if (segmentDistance < minDistance) {
				minDistance = segmentDistance;
			}
			lastX = nextX;
			lastY = nextY;
		}

		return minDistance;
	};

	const findHoveredConnection = (worldX: number, worldY: number) => {
		const scale = camera.scale.x || 1;
		const threshold = connectionStyles.hoverDistance / scale;
		const thresholdSquared = threshold * threshold;
		let closestId: string | null = null;
		let closestDistance = thresholdSquared;

		connectionState.connections.forEach((connection) => {
			const from = getNodePort(connection.from);
			const to = getNodePort(connection.to);
			if (!from || !to) {
				return;
			}

			const fromPos = getPortWorldPosition(from.node, from.port);
			const toPos = getPortWorldPosition(to.node, to.port);
			const distance = distanceToConnectionSquared(
				worldX,
				worldY,
				fromPos.x,
				fromPos.y,
				toPos.x,
				toPos.y,
			);
			if (distance <= closestDistance) {
				closestDistance = distance;
				closestId = connection.id;
			}
		});

		return closestId;
	};

	const renderConnections = () => {
		const removals: string[] = [];

		connectionsLayer.clear();

		connectionState.connections.forEach((connection) => {
			const from = getNodePort(connection.from);
			const to = getNodePort(connection.to);
			if (!from || !to) {
				removals.push(connection.id);
				return;
			}

			const fromPos = getPortWorldPosition(from.node, from.port);
			const toPos = getPortWorldPosition(to.node, to.port);
			const isHovered = connection.id === connectionState.hoverId;
			drawConnection(
				fromPos.x,
				fromPos.y,
				toPos.x,
				toPos.y,
				portTypeColors[connection.type],
				1,
				isHovered ? connectionStyles.hoverWidth : connectionStyles.width,
			);
		});

		removals.forEach((id) => {
			connectionState.connections.delete(id);
		});

		if (connectionState.active) {
			const start = getNodePort(connectionState.active.start);
			if (!start) {
				return;
			}

			const startPos = getPortWorldPosition(start.node, start.port);
			let ghostColor = portTypeColors[connectionState.active.type];
			let ghostAlpha = connectionStyles.ghostAlpha;

			if (connectionState.active.target) {
				const target = getNodePort(connectionState.active.target);
				if (target) {
					if (connectionState.active.isValid) {
						ghostColor =
							portTypeColors[
								resolveConnectionType(start.port.type, target.port.type)
							];
					} else {
						ghostColor = connectionStyles.invalidColor;
						ghostAlpha = connectionStyles.invalidAlpha;
					}
				}
			}

			drawConnection(
				startPos.x,
				startPos.y,
				connectionState.active.x,
				connectionState.active.y,
				ghostColor,
				ghostAlpha,
			);
		}
	};

	const updateSelection = (next: Set<number>) => {
		nodeState.selectedIds.forEach((id) => {
			if (!next.has(id)) {
				const node = nodeState.nodes.get(id);
				if (node) {
					renderNode(node, false);
				}
			}
		});

		next.forEach((id) => {
			if (!nodeState.selectedIds.has(id)) {
				const node = nodeState.nodes.get(id);
				if (node) {
					renderNode(node, true);
				}
			}
		});

		nodeState.selectedIds = next;
	};

	const clearSelection = () => {
		if (nodeState.selectedIds.size === 0) {
			return;
		}

		updateSelection(new Set());
	};

	const selectSingle = (id: number) => {
		if (nodeState.selectedIds.size === 1 && nodeState.selectedIds.has(id)) {
			return;
		}

		updateSelection(new Set([id]));
	};

	const toggleSelection = (id: number) => {
		const next = new Set(nodeState.selectedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}

		updateSelection(next);
	};

	const ensureSelectedForDrag = (id: number) => {
		if (!nodeState.selectedIds.has(id)) {
			selectSingle(id);
		}
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

	const findPortAt = (worldX: number, worldY: number) => {
		const threshold = portStyles.radius + 4;
		const thresholdSquared = threshold * threshold;

		for (const node of nodeState.nodes.values()) {
			for (const port of node.ports) {
				const position = getPortWorldPosition(node, port);
				const deltaX = worldX - position.x;
				const deltaY = worldY - position.y;
				if (deltaX * deltaX + deltaY * deltaY <= thresholdSquared) {
					return {
						ref: { nodeId: node.id, portId: port.id },
						port,
					};
				}
			}
		}

		return null;
	};

	const setPortDragTarget = (
		ref: PortRef,
		isTarget: boolean,
		isValid: boolean,
	) => {
		const data = getNodePort(ref);
		if (!data) {
			return;
		}

		data.port.isDragTarget = isTarget;
		data.port.isDragValid = isValid;
		renderPorts(data.node);
	};

	const clearActiveDragTarget = () => {
		const active = connectionState.active;
		if (!active?.target) {
			return;
		}

		setPortDragTarget(active.target, false, false);
	};

	const updateActiveConnectionTarget = (worldX: number, worldY: number) => {
		const active = connectionState.active;
		if (!active) {
			return;
		}

		const startData = getNodePort(active.start);
		if (!startData) {
			return;
		}

		const target = findPortAt(worldX, worldY);
		const prevTarget = active.target;
		const prevValid = active.isValid;
		let nextTarget: PortRef | null = null;
		let nextValid = false;

		if (target) {
			nextTarget = target.ref;
			const isSamePort =
				target.ref.nodeId === active.start.nodeId &&
				target.ref.portId === active.start.portId;
			nextValid =
				!isSamePort &&
				arePortTypesCompatible(startData.port.type, target.port.type) &&
				startData.port.direction !== target.port.direction;
		}

		const sameTarget =
			prevTarget &&
			nextTarget &&
			prevTarget.nodeId === nextTarget.nodeId &&
			prevTarget.portId === nextTarget.portId;

		if (!sameTarget || prevValid !== nextValid) {
			if (prevTarget) {
				setPortDragTarget(prevTarget, false, false);
			}
			if (nextTarget) {
				setPortDragTarget(nextTarget, true, nextValid);
			}
		}

		active.target = nextTarget;
		active.isValid = nextValid;
	};

	const startConnectionDrag = (
		event: FederatedPointerEvent,
		nodeId: number,
		portId: string,
	) => {
		clearActiveDragTarget();
		const node = nodeState.nodes.get(nodeId);
		if (!node) {
			return;
		}

		const port = node.ports.find((candidate) => candidate.id === portId);
		if (!port) {
			return;
		}

		connectionState.hoverId = null;
		nodeState.suppressPanPointerId = event.pointerId;

		if (interactionState.pointerId === event.pointerId) {
			interactionState.isPanning = false;
			interactionState.pointerId = null;
		}

		if (dragState.pointerId === event.pointerId) {
			dragState.isDragging = false;
			dragState.pointerId = null;
			dragState.anchorId = null;
			dragState.startPositions.clear();
		}

		const clientEvent = event as unknown as PointerEvent;
		const world = getWorldFromClient(clientEvent.clientX, clientEvent.clientY);

		connectionState.active = {
			pointerId: event.pointerId,
			start: { nodeId, portId },
			direction: port.direction,
			type: port.type,
			x: world.x,
			y: world.y,
			target: null,
			isValid: false,
		};
		canvas.setPointerCapture(event.pointerId);
	};

	const cancelConnectionDrag = () => {
		clearActiveDragTarget();
		connectionState.active = null;
	};

	const finalizeConnectionDrag = (event: PointerEvent) => {
		const active = connectionState.active;
		if (!active) {
			return;
		}

		let didChange = false;
		const world = getWorldFromClient(event.clientX, event.clientY);
		const target = findPortAt(world.x, world.y);
		const startData = getNodePort(active.start);
		if (!startData) {
			cancelConnectionDrag();
			return;
		}

		if (!target) {
			if (startData.port.direction === "input") {
				for (const [key, connection] of connectionState.connections.entries()) {
					if (
						connection.to.nodeId === active.start.nodeId &&
						connection.to.portId === active.start.portId
					) {
						connectionState.connections.delete(key);
						didChange = true;
					}
				}
			}

			cancelConnectionDrag();
			if (didChange) {
				commitHistory();
			}
			return;
		}

		if (
			target.ref.nodeId === active.start.nodeId &&
			target.ref.portId === active.start.portId
		) {
			cancelConnectionDrag();
			return;
		}

		const startPort = startData.port;
		const endPort = target.port;
		if (
			!arePortTypesCompatible(startPort.type, endPort.type) ||
			startPort.direction === endPort.direction
		) {
			cancelConnectionDrag();
			return;
		}

		const connectionType = resolveConnectionType(startPort.type, endPort.type);
		const from = startPort.direction === "output" ? active.start : target.ref;
		const to = startPort.direction === "output" ? target.ref : active.start;
		const id = `${from.nodeId}:${from.portId}->${to.nodeId}:${to.portId}`;

		for (const [key, connection] of connectionState.connections.entries()) {
			if (
				connection.to.nodeId === to.nodeId &&
				connection.to.portId === to.portId
			) {
				connectionState.connections.delete(key);
				didChange = true;
			}
		}

		connectionState.connections.set(id, {
			id,
			from,
			to,
			type: connectionType,
		});
		cancelConnectionDrag();
		didChange = true;
		if (didChange) {
			commitHistory();
		}
	};

	const startNodeDrag = (event: FederatedPointerEvent, id: number) => {
		const node = nodeState.nodes.get(id);
		if (!node) {
			return;
		}

		const clientEvent = event as unknown as PointerEvent;
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

	const createNode = (
		position: { x: number; y: number },
		options: {
			id?: number;
			title?: string;
			ports?: SerializablePort[];
			select?: boolean;
			templateId?: string;
			data?: NodeData;
		} = {},
	) => {
		const id = options.id ?? nodeState.nextId++;
		if (options.id !== undefined) {
			nodeState.nextId = Math.max(nodeState.nextId, options.id + 1);
		}
		const container = new Container();
		container.position.set(position.x, position.y);
		container.eventMode = "static";
		container.cursor = "pointer";
		container.hitArea = new Rectangle(
			0,
			0,
			nodeDimensions.width,
			nodeDimensions.height,
		);

		const background = new Graphics();
		const title = new Text({
			text: options.title ?? `Node ${id}`,
			style: {
				fill: 0x1e1e1e,
				fontFamily: "Arial",
				fontSize: 14,
			},
		});
		title.position.set(10, 8);

		const ports = options.ports ?? defaultPorts;
		const nodeData = options.data ?? getDefaultNodeData(options.templateId);

		const portViews = ports.map((port) => {
			const graphics = new Graphics();
			const label = new Text({
				text: "",
				style: {
					fill: 0x2b2b2b,
					fontFamily: "Arial",
					fontSize: 11,
				},
			});

			graphics.eventMode = "static";
			graphics.cursor = "crosshair";

			return {
				...port,
				graphics,
				label,
				isHover: false,
				isDragTarget: false,
				isDragValid: false,
			};
		});

		container.addChild(background);
		container.addChild(title);

		let valueLabel: Text | undefined;
		if (
			options.templateId === "const-float" ||
			options.templateId === "const-color" ||
			options.templateId === "const-vec2" ||
			options.templateId === "const-vec3" ||
			options.templateId === "const-vec4"
		) {
			valueLabel = new Text({
				text: "",
				style: {
					fill: 0x2b2b2b,
					fontFamily: "Arial",
					fontSize: 11,
				},
			});
			valueLabel.position.set(10, 28);
			container.addChild(valueLabel);
		}

		const node: NodeView = {
			id,
			container,
			background,
			title,
			ports: portViews,
			width: nodeDimensions.width,
			height: nodeDimensions.height,
			isHover: false,
			...(nodeData ? { data: nodeData } : {}),
			...(valueLabel ? { valueLabel } : {}),
			...(options.templateId ? { templateId: options.templateId } : {}),
		};

		portViews.forEach((port) => {
			container.addChild(port.graphics);
			container.addChild(port.label);
			port.graphics.on("pointerdown", (event) => {
				const data = event as unknown as { stopPropagation?: () => void };
				data.stopPropagation?.();
				startConnectionDrag(event, id, port.id);
			});
			port.graphics.on("pointerover", () => {
				port.isHover = true;
				renderPorts(node);
			});
			port.graphics.on("pointerout", () => {
				port.isHover = false;
				renderPorts(node);
			});
		});
		nodesLayer.addChild(container);

		nodeState.nodes.set(id, node);
		renderNode(node, false);
		renderPorts(node);
		renderConstValue(node);
		if (options.select ?? true) {
			selectSingle(id);
		}

		container.on("pointerdown", (event) => {
			startNodeDrag(event, id);
		});
		container.on("pointerover", () => {
			node.isHover = true;
			renderNode(node, nodeState.selectedIds.has(id));
		});
		container.on("pointerout", () => {
			node.isHover = false;
			renderNode(node, nodeState.selectedIds.has(id));
		});
	};

	const clearGraph = () => {
		closeConstEditor();
		updateSelection(new Set());
		cancelConnectionDrag();
		connectionState.hoverId = null;
		connectionState.connections.clear();
		connectionsLayer.clear();
		nodeState.nodes.forEach((node) => {
			node.container.destroy({ children: true });
		});
		nodeState.nodes.clear();
		nodeState.nextId = 1;
	};

	const buildGraphSnapshot = (): SerializableGraph => {
		const nodes = Array.from(nodeState.nodes.values()).map((node) => ({
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
			...(node.data ? { data: node.data } : {}),
			...(node.templateId ? { templateId: node.templateId } : {}),
		}));

		const connections = Array.from(connectionState.connections.values()).map(
			(connection) => ({
				from: connection.from,
				to: connection.to,
				type: connection.type,
			}),
		);

		return {
			version: 1,
			nodes,
			connections,
			camera: {
				pivotX: camera.pivot.x,
				pivotY: camera.pivot.y,
				scale: camera.scale.x || 1,
			},
		};
	};

	const serializeSnapshot = (snapshot: SerializableGraph) =>
		JSON.stringify(snapshot);

	const setHistoryCurrent = (snapshot: SerializableGraph) => {
		historyState.current = snapshot;
		historyState.currentSerialized = serializeSnapshot(snapshot);
	};

	commitHistory = () => {
		const snapshot = buildGraphSnapshot();
		const serialized = serializeSnapshot(snapshot);
		if (serialized === historyState.currentSerialized) {
			return;
		}

		if (historyState.current) {
			historyState.past.push(historyState.current);
		}
		historyState.future = [];
		setHistoryCurrent(snapshot);
		updateShaderFromSnapshot(snapshot);
	};

	const undoHistory = () => {
		if (!historyState.current || historyState.past.length === 0) {
			return;
		}

		const snapshot = historyState.past.pop();
		if (!snapshot) {
			return;
		}

		historyState.future.push(historyState.current);
		setHistoryCurrent(snapshot);
		applyGraphSnapshot(snapshot);
	};

	const redoHistory = () => {
		if (!historyState.current || historyState.future.length === 0) {
			return;
		}

		const snapshot = historyState.future.pop();
		if (!snapshot) {
			return;
		}

		historyState.past.push(historyState.current);
		setHistoryCurrent(snapshot);
		applyGraphSnapshot(snapshot);
	};

	const applyCameraState = (cameraState?: SerializableGraph["camera"]) => {
		if (!cameraState) {
			return;
		}

		const nextScale = Math.min(
			zoomLimits.max,
			Math.max(zoomLimits.min, cameraState.scale),
		);

		camera.scale.set(nextScale, nextScale);
		camera.pivot.x = cameraState.pivotX;
		camera.pivot.y = cameraState.pivotY;
	};

	const sanitizeGraphSnapshot = (snapshot: SerializableGraph) => {
		const nodeMap = new Map(
			snapshot.nodes.map((node) => [node.id, node] as const),
		);
		const validConnections: SerializableConnection[] = [];
		let droppedConnections = 0;

		snapshot.connections.forEach((connection) => {
			const fromNode = nodeMap.get(connection.from.nodeId);
			const toNode = nodeMap.get(connection.to.nodeId);
			const fromPort = fromNode?.ports.find(
				(port) => port.id === connection.from.portId,
			);
			const toPort = toNode?.ports.find(
				(port) => port.id === connection.to.portId,
			);

			if (!fromPort || !toPort) {
				droppedConnections += 1;
				return;
			}

			if (fromPort.direction !== "output" || toPort.direction !== "input") {
				droppedConnections += 1;
				return;
			}

			if (
				!arePortTypesCompatible(fromPort.type, connection.type) ||
				!arePortTypesCompatible(toPort.type, connection.type)
			) {
				droppedConnections += 1;
				return;
			}

			validConnections.push(connection);
		});

		const sanitizedSnapshot: SerializableGraph = {
			version: snapshot.version,
			nodes: snapshot.nodes,
			connections: validConnections,
			...(snapshot.camera ? { camera: snapshot.camera } : {}),
		};

		return { snapshot: sanitizedSnapshot, droppedConnections };
	};

	const applyGraphSnapshot = (snapshot: SerializableGraph) => {
		const { snapshot: sanitizedSnapshot, droppedConnections } =
			sanitizeGraphSnapshot(snapshot);
		clearGraph();

		sanitizedSnapshot.nodes.forEach((node) => {
			createNode(
				{ x: node.x, y: node.y },
				{
					id: node.id,
					title: node.title,
					ports: node.ports,
					...(node.data ? { data: node.data } : {}),
					...(node.templateId ? { templateId: node.templateId } : {}),
					select: false,
				},
			);
		});

		sanitizedSnapshot.connections.forEach((connection) => {
			const fromData = getNodePort(connection.from);
			const toData = getNodePort(connection.to);
			if (!fromData || !toData) {
				return;
			}

			if (
				!arePortTypesCompatible(fromData.port.type, connection.type) ||
				!arePortTypesCompatible(toData.port.type, connection.type)
			) {
				return;
			}

			if (
				fromData.port.direction !== "output" ||
				toData.port.direction !== "input"
			) {
				return;
			}

			const id = `${connection.from.nodeId}:${connection.from.portId}->${connection.to.nodeId}:${connection.to.portId}`;
			connectionState.connections.set(id, {
				id,
				from: connection.from,
				to: connection.to,
				type: connection.type,
			});
		});

		clearSelection();
		applyCameraState(sanitizedSnapshot.camera);
		updateShaderFromSnapshot(sanitizedSnapshot);
		return { snapshot: sanitizedSnapshot, droppedConnections };
	};

	updateShaderFromSnapshot = (snapshot: SerializableGraph) => {
		const onShaderChange = options.onShaderChange;
		if (!onShaderChange) {
			return;
		}

		const shaderSnapshot = {
			nodes: snapshot.nodes,
			connections: snapshot.connections,
		};
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
			onShaderChange(
				compileGraphToGlsl(nodeState.nodes, connectionState.connections),
			);
		});
	};

	const deleteSelectedNode = () => {
		if (nodeState.selectedIds.size === 0) {
			return false;
		}

		const nodesToDelete = Array.from(nodeState.selectedIds)
			.map((id) => nodeState.nodes.get(id))
			.filter((node): node is NodeView => Boolean(node));
		if (nodesToDelete.length === 0) {
			return false;
		}

		const removals: string[] = [];
		nodesToDelete.forEach((node) => {
			connectionState.connections.forEach((connection) => {
				if (
					connection.from.nodeId === node.id ||
					connection.to.nodeId === node.id
				) {
					removals.push(connection.id);
				}
			});
		});
		removals.forEach((id) => {
			connectionState.connections.delete(id);
		});

		nodesToDelete.forEach((node) => {
			node.container.destroy({ children: true });
			nodeState.nodes.delete(node.id);
		});

		clearSelection();
		return true;
	};

	const contextMenuItems: ContextMenuItem[] = [];

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

	const createNodeWithHistory = (
		position: { x: number; y: number },
		options: {
			id?: number;
			title?: string;
			ports?: SerializablePort[];
			select?: boolean;
			templateId?: string;
			data?: NodeData;
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
			ports: template.ports,
			templateId: template.id,
		});
	};

	const spawnTemplate = (template: NodeTemplate) => {
		spawnTemplateAt(
			{ x: contextMenuState.worldX, y: contextMenuState.worldY },
			template,
		);
	};

	const searchEntries: SearchEntry[] = [
		{
			id: "blank-node",
			label: "Blank Node",
			keywords: "blank node",
			action: () => createNodeWithHistory(getSpawnPosition()),
		},
		...nodeTemplates.map((template) => ({
			id: template.id,
			label: template.label,
			keywords: `${template.label} ${template.title}`,
			action: () => spawnTemplateAt(getSpawnPosition(), template),
		})),
	];

	const searchPalette = createSearchPalette({
		container: canvas.parentElement ?? document.body,
		entries: searchEntries,
	});

	const openSearchPalette = () => {
		if (searchPalette.isOpen()) {
			return;
		}
		hideContextMenu();
		closeConstEditor();
		searchPalette.open();
	};

	const hideSearchPalette = () => {
		searchPalette.close();
	};

	createContextMenuItem("add-blank", "Add Blank Node", () => {
		createNodeWithHistory({
			x: contextMenuState.worldX,
			y: contextMenuState.worldY,
		});
	});

	nodeTemplates.forEach((template) => {
		createContextMenuItem(`add-${template.id}`, `Add ${template.label}`, () => {
			spawnTemplate(template);
		});
	});

	createContextMenuItem("delete-selected", "Delete Selected", () => {
		if (deleteSelectedNode()) {
			commitHistory();
		}
	});

	const showContextMenu = (event: MouseEvent) => {
		event.preventDefault();
		closeConstEditor();

		const rect = canvas.getBoundingClientRect();
		const screenX = event.clientX - rect.left;
		const screenY = event.clientY - rect.top;
		const world = getWorldFromClient(event.clientX, event.clientY);

		contextMenuState.worldX = world.x;
		contextMenuState.worldY = world.y;

		contextMenuItems.forEach((item) => {
			if (item.id === "delete-selected") {
				setContextMenuItemEnabled(item, nodeState.selectedIds.size > 0);
			} else {
				setContextMenuItemEnabled(item, true);
			}
		});

		contextMenuState.screenX = screenX;
		contextMenuState.screenY = screenY;
		contextMenuState.isOpen = true;
		syncContextMenuState();
	};

	updateScene();
	setHistoryCurrent(buildGraphSnapshot());
	app.ticker.add(() => {
		updateScene();
		renderConnections();
	});

	const handlePointerDown = (event: PointerEvent) => {
		if (event.button !== 0) {
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
		if (!event.shiftKey) {
			clearSelection();
		}
		interactionState.isPanning = true;
		interactionState.pointerId = event.pointerId;
		interactionState.lastX = event.clientX;
		interactionState.lastY = event.clientY;
		interactionState.startPivotX = camera.pivot.x;
		interactionState.startPivotY = camera.pivot.y;
		canvas.setPointerCapture(event.pointerId);
	};

	const handlePointerMove = (event: PointerEvent) => {
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

		if (dragState.isDragging && dragState.pointerId === event.pointerId) {
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
			dragState.startPositions.clear();
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
		event.preventDefault();

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

	canvas.addEventListener("pointerdown", handlePointerDown);
	canvas.addEventListener("pointermove", handlePointerMove);
	canvas.addEventListener("pointerup", stopPanning);
	canvas.addEventListener("pointercancel", stopPanning);
	canvas.addEventListener("contextmenu", handleContextMenu);
	canvas.addEventListener("wheel", handleWheel, { passive: false });

	const exportGlsl = () => {
		const result = compileGraphToGlsl(
			nodeState.nodes,
			connectionState.connections,
		);
		if (!result.hasFragmentOutput) {
			window.alert(
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
			window.alert(
				`GLSL export failed:\n${exportErrors.map((error) => `- ${error}`).join("\n")}`,
			);
			return;
		}

		if (exportWarnings.length > 0) {
			window.alert(
				`GLSL export warnings:\n${exportWarnings.map((error) => `- ${error}`).join("\n")}`,
			);
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

		const key = event.key.toLowerCase();
		const isMeta = event.ctrlKey || event.metaKey;

		if (searchPalette.isOpen()) {
			if (key === "escape") {
				event.preventDefault();
				hideSearchPalette();
			}
			return;
		}

		if (key === "enter") {
			if (nodeState.selectedIds.size === 1) {
				const selectedId = Array.from(nodeState.selectedIds)[0];
				const node = nodeState.nodes.get(selectedId);
				if (
					node &&
					(node.templateId === "const-float" ||
						node.templateId === "const-color" ||
						node.templateId === "const-vec2" ||
						node.templateId === "const-vec3" ||
						node.templateId === "const-vec4")
				) {
					event.preventDefault();
					openConstEditor(node);
					return;
				}
			}
		}

		if (isMeta && key === "k") {
			event.preventDefault();
			openSearchPalette();
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

		if (key === "n") {
			event.preventDefault();
			createNodeWithHistory(getSpawnPosition());
		}

		if (key === "backspace" || key === "delete") {
			event.preventDefault();
			if (deleteSelectedNode()) {
				commitHistory();
			}
		}
	};

	const fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.accept = "application/json";
	fileInput.style.display = "none";
	document.body.appendChild(fileInput);

	const handleFileChange = (event: Event) => {
		const target = event.target as HTMLInputElement | null;
		const file = target?.files?.[0];
		if (!file) {
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			const text = typeof reader.result === "string" ? reader.result : "";
			if (!text) {
				window.alert("Unable to read graph file.");
				return;
			}

			let raw: unknown;
			try {
				raw = JSON.parse(text);
			} catch {
				window.alert("Invalid graph JSON.");
				return;
			}

			const snapshot = parseGraph(raw);
			if (!snapshot) {
				window.alert("Graph data is missing required fields.");
				return;
			}

			const { snapshot: sanitizedSnapshot, droppedConnections } =
				applyGraphSnapshot(snapshot);
			historyState.past = [];
			historyState.future = [];
			setHistoryCurrent(sanitizedSnapshot);
			if (droppedConnections > 0) {
				window.alert(
					`Loaded graph contained ${droppedConnections} invalid connection(s) that were removed.`,
				);
			}
		};
		reader.readAsText(file);
		target.value = "";
	};

	fileInput.addEventListener("change", handleFileChange);
	window.addEventListener("keydown", handleKeyDown);
	updateShaderFromSnapshot(buildGraphSnapshot());

	const originalDestroy = app.destroy.bind(app);
	app.destroy = () => {
		canvas.removeEventListener("pointerdown", handlePointerDown);
		canvas.removeEventListener("pointermove", handlePointerMove);
		canvas.removeEventListener("pointerup", stopPanning);
		canvas.removeEventListener("pointercancel", stopPanning);
		canvas.removeEventListener("contextmenu", handleContextMenu);
		canvas.removeEventListener("wheel", handleWheel);
		fileInput.removeEventListener("change", handleFileChange);
		fileInput.remove();
		searchPalette.dispose();
		constEditor.dispose();
		window.removeEventListener("keydown", handleKeyDown);
		originalDestroy();
	};

	const editorApp = app as EditorApp;
	editorApp.closeContextMenu = hideContextMenu;
	editorApp.exportGlsl = exportGlsl;
	return editorApp;
}
