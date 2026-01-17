import type { Container, FederatedPointerEvent, Graphics } from "pixi.js";
import type {
	ConnectionState,
	ConnectionStyles,
	DragState,
	InteractionState,
	NodeCollectionState,
	PortStyles,
} from "./editor-state";
import type {
	NodePort,
	NodeView,
	PortRef,
	PortType,
	UiMessageTone,
} from "./types";

type PortTypeColorMap = Record<PortType, number>;

type ConnectionSystemDeps = {
	canvas: HTMLCanvasElement;
	camera: Container;
	connectionsLayer: Graphics;
	nodeState: NodeCollectionState;
	connectionState: ConnectionState;
	dragState: DragState;
	interactionState: InteractionState;
	portStyles: PortStyles;
	getConnectionStyles: () => ConnectionStyles;
	portTypeColors: PortTypeColorMap;
	arePortTypesCompatible: (first: PortType, second: PortType) => boolean;
	resolveConnectionType: (first: PortType, second: PortType) => PortType;
	emitUiMessage?: (tone: UiMessageTone, message: string) => void;
	getWorldFromClient: (
		clientX: number,
		clientY: number,
	) => {
		x: number;
		y: number;
	};
	getNodePort: (ref: PortRef) => { node: NodeView; port: NodePort } | null;
	getPortWorldPosition: (
		node: NodeView,
		port: NodePort,
	) => { x: number; y: number };
	getPortDragView: (ref: PortRef) => {
		port: { isDragTarget: boolean; isDragValid: boolean };
		render: () => void;
	} | null;
	findGroupPortAt?: (
		worldX: number,
		worldY: number,
	) => {
		ref: PortRef;
		port: { type: PortType; direction: "input" | "output" };
	} | null;
	isNodeHidden?: (nodeId: number) => boolean;
	commitHistory: () => void;
};

