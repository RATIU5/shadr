import { Container, type FederatedPointerEvent, Graphics, Text } from "pixi.js";
import type {
	ConnectionState,
	ConnectionStyles,
	DragState,
	InteractionState,
	NodeCollectionState,
	PortStyles,
} from "./editor-state";
import type {
	Connection,
	ConnectionDrag,
	DebugVisualizationState,
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
	labelLayer: Container;
	nodeState: NodeCollectionState;
	connectionState: ConnectionState;
	dragState: DragState;
	interactionState: InteractionState;
	portStyles: PortStyles;
	getConnectionStyles: () => ConnectionStyles;
	getFlowActive?: () => boolean;
	portTypeColors: PortTypeColorMap;
	arePortTypesCompatible: (first: PortType, second: PortType) => boolean;
	resolveConnectionType: (first: PortType, second: PortType) => PortType;
	emitUiMessage?: (tone: UiMessageTone, message: string) => void;
	getDebugState?: () => DebugVisualizationState | null;
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
	registerText: (text: Text) => Text;
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
	labelLayer,
	nodeState,
	connectionState,
	dragState,
	interactionState,
	portStyles,
	getConnectionStyles,
	getFlowActive,
	portTypeColors,
	arePortTypesCompatible,
	resolveConnectionType,
	emitUiMessage,
	getDebugState,
	getWorldFromClient,
	getNodePort,
	getPortWorldPosition,
	getPortDragView,
	registerText,
	findGroupPortAt,
	isNodeHidden,
	commitHistory,
}: ConnectionSystemDeps) => {
	const arePortsCompatible = (
		outputPort: { type: PortType; conversionRules?: PortType[] },
		inputPort: { type: PortType; conversionRules?: PortType[] },
	) => {
		if (arePortTypesCompatible(outputPort.type, inputPort.type)) {
			return true;
		}
		if (inputPort.conversionRules?.includes(outputPort.type)) {
			return true;
		}
		if (outputPort.conversionRules?.includes(inputPort.type)) {
			return true;
		}
		return false;
	};

	const findInputConnection = (ref: PortRef) => {
		for (const connection of connectionState.connections.values()) {
			if (
				connection.to.nodeId === ref.nodeId &&
				connection.to.portId === ref.portId
			) {
				return connection;
			}
		}
		return null;
	};

	const getConnectionControls = (
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
	) => {
		const deltaX = toX - fromX;
		const deltaY = Math.abs(toY - fromY);
		const absDeltaX = Math.abs(deltaX);
		const curve = Math.max(48, absDeltaX * 0.55 + deltaY * 0.15);
		const controlX1 = fromX + (deltaX >= 0 ? curve : -curve);
		const controlX2 = toX - (deltaX >= 0 ? curve : -curve);

		return { controlX1, controlX2 };
	};

	const resolveEffectiveStyle = (
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
	) => {
		const styles = getConnectionStyles();
		if (styles.lodEnabled) {
			const scale = camera.scale.x || 1;
			const screenDistance = Math.hypot(toX - fromX, toY - fromY) * scale;
			if (screenDistance >= styles.lodDistance) {
				return "straight";
			}
		}
		return styles.style;
	};

	const buildPolylinePoints = (
		style: "straight" | "step" | "orthogonal",
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
	) => {
		if (style === "straight") {
			return [
				{ x: fromX, y: fromY },
				{ x: toX, y: toY },
			];
		}

		const midX =
			style === "step"
				? (fromX + toX) / 2
				: (() => {
						const deltaX = toX - fromX;
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
						return fromX + clamped * direction;
					})();

		return [
			{ x: fromX, y: fromY },
			{ x: midX, y: fromY },
			{ x: midX, y: toY },
			{ x: toX, y: toY },
		];
	};

	const getPolylineLength = (points: Array<{ x: number; y: number }>) => {
		let length = 0;
		for (let i = 1; i < points.length; i += 1) {
			const prev = points[i - 1];
			const next = points[i];
			if (!prev || !next) {
				continue;
			}
			length += Math.hypot(next.x - prev.x, next.y - prev.y);
		}
		return length;
	};

	const getPolylinePointAt = (
		points: Array<{ x: number; y: number }>,
		distance: number,
	) => {
		let traveled = 0;
		for (let i = 1; i < points.length; i += 1) {
			const prev = points[i - 1];
			const next = points[i];
			if (!prev || !next) {
				continue;
			}
			const segmentLength = Math.hypot(next.x - prev.x, next.y - prev.y);
			if (segmentLength <= 0) {
				continue;
			}
			if (traveled + segmentLength >= distance) {
				const t = (distance - traveled) / segmentLength;
				return {
					x: prev.x + (next.x - prev.x) * t,
					y: prev.y + (next.y - prev.y) * t,
				};
			}
			traveled += segmentLength;
		}
		const last = points[points.length - 1] ?? { x: 0, y: 0 };
		return { x: last.x, y: last.y };
	};

	const averagePosition = (points: Array<{ x: number; y: number }>) => {
		if (points.length === 0) {
			return { x: 0, y: 0 };
		}
		let sumX = 0;
		let sumY = 0;
		points.forEach((point) => {
			sumX += point.x;
			sumY += point.y;
		});
		return { x: sumX / points.length, y: sumY / points.length };
	};

	type ConnectionEntryPart = {
		connection: Connection;
		from: { node: NodeView; port: NodePort };
		to: { node: NodeView; port: NodePort };
		fromPos: { x: number; y: number };
		toPos: { x: number; y: number };
	};

	type ConnectionRenderEntry = {
		id: string;
		connections: ConnectionEntryPart[];
		fromPos: { x: number; y: number };
		toPos: { x: number; y: number };
	};

	const collectConnectionEntries = (
		useBundles: boolean,
		removals: string[],
	): ConnectionRenderEntry[] => {
		if (!useBundles) {
			const entries: ConnectionRenderEntry[] = [];
			connectionState.connections.forEach((connection) => {
				const from = getNodePort(connection.from);
				const to = getNodePort(connection.to);
				if (!from || !to) {
					removals.push(connection.id);
					return;
				}
				const fromPos = getPortWorldPosition(from.node, from.port);
				const toPos = getPortWorldPosition(to.node, to.port);
				entries.push({
					id: connection.id,
					connections: [
						{
							connection,
							from,
							to,
							fromPos,
							toPos,
						},
					],
					fromPos,
					toPos,
				});
			});
			return entries;
		}

		const bundleMap = new Map<string, ConnectionRenderEntry>();
		connectionState.connections.forEach((connection) => {
			const from = getNodePort(connection.from);
			const to = getNodePort(connection.to);
			if (!from || !to) {
				removals.push(connection.id);
				return;
			}
			const fromPos = getPortWorldPosition(from.node, from.port);
			const toPos = getPortWorldPosition(to.node, to.port);
			const key = `bundle:${connection.from.nodeId}->${connection.to.nodeId}`;
			const entry = bundleMap.get(key) ?? {
				id: key,
				connections: [],
				fromPos: { x: 0, y: 0 },
				toPos: { x: 0, y: 0 },
			};
			entry.connections.push({
				connection,
				from,
				to,
				fromPos,
				toPos,
			});
			bundleMap.set(key, entry);
		});

		bundleMap.forEach((entry) => {
			const fromPositions = entry.connections.map((part) => part.fromPos);
			const toPositions = entry.connections.map((part) => part.toPos);
			entry.fromPos = averagePosition(fromPositions);
			entry.toPos = averagePosition(toPositions);
		});

		return Array.from(bundleMap.values());
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
		const style = resolveEffectiveStyle(fromX, fromY, toX, toY);
		const scale = camera.scale.x || 1;

		connectionsLayer.setStrokeStyle({
			width: (width ?? styles.width) / scale,
			color,
			alpha,
			cap: "round",
			join: "round",
		});
		connectionsLayer.moveTo(fromX, fromY);
		if (style === "curved") {
			const { controlX1, controlX2 } = getConnectionControls(
				fromX,
				fromY,
				toX,
				toY,
			);
			connectionsLayer.bezierCurveTo(
				controlX1,
				fromY,
				controlX2,
				toY,
				toX,
				toY,
			);
		} else {
			const points = buildPolylinePoints(style, fromX, fromY, toX, toY);
			for (let index = 1; index < points.length; index += 1) {
				const point = points[index];
				if (point) {
					connectionsLayer.lineTo(point.x, point.y);
				}
			}
		}
		connectionsLayer.stroke();
	};

	const colorToRgb = (color: number) => ({
		r: (color >> 16) & 0xff,
		g: (color >> 8) & 0xff,
		b: color & 0xff,
	});

	const rgbToColor = (r: number, g: number, b: number) =>
		(r << 16) + (g << 8) + b;

	const lerpColor = (from: number, to: number, t: number) => {
		const start = colorToRgb(from);
		const end = colorToRgb(to);
		const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
		return rgbToColor(
			lerp(start.r, end.r),
			lerp(start.g, end.g),
			lerp(start.b, end.b),
		);
	};

	const averageColor = (colors: number[]) => {
		if (colors.length === 0) {
			return 0xffffff;
		}
		let totalR = 0;
		let totalG = 0;
		let totalB = 0;
		colors.forEach((color) => {
			const rgb = colorToRgb(color);
			totalR += rgb.r;
			totalG += rgb.g;
			totalB += rgb.b;
		});
		const count = colors.length;
		return rgbToColor(
			Math.round(totalR / count),
			Math.round(totalG / count),
			Math.round(totalB / count),
		);
	};

	const formatPortTypeLabel = (type: PortType) => {
		switch (type) {
			case "float":
				return "Float";
			case "int":
				return "Int";
			case "vec2":
				return "Vec2";
			case "vec3":
				return "Vec3";
			case "vec4":
				return "Vec4";
			case "texture":
				return "Texture";
			case "color":
				return "Color";
		}
	};

	const connectionLabelStyle = {
		fill: 0xd7dde7,
		fontFamily: "Arial",
		fontSize: 10,
	};
	const badgeLabelStyle = {
		fill: 0x0f131c,
		fontFamily: "Arial",
		fontSize: 10,
	};
	const badgeFillColor = 0xe6edf7;
	const badgeFillAlpha = 0.92;

	const connectionLabelPool = new Map<string, Text>();
	const bundleBadgePool = new Map<
		string,
		{ container: Container; background: Graphics; label: Text }
	>();

	const getConnectionLabel = (id: string) => {
		const existing = connectionLabelPool.get(id);
		if (existing) {
			return existing;
		}
		const label = registerText(
			new Text({
				text: "",
				style: connectionLabelStyle,
			}),
		);
		label.eventMode = "none";
		labelLayer.addChild(label);
		connectionLabelPool.set(id, label);
		return label;
	};

	const getBundleBadge = (id: string) => {
		const existing = bundleBadgePool.get(id);
		if (existing) {
			return existing;
		}
		const container = new Container();
		const background = new Graphics();
		const label = registerText(
			new Text({
				text: "",
				style: badgeLabelStyle,
			}),
		);
		label.eventMode = "none";
		background.eventMode = "none";
		container.addChild(background);
		container.addChild(label);
		labelLayer.addChild(container);
		const badge = { container, background, label };
		bundleBadgePool.set(id, badge);
		return badge;
	};

	const drawGradientConnection = (
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		startColor: number,
		endColor: number,
		alpha: number,
		width?: number,
	) => {
		const styles = getConnectionStyles();
		const scale = camera.scale.x || 1;
		const segments = Math.max(6, styles.hoverSegments);
		let lastPoint = getConnectionPoint(0, fromX, fromY, toX, toY);

		for (let i = 1; i <= segments; i += 1) {
			const t = i / segments;
			const nextPoint = getConnectionPoint(t, fromX, fromY, toX, toY);
			const color = lerpColor(startColor, endColor, t);
			connectionsLayer.setStrokeStyle({
				width: (width ?? styles.width) / scale,
				color,
				alpha,
				cap: "round",
				join: "round",
			});
			connectionsLayer.moveTo(lastPoint.x, lastPoint.y);
			connectionsLayer.lineTo(nextPoint.x, nextPoint.y);
			connectionsLayer.stroke();
			lastPoint = nextPoint;
		}
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
		const style = resolveEffectiveStyle(fromX, fromY, toX, toY);
		if (style === "curved") {
			const { controlX1, controlX2 } = getConnectionControls(
				fromX,
				fromY,
				toX,
				toY,
			);
			return {
				x: bezierPoint(t, fromX, controlX1, controlX2, toX),
				y: bezierPoint(t, fromY, fromY, toY, toY),
			};
		}
		const points = buildPolylinePoints(style, fromX, fromY, toX, toY);
		const length = getPolylineLength(points);
		const targetDistance = length * t;
		return getPolylinePointAt(points, targetDistance);
	};

	const estimateConnectionLength = (
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
	) => {
		const styles = getConnectionStyles();
		const style = resolveEffectiveStyle(fromX, fromY, toX, toY);
		if (style !== "curved") {
			const points = buildPolylinePoints(style, fromX, fromY, toX, toY);
			return getPolylineLength(points);
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
		const style = resolveEffectiveStyle(fromX, fromY, toX, toY);
		if (style !== "curved") {
			const points = buildPolylinePoints(style, fromX, fromY, toX, toY);
			let minDistance = Number.POSITIVE_INFINITY;
			for (let i = 1; i < points.length; i += 1) {
				const prev = points[i - 1];
				const next = points[i];
				if (!prev || !next) {
					continue;
				}
				const distance = distanceToSegmentSquared(
					px,
					py,
					prev.x,
					prev.y,
					next.x,
					next.y,
				);
				if (distance < minDistance) {
					minDistance = distance;
				}
			}
			return minDistance;
		}
		const { controlX1, controlX2 } = getConnectionControls(
			fromX,
			fromY,
			toX,
			toY,
		);
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

		const entries = collectConnectionEntries(styles.bundleConnections, []);
		entries.forEach((entry) => {
			const distance = distanceToConnectionSquared(
				worldX,
				worldY,
				entry.fromPos.x,
				entry.fromPos.y,
				entry.toPos.x,
				entry.toPos.y,
			);
			if (distance <= closestDistance) {
				closestDistance = distance;
				closestId = entry.connections[0]?.connection.id ?? null;
			}
		});

		return closestId;
	};

	const renderConnections = () => {
		const styles = getConnectionStyles();
		const now = performance.now();
		const removals: string[] = [];
		const flowActive = styles.showFlow || getFlowActive?.();
		const debugState = getDebugState?.();
		const debugEnabled = Boolean(
			debugState?.enabled && debugState?.dimInactive,
		);
		const debugActiveSet = debugEnabled
			? new Set(debugState?.activeConnections ?? [])
			: null;
		const debugFocusSet = new Set(debugState?.focusConnectionIds ?? []);
		const emphasisActive =
			styles.emphasisMode && nodeState.selectedIds.size > 0;
		const selectedNodeIds = nodeState.selectedIds;
		const showLabels = styles.showLabels;
		const showBundles = styles.bundleConnections;
		const activeLabelIds = new Set<string>();
		const activeBadgeIds = new Set<string>();

		connectionsLayer.clear();

		const flowScale = camera.scale.x || 1;

		const entries = collectConnectionEntries(showBundles, removals);
		entries.forEach((entry) => {
			const isSelected = entry.connections.some((part) =>
				connectionState.selectedIds.has(part.connection.id),
			);
			const isDebugActive = debugEnabled
				? entry.connections.some((part) =>
						debugActiveSet?.has(part.connection.id),
					)
				: true;
			const focusBoost = entry.connections.some((part) =>
				debugFocusSet.has(part.connection.id),
			);
			const isRelatedToSelection = emphasisActive
				? entry.connections.some(
						(part) =>
							selectedNodeIds.has(part.connection.from.nodeId) ||
							selectedNodeIds.has(part.connection.to.nodeId),
					)
				: true;
			const connectionWidth = isSelected
				? styles.hoverWidth
				: focusBoost
					? styles.hoverWidth
					: styles.width;
			const baseAlpha = debugEnabled ? (isDebugActive ? 1 : 0.15) : 1;
			const emphasisAlpha = emphasisActive && !isRelatedToSelection ? 0.2 : 1;
			const connectionAlpha = baseAlpha * emphasisAlpha;
			const fromColors = entry.connections.map(
				(part) => portTypeColors[part.from.port.type],
			);
			const toColors = entry.connections.map(
				(part) => portTypeColors[part.to.port.type],
			);
			const fromColor = averageColor(fromColors);
			const toColor = averageColor(toColors);

			drawGradientConnection(
				entry.fromPos.x,
				entry.fromPos.y,
				entry.toPos.x,
				entry.toPos.y,
				fromColor,
				toColor,
				connectionAlpha,
				connectionWidth,
			);

			if (flowActive && (!debugEnabled || isDebugActive)) {
				const length = estimateConnectionLength(
					entry.fromPos.x,
					entry.fromPos.y,
					entry.toPos.x,
					entry.toPos.y,
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
							entry.fromPos.x,
							entry.fromPos.y,
							entry.toPos.x,
							entry.toPos.y,
						);
						const radius = styles.flowRadius / flowScale;
						connectionsLayer.circle(point.x, point.y, radius);
						connectionsLayer.fill({
							color: lerpColor(fromColor, toColor, t),
							alpha: styles.flowAlpha,
						});
					}
				}
			}

			if (showLabels) {
				const typeSet = new Set(
					entry.connections.map((part) => part.connection.type),
				);
				const onlyType = typeSet.values().next().value as PortType | undefined;
				const labelText =
					typeSet.size === 1 && onlyType
						? formatPortTypeLabel(onlyType)
						: "Mixed";
				const label = getConnectionLabel(entry.id);
				const scale = camera.scale.x || 1;
				const labelPoint = getConnectionPoint(
					0.5,
					entry.fromPos.x,
					entry.fromPos.y,
					entry.toPos.x,
					entry.toPos.y,
				);
				const offset = 10 / scale;
				label.text = labelText;
				label.pivot.set(label.width / 2, label.height / 2);
				label.position.set(labelPoint.x, labelPoint.y - offset);
				label.alpha = connectionAlpha;
				activeLabelIds.add(entry.id);
			}

			if (showBundles && entry.connections.length > 1) {
				const badge = getBundleBadge(entry.id);
				const scale = camera.scale.x || 1;
				const badgePoint = getConnectionPoint(
					0.5,
					entry.fromPos.x,
					entry.fromPos.y,
					entry.toPos.x,
					entry.toPos.y,
				);
				const offset = (showLabels ? 12 : 8) / scale;
				badge.label.text = `${entry.connections.length}`;
				badge.label.pivot.set(badge.label.width / 2, badge.label.height / 2);
				const radius = Math.max(badge.label.width, badge.label.height) / 2 + 4;
				badge.background.clear();
				badge.background.circle(0, 0, radius).fill({
					color: badgeFillColor,
					alpha: badgeFillAlpha,
				});
				badge.container.position.set(badgePoint.x, badgePoint.y + offset);
				badge.container.alpha = connectionAlpha;
				badge.container.visible = connectionAlpha > 0;
				activeBadgeIds.add(entry.id);
			}
		});

		removals.forEach((id) => {
			connectionState.connections.delete(id);
		});

		connectionLabelPool.forEach((label, id) => {
			label.visible = activeLabelIds.has(id);
		});
		bundleBadgePool.forEach((badge, id) => {
			badge.container.visible = activeBadgeIds.has(id);
		});

		if (connectionState.active) {
			const start = getNodePort(connectionState.active.start);
			if (!start) {
				return;
			}

			const startPos = getPortWorldPosition(start.node, start.port);
			let ghostColor = portTypeColors[connectionState.active.type];
			let ghostAlpha = styles.ghostAlpha;
			let ghostWidth: number | undefined;

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
						ghostWidth = styles.hoverWidth;
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
				ghostWidth,
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

	const restoreDetachedConnection = (active: ConnectionDrag | null) => {
		if (!active?.detached) {
			return false;
		}
		connectionState.connections.set(active.detached.id, active.detached);
		return true;
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
			const outputPort =
				startData.port.direction === "output" ? startData.port : target.port;
			const inputPort =
				startData.port.direction === "input" ? startData.port : target.port;
			nextValid =
				!isSameNode &&
				arePortsCompatible(outputPort, inputPort) &&
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

		let startRef: PortRef = { nodeId, portId };
		let startPort = port;
		let detached: Connection | undefined;

		if (port.direction === "input") {
			const existing = findInputConnection(startRef);
			if (existing) {
				const startData = getNodePort(existing.from);
				if (startData) {
					connectionState.connections.delete(existing.id);
					detached = existing;
					startRef = existing.from;
					startPort = startData.port;
				}
			}
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
			start: startRef,
			direction: startPort.direction,
			type: startPort.type,
			x: world.x,
			y: world.y,
			target: null,
			isValid: false,
			...(detached ? { detached } : {}),
		};
		canvas.setPointerCapture(event.pointerId);
	};

	const cancelConnectionDrag = (options?: { restoreDetached?: boolean }) => {
		clearActiveDragTarget();
		if (options?.restoreDetached !== false) {
			restoreDetachedConnection(connectionState.active);
		}
		connectionState.active = null;
	};

	const finalizeConnectionDrag = (event: PointerEvent) => {
		const active = connectionState.active;
		if (!active) {
			return;
		}

		const detached = active.detached;
		let didChange = false;
		const world = getWorldFromClient(event.clientX, event.clientY);
		const target = findPortAt(world.x, world.y);
		const startData = getNodePort(active.start);
		if (!startData) {
			cancelConnectionDrag();
			return;
		}

		if (!target) {
			if (detached) {
				restoreDetachedConnection(active);
				cancelConnectionDrag({ restoreDetached: false });
				return;
			}
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

			cancelConnectionDrag({ restoreDetached: false });
			if (didChange) {
				commitHistory();
			}
			return;
		}

		if (target.ref.nodeId === active.start.nodeId) {
			if (detached) {
				restoreDetachedConnection(active);
			}
			cancelConnectionDrag({ restoreDetached: false });
			return;
		}

		const startPort = startData.port;
		const endPort = target.port;
		const sameDirection = startPort.direction === endPort.direction;
		const outputPort = startPort.direction === "output" ? startPort : endPort;
		const inputPort = startPort.direction === "input" ? startPort : endPort;
		const incompatibleTypes = !arePortsCompatible(outputPort, inputPort);
		if (sameDirection || incompatibleTypes) {
			if (emitUiMessage) {
				if (sameDirection) {
					emitUiMessage("warning", "Ports must connect outputs to inputs.");
				} else {
					const outputType = outputPort.type;
					const inputType = inputPort.type;
					emitUiMessage(
						"warning",
						`Incompatible port types (${outputType} -> ${inputType}).`,
					);
				}
			}
			if (detached) {
				restoreDetachedConnection(active);
			}
			cancelConnectionDrag({ restoreDetached: false });
			return;
		}

		const connectionType = resolveConnectionType(
			outputPort.type,
			inputPort.type,
		);
		const from = startPort.direction === "output" ? active.start : target.ref;
		const to = startPort.direction === "output" ? target.ref : active.start;
		const id = `${from.nodeId}:${from.portId}->${to.nodeId}:${to.portId}`;

		if (detached && detached.id === id) {
			connectionState.connections.set(detached.id, detached);
			cancelConnectionDrag({ restoreDetached: false });
			return;
		}

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
		cancelConnectionDrag({ restoreDetached: false });
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