export const createConnectionSystem = ({
	canvas,
	camera,
	connectionsLayer,
	nodeState,
	connectionState,
	dragState,
	interactionState,
	portStyles,
	getConnectionStyles,
	portTypeColors,
	arePortTypesCompatible,
	resolveConnectionType,
	emitUiMessage,
	getWorldFromClient,
	getNodePort,
	getPortWorldPosition,
	getPortDragView,
	findGroupPortAt,
	isNodeHidden,
	commitHistory,
}: ConnectionSystemDeps) => {
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
		width?: number,
	) => {
		const styles = getConnectionStyles();
		const scale = camera.scale.x || 1;
		const { controlX1, controlX2 } = getConnectionControls(fromX, toX);

		connectionsLayer.setStrokeStyle({
			width: (width ?? styles.width) / scale,
			color,
			alpha,
			cap: "round",
			join: "round",
		});
		connectionsLayer.moveTo(fromX, fromY);
		if (styles.style === "straight") {
			connectionsLayer.lineTo(toX, toY);
		} else {
			connectionsLayer.bezierCurveTo(
				controlX1,
				fromY,
				controlX2,
				toY,
				toX,
				toY,
			);
		}
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

	const getConnectionPoint = (
		t: number,
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
	) => {
		const styles = getConnectionStyles();
		if (styles.style === "straight") {
			return {
				x: fromX + (toX - fromX) * t,
				y: fromY + (toY - fromY) * t,
			};
		}
		const { controlX1, controlX2 } = getConnectionControls(fromX, toX);
		return {
			x: bezierPoint(t, fromX, controlX1, controlX2, toX),
			y: bezierPoint(t, fromY, fromY, toY, toY),
		};
	};

	const estimateConnectionLength = (
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
	) => {
		const styles = getConnectionStyles();
		if (styles.style === "straight") {
			return Math.hypot(toX - fromX, toY - fromY);
		}
		const samples = Math.max(6, styles.hoverSegments);
		let length = 0;
		let lastPoint = { x: fromX, y: fromY };
		for (let i = 1; i <= samples; i += 1) {
			const t = i / samples;
			const point = getConnectionPoint(t, fromX, fromY, toX, toY);
			length += Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
			lastPoint = point;
		}
		return length;
	};

	const distanceToConnectionSquared = (
		px: number,
		py: number,
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
	) => {
		const styles = getConnectionStyles();
		if (styles.style === "straight") {
			return distanceToSegmentSquared(px, py, fromX, fromY, toX, toY);
		}
		const { controlX1, controlX2 } = getConnectionControls(fromX, toX);
		const samples = Math.max(4, styles.hoverSegments);
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

	const findPortAt = (worldX: number, worldY: number) => {
		if (findGroupPortAt) {
			const groupPort = findGroupPortAt(worldX, worldY);
			if (groupPort) {
				return groupPort;
			}
		}

		const threshold = Math.max(portStyles.hitRadius, portStyles.radius + 4);
		const thresholdSquared = threshold * threshold;

		for (const node of nodeState.nodes.values()) {
			if (isNodeHidden?.(node.id)) {
				continue;
			}
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

	const findHoveredConnection = (worldX: number, worldY: number) => {
		const styles = getConnectionStyles();
		const scale = camera.scale.x || 1;
		const baseWidth = Math.max(styles.width, styles.hoverWidth);
		const threshold = (baseWidth / 2 + styles.hoverDistance) / scale;
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
		const styles = getConnectionStyles();
		const now = performance.now();
		const removals: string[] = [];

		connectionsLayer.clear();

		const flowScale = camera.scale.x || 1;

		connectionState.connections.forEach((connection) => {
			const from = getNodePort(connection.from);
			const to = getNodePort(connection.to);
			if (!from || !to) {
				removals.push(connection.id);
				return;
			}

			const fromPos = getPortWorldPosition(from.node, from.port);
			const toPos = getPortWorldPosition(to.node, to.port);
			const isSelected = connectionState.selectedIds.has(connection.id);
			drawConnection(
				fromPos.x,
				fromPos.y,
				toPos.x,
				toPos.y,
				portTypeColors[connection.type],
				1,
				isSelected ? styles.hoverWidth : styles.width,
			);

			if (styles.showFlow) {
				const length = estimateConnectionLength(
					fromPos.x,
					fromPos.y,
					toPos.x,
					toPos.y,
				);
				if (length > 0) {
					const spacing = Math.max(6, styles.flowSpacing);
					const speed = Math.max(0, styles.flowSpeed);
					const offset = ((now / 1000) * speed) % spacing;
					const count = Math.max(1, Math.floor(length / spacing));
					for (let i = 0; i <= count; i += 1) {
						const distance = (i * spacing + offset) % length;
						const t = distance / length;
						const point = getConnectionPoint(
							t,
							fromPos.x,
							fromPos.y,
							toPos.x,
							toPos.y,
						);
						const radius = styles.flowRadius / flowScale;
						connectionsLayer.circle(point.x, point.y, radius);
						connectionsLayer.fill({
							color: portTypeColors[connection.type],
							alpha: styles.flowAlpha,
						});
					}
				}
			}
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
			let ghostAlpha = styles.ghostAlpha;

			if (connectionState.active.target) {
				const target = getNodePort(connectionState.active.target);
				if (target) {
					if (connectionState.active.isValid) {
						ghostColor =
							portTypeColors[
								resolveConnectionType(start.port.type, target.port.type)
							];
					} else {
						ghostColor = styles.invalidColor;
						ghostAlpha = styles.invalidAlpha;
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

	const setPortDragTarget = (
		ref: PortRef,
		isTarget: boolean,
		isValid: boolean,
	) => {
		const view = getPortDragView(ref);
		if (!view) {
			return;
		}

		view.port.isDragTarget = isTarget;
		view.port.isDragValid = isValid;
		view.render();
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
			const isSameNode = target.ref.nodeId === active.start.nodeId;
			nextValid =
				!isSameNode &&
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
		if (interactionState.spacePressed) {
			return;
		}

		const clientEvent = event as unknown as PointerEvent;
		if (clientEvent.button !== 0) {
			return;
		}

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
			dragState.groupId = null;
			dragState.startPositions.clear();
			dragState.groupStart = null;
		}

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

		if (target.ref.nodeId === active.start.nodeId) {
			cancelConnectionDrag();
			return;
		}

		const startPort = startData.port;
		const endPort = target.port;
		const sameDirection = startPort.direction === endPort.direction;
		const incompatibleTypes = !arePortTypesCompatible(
			startPort.type,
			endPort.type,
		);
		if (sameDirection || incompatibleTypes) {
			if (emitUiMessage) {
				if (sameDirection) {
					emitUiMessage("warning", "Ports must connect outputs to inputs.");
				} else {
					const outputType =
						startPort.direction === "output" ? startPort.type : endPort.type;
					const inputType =
						startPort.direction === "input" ? startPort.type : endPort.type;
					emitUiMessage(
						"warning",
						`Incompatible port types (${outputType} -> ${inputType}).`,
					);
				}
			}
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

	return {
		renderConnections,
		findHoveredConnection,
		updateActiveConnectionTarget,
		startConnectionDrag,
		cancelConnectionDrag,
		finalizeConnectionDrag,
	};
};
