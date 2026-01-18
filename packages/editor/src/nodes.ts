import {
	Container,
	type FederatedPointerEvent,
	Graphics,
	Rectangle,
	Text,
} from "pixi.js";
import {
	arePortTypesCompatible,
	type ConnectionState,
	type NodeCollectionState,
	type NodeDimensions,
	type PortStyles,
	resolveConnectionType,
} from "./editor-state";
import {
	getDefaultNodeState,
	getDefinitionBodyLabel,
	getDefinitionFooterLabel,
	getDefinitionSockets,
	getNodeDefinition,
} from "./node-definitions";
import type {
	DebugVisualizationState,
	NodePort,
	NodeSocket,
	NodeSocketValue,
	NodeState,
	NodeView,
	PortRef,
	PortType,
	SerializablePort,
	ShaderPerformanceWarnings,
} from "./types";
import type { NodeStyleSettings } from "./visual-settings";

type CreateNodeOptions = {
	id?: number;
	title?: string;
	ports?: SerializablePort[];
	select?: boolean;
	typeId?: string;
	state?: NodeState;
	socketValues?: Record<string, NodeSocketValue>;
};

type PortTypeColorMap = Record<PortType, number>;

type NodeSystemDeps = {
	nodesLayer: Container;
	connectionsLayer: Graphics;
	nodeState: NodeCollectionState;
	connectionState: ConnectionState;
	nodeDimensions: NodeDimensions;
	portStyles: PortStyles;
	defaultPorts: SerializablePort[];
	portTypeColors: PortTypeColorMap;
	getNodeStyles: () => NodeStyleSettings;
	registerText: (text: Text) => Text;
	onStartNodeDrag: (event: FederatedPointerEvent, nodeId: number) => void;
	onStartConnectionDrag: (
		event: FederatedPointerEvent,
		nodeId: number,
		portId: string,
	) => void;
	onCancelConnectionDrag: () => void;
	onStartSocketEdit?: (nodeId: number, portId: string) => void;
	onRequestNodeRename?: (nodeId: number) => void;
	onSocketHoverChange?: (
		state: { nodeId: number; portId: string } | null,
	) => void;
	onSocketQuickDisconnect?: (
		nodeId: number,
		portId: string,
		direction: "input" | "output",
	) => void;
	getActiveSocketEditor?: () => { nodeId: number; socketId: string } | null;
	onSelectionChange?: () => void;
	onNodeHoverChange?: (nodeId: number | null) => void;
	onConnectionsPruned?: (count: number) => void;
	getDebugState?: () => DebugVisualizationState | null;
};

export const createNodeSystem = ({
	nodesLayer,
	connectionsLayer,
	nodeState,
	connectionState,
	nodeDimensions,
	portStyles,
	defaultPorts,
	portTypeColors,
	getNodeStyles,
	registerText,
	onStartNodeDrag,
	onStartConnectionDrag,
	onCancelConnectionDrag,
	onStartSocketEdit,
	onRequestNodeRename,
	onSocketHoverChange,
	onSocketQuickDisconnect,
	getActiveSocketEditor,
	onSelectionChange,
	onNodeHoverChange,
	onConnectionsPruned,
	getDebugState,
}: NodeSystemDeps) => {
	const layoutPadding = {
		left: 10,
		right: 12,
		bottom: 14,
	};
	const headerHeight = 26;
	const footerHeight = 20;
	const maxBodyLabelWidth = 140;
	const maxFooterLabelWidth = 140;
	const maxPortLabelWidth = 120;
	const headerPadding = {
		x: 10,
		y: 6,
	};
	const bodyPaddingTop = 6;
	const footerPadding = {
		x: 10,
		y: 4,
	};
	const bodyTextColor = 0x2b2b2b;
	const footerTextColor = 0x747474;
	const portLabelTextColor = 0x2b2b2b;
	const headerMix = 0.7;
	const nodeHitPadding = Math.max(6, portStyles.hitRadius - portStyles.radius);
	const bodyTop = headerHeight + bodyPaddingTop;
	const rerouteSize = Math.max(10, portStyles.radius * 2 + 2);
	const warningBadgeRadius = 7;
	const warningBadgePadding = 6;
	const warningBadgeColor = 0xf6b44f;
	const warningBadgeTextColor = 0x1f2937;

	const formatNumber = (value: number) => {
		if (!Number.isFinite(value)) {
			return "0";
		}
		const rounded = Math.round(value * 1000) / 1000;
		return rounded.toString();
	};

	const formatColor = (color: { r: number; g: number; b: number }) => {
		const channel = (value: number) =>
			Math.min(255, Math.max(0, Math.round(value * 255)))
				.toString(16)
				.padStart(2, "0");
		return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
	};

	const formatSocketPreview = (type: PortType, value: NodeSocketValue) => {
		if (typeof value === "number") {
			return type === "int"
				? Math.round(value).toString()
				: formatNumber(value);
		}
		if (typeof value === "boolean") {
			return value ? "On" : "Off";
		}
		if (typeof value === "string") {
			return value;
		}
		if (Array.isArray(value)) {
			return value.join(", ");
		}
		if (
			typeof value === "object" &&
			value !== null &&
			"x" in value &&
			"y" in value
		) {
			const vector = value as { x: number; y: number; z?: number; w?: number };
			const axes = [
				formatNumber(vector.x),
				formatNumber(vector.y),
				...(vector.z !== undefined ? [formatNumber(vector.z)] : []),
				...(vector.w !== undefined ? [formatNumber(vector.w)] : []),
			];
			return `(${axes.join(", ")})`;
		}
		if (
			typeof value === "object" &&
			value !== null &&
			"r" in value &&
			"g" in value &&
			"b" in value
		) {
			return formatColor(value as { r: number; g: number; b: number });
		}
		return "";
	};

	const clampText = (text: Text, maxWidth: number) => {
		if (maxWidth <= 0) {
			return;
		}
		const current = text.text;
		if (typeof current !== "string") {
			return;
		}
		if (text.width <= maxWidth) {
			return;
		}
		const ellipsis = "...";
		let trimmed = current;
		while (trimmed.length > ellipsis.length && text.width > maxWidth) {
			trimmed = trimmed.slice(0, -1);
			text.text = `${trimmed}${ellipsis}`;
		}
	};

	const getPortGroupHeight = (count: number) =>
		count > 0 ? portStyles.radius * 2 + (count - 1) * portStyles.spacing : 0;

	const getOutputStartY = () => bodyTop + portStyles.radius;

	const getInputStartY = (node: NodeView, inputCount: number) => {
		const footerTop = node.height - getFooterHeight(node);
		const inputBlockHeight = getPortGroupHeight(inputCount);
		return (
			footerTop - layoutPadding.bottom - inputBlockHeight + portStyles.radius
		);
	};

	const mixColor = (color: number, mix: number, amount: number) => {
		const r = Math.round(
			((color >> 16) & 0xff) * (1 - amount) + ((mix >> 16) & 0xff) * amount,
		);
		const g = Math.round(
			((color >> 8) & 0xff) * (1 - amount) + ((mix >> 8) & 0xff) * amount,
		);
		const b = Math.round((color & 0xff) * (1 - amount) + (mix & 0xff) * amount);
		return (r << 16) | (g << 8) | b;
	};

	const headerCategoryColors: Record<string, number> = {
		Math: 0x3b82f6,
		Vector: 0x8b5cf6,
		"Texture/UV": 0xf59e0b,
		Output: 0x22c55e,
	};

	const getHeaderColor = (node: NodeView) => {
		const definition = getNodeDefinition(node.typeId ?? undefined);
		const categoryColor = definition?.category
			? headerCategoryColors[definition.category]
			: undefined;
		const primaryPort =
			node.ports.find((port) => port.direction === "output") ??
			node.ports.find((port) => port.direction === "input");
		const baseColor =
			categoryColor ??
			(primaryPort ? portTypeColors[primaryPort.type] : 0xb0b0b0);
		return mixColor(baseColor, 0xffffff, headerMix);
	};

	const getHeaderTextColor = (color: number) => {
		const r = (color >> 16) & 0xff;
		const g = (color >> 8) & 0xff;
		const b = color & 0xff;
		const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		return luminance < 140 ? 0xffffff : 0x1a1a1a;
	};

	const measureNodeWidth = (node: NodeView) => {
		if (node.typeId === "reroute") {
			return rerouteSize;
		}
		const inputs = node.ports.filter((port) => port.direction === "input");
		const outputs = node.ports.filter((port) => port.direction === "output");
		const maxInputLabelWidth = inputs.reduce(
			(max, port) => Math.max(max, port.label.width),
			0,
		);
		const maxOutputLabelWidth = outputs.reduce(
			(max, port) => Math.max(max, port.label.width),
			0,
		);
		const inputLabelX = portStyles.radius + portStyles.labelOffset;
		const titleRight =
			node.title.position.x + node.title.width + layoutPadding.right;
		const valueRight = node.valueLabel
			? node.valueLabel.position.x + node.valueLabel.width + layoutPadding.right
			: 0;
		const bodyLabelRight = node.bodyLabel
			? node.bodyLabel.position.x + node.bodyLabel.width + layoutPadding.right
			: 0;
		const inputRight = inputLabelX + maxInputLabelWidth + layoutPadding.right;
		const outputRight =
			layoutPadding.left + maxOutputLabelWidth + layoutPadding.right;

		return Math.max(
			nodeDimensions.width,
			titleRight,
			valueRight,
			bodyLabelRight,
			inputRight,
			outputRight,
		);
	};

	const getFooterHeight = (node: NodeView) => {
		const labelHeight = node.valueLabel?.height ?? 0;
		return Math.max(footerHeight, labelHeight + footerPadding.y * 2);
	};

	const measureNodeHeight = (node: NodeView) => {
		if (node.typeId === "reroute") {
			return rerouteSize;
		}
		const inputs = node.ports.filter((port) => port.direction === "input");
		const outputs = node.ports.filter((port) => port.direction === "output");
		const inputBlockHeight = getPortGroupHeight(inputs.length);
		const outputBlockHeight = getPortGroupHeight(outputs.length);
		const bodyLabelBottom = node.bodyLabel
			? bodyTop + node.bodyLabel.height
			: bodyTop;
		const outputsBottom = bodyTop + outputBlockHeight;
		const topContentBottom = Math.max(bodyLabelBottom, outputsBottom);
		const hasInputs = inputBlockHeight > 0;
		const bodyGap = hasInputs && topContentBottom > bodyTop ? 10 : 0;
		const contentBottom = hasInputs
			? topContentBottom + bodyGap + inputBlockHeight + layoutPadding.bottom
			: topContentBottom + layoutPadding.bottom;

		return Math.max(
			nodeDimensions.height,
			contentBottom + getFooterHeight(node),
		);
	};

	const positionNodeLabels = (node: NodeView, isFooterReady: boolean) => {
		const titleY = Math.max(
			4,
			Math.round((headerHeight - node.title.height) / 2),
		);
		node.title.position.set(headerPadding.x, titleY);

		if (node.bodyLabel) {
			node.bodyLabel.position.set(
				layoutPadding.left,
				headerHeight + bodyPaddingTop,
			);
		}

		if (node.valueLabel) {
			const footerY = isFooterReady
				? node.height - getFooterHeight(node) + footerPadding.y
				: headerHeight + bodyPaddingTop;
			node.valueLabel.position.set(footerPadding.x, footerY);
		}
	};

	const updateNodeLayout = (node: NodeView, isSelected: boolean) => {
		if (node.typeId === "reroute") {
			node.title.alpha = 0;
			if (node.bodyLabel) {
				node.bodyLabel.alpha = 0;
			}
			if (node.valueLabel) {
				node.valueLabel.alpha = 0;
			}
		} else {
			node.title.alpha = 1;
			if (node.bodyLabel) {
				node.bodyLabel.alpha = 1;
			}
			if (node.valueLabel) {
				node.valueLabel.alpha = 1;
			}
		}
		positionNodeLabels(node, false);
		const nextWidth = measureNodeWidth(node);
		const nextHeight = measureNodeHeight(node);
		node.width = nextWidth;
		node.height = nextHeight;
		positionNodeLabels(node, true);
		node.hitGraphics.clear();
		node.hitGraphics.rect(
			-nodeHitPadding,
			-nodeHitPadding,
			nextWidth + nodeHitPadding * 2,
			nextHeight + nodeHitPadding * 2,
		);
		node.hitGraphics.fill({ color: 0xffffff, alpha: 0 });
		node.hitGraphics.hitArea = new Rectangle(
			-nodeHitPadding,
			-nodeHitPadding,
			nextWidth + nodeHitPadding * 2,
			nextHeight + nodeHitPadding * 2,
		);
		renderNode(node, isSelected);
		renderWarningBadge(node);
		renderPorts(node);
	};

	const renderNode = (node: NodeView, isSelected: boolean) => {
		const debugState = getDebugState?.();
		const debugEnabled = Boolean(
			debugState?.enabled && debugState?.dimInactive,
		);
		const isDebugActive = debugEnabled
			? (debugState?.activeNodes.includes(node.id) ?? false)
			: true;
		const nodeAlpha = debugEnabled ? (isDebugActive ? 1 : 0.18) : 1;
		const isFocused = debugState?.focusNodeId === node.id;
		node.container.alpha = nodeAlpha;
		if (node.typeId === "reroute") {
			const port = node.ports[0];
			const baseColor = port ? portTypeColors[port.type] : 0xb0b0b0;
			const fillColor = node.isHover
				? mixColor(baseColor, 0xffffff, 0.2)
				: baseColor;
			const radius = Math.max(4, portStyles.radius - 1);
			const centerX = node.width / 2;
			const centerY = node.height / 2;

			node.background.clear();
			node.background.circle(centerX, centerY, radius);
			node.background.fill({ color: fillColor, alpha: 0.95 });

			if (isSelected) {
				node.background.setStrokeStyle({
					width: 2,
					color: getNodeStyles().selectedBorderColor,
					alpha: 1,
					cap: "round",
					join: "round",
				});
				node.background.circle(centerX, centerY, radius + 2);
				node.background.stroke();
			}
			if (isFocused) {
				node.background.setStrokeStyle({
					width: 3,
					color: 0x9cc4ff,
					alpha: 0.9,
					cap: "round",
					join: "round",
				});
				node.background.circle(centerX, centerY, radius + 4);
				node.background.stroke();
			}
			return;
		}
		const styles = getNodeStyles();
		const isHover = node.isHover && !isSelected;
		const fillColor = isHover ? styles.hoverFillColor : styles.fillColor;
		const headerBase = getHeaderColor(node);
		const headerColor = isHover
			? mixColor(headerBase, 0xffffff, 0.1)
			: headerBase;
		const cornerRadius = styles.cornerRadius;
		const selectionOutlineWidth = 2;
		const selectionOutlineOffset = selectionOutlineWidth / 2;

		node.title.style.fill = getHeaderTextColor(headerColor);
		if (node.bodyLabel) {
			node.bodyLabel.style.fill = bodyTextColor;
		}
		if (node.valueLabel) {
			node.valueLabel.style.fill = footerTextColor;
		}

		node.background.clear();
		node.background.roundRect(0, 0, node.width, node.height, cornerRadius);
		node.background.fill({ color: fillColor, alpha: 1 });
		node.background.roundRect(0, 0, node.width, headerHeight, cornerRadius);
		node.background.fill({ color: headerColor, alpha: 1 });
		node.background.rect(
			0,
			Math.max(0, headerHeight - cornerRadius),
			node.width,
			cornerRadius,
		);
		node.background.fill({ color: headerColor, alpha: 1 });

		if (isSelected) {
			node.background.setStrokeStyle({
				width: selectionOutlineWidth,
				color: styles.selectedBorderColor,
				alpha: 1,
				cap: "round",
				join: "round",
			});
			node.background.roundRect(
				-selectionOutlineOffset,
				-selectionOutlineOffset,
				node.width + selectionOutlineWidth,
				node.height + selectionOutlineWidth,
				cornerRadius + selectionOutlineOffset,
			);
			node.background.stroke();
		}
		if (isFocused) {
			node.background.setStrokeStyle({
				width: 3,
				color: 0x9cc4ff,
				alpha: 0.9,
				cap: "round",
				join: "round",
			});
			node.background.roundRect(
				-selectionOutlineOffset - 1,
				-selectionOutlineOffset - 1,
				node.width + selectionOutlineWidth + 2,
				node.height + selectionOutlineWidth + 2,
				cornerRadius + selectionOutlineOffset + 1,
			);
			node.background.stroke();
		}
	};

	const renderFooterLabel = (node: NodeView) => {
		const label = getDefinitionFooterLabel(
			node.typeId,
			node.state,
			node.socketValues,
		);
		if (node.valueLabel) {
			node.valueLabel.text = label ?? "";
			clampText(node.valueLabel, maxFooterLabelWidth);
		}
	};

	const renderBodyLabel = (node: NodeView) => {
		const label = getDefinitionBodyLabel(
			node.typeId,
			node.state,
			node.socketValues,
		);
		if (node.bodyLabel) {
			node.bodyLabel.text = label ?? "";
			clampText(node.bodyLabel, maxBodyLabelWidth);
		}
	};

	const renderWarningBadge = (node: NodeView) => {
		if (!node.warningBadge || !node.warningLabel) {
			return;
		}
		if (node.typeId === "reroute") {
			node.warningBadge.visible = false;
			node.warningLabel.visible = false;
			return;
		}
		const warnings = node.performanceWarnings ?? [];
		const hasWarning = warnings.length > 0;
		node.warningBadge.visible = hasWarning;
		node.warningLabel.visible = hasWarning;
		if (!hasWarning) {
			return;
		}
		const badgeX = Math.max(
			warningBadgePadding + warningBadgeRadius,
			node.width - warningBadgePadding - warningBadgeRadius,
		);
		const badgeY = Math.max(
			warningBadgePadding + warningBadgeRadius,
			Math.min(headerHeight / 2, headerHeight - warningBadgeRadius - 2),
		);
		node.warningBadge.clear();
		node.warningBadge.circle(badgeX, badgeY, warningBadgeRadius);
		node.warningBadge.fill({ color: warningBadgeColor, alpha: 1 });
		node.warningLabel.position.set(
			badgeX - node.warningLabel.width / 2,
			badgeY - node.warningLabel.height / 2,
		);
	};

	const renderPort = (node: NodeView, port: NodePort) => {
		const isReroute = node.typeId === "reroute";
		const activeEditor = getActiveSocketEditor?.();
		const isEditing =
			activeEditor?.nodeId === node.id && activeEditor.socketId === port.id;
		const inputCount = node.ports.filter(
			(candidate) => candidate.direction === "input",
		).length;
		const outputStartY = getOutputStartY();
		const inputStartY = getInputStartY(node, inputCount);
		const isInput = port.direction === "input";
		const x = isReroute ? node.width / 2 : isInput ? 0 : node.width;
		const y = isReroute
			? node.height / 2
			: isInput
				? inputStartY + port.directionIndex * portStyles.spacing
				: outputStartY + port.directionIndex * portStyles.spacing;
		const shouldStroke = port.isHover || port.isDragTarget;
		const radius = shouldStroke ? portStyles.hoverRadius : portStyles.radius;
		const hitRadius = Math.max(portStyles.hitRadius, radius);
		const isConnected = Array.from(connectionState.connections.values()).some(
			(connection) =>
				isInput
					? connection.to.nodeId === node.id && connection.to.portId === port.id
					: connection.from.nodeId === node.id &&
						connection.from.portId === port.id,
		);
		port.isConnected = isConnected;

		port.graphics.clear();
		const baseColor = portTypeColors[port.type];
		const strokeColor = shouldStroke
			? port.isDragTarget
				? port.isDragValid
					? portStyles.dragStrokeValid
					: portStyles.dragStrokeInvalid
				: baseColor
			: baseColor;
		const strokeAlpha = port.isDragTarget ? portStyles.dragStrokeAlpha : 0.85;
		if (isReroute) {
			if (shouldStroke || port.isDragTarget) {
				port.graphics.setStrokeStyle({
					width: shouldStroke ? portStyles.hoverStroke : 1.5,
					color: strokeColor,
					alpha: strokeAlpha,
					cap: "round",
					join: "round",
				});
				port.graphics.circle(x, y, radius);
				port.graphics.stroke();
			}
		} else {
			port.graphics.setStrokeStyle({
				width: shouldStroke ? portStyles.hoverStroke : 1.5,
				color: strokeColor,
				alpha: strokeAlpha,
				cap: "round",
				join: "round",
			});
			port.graphics.circle(x, y, radius);
			port.graphics.fill({ color: baseColor, alpha: isConnected ? 1 : 0 });
			port.graphics.stroke();
		}
		port.hitGraphics.clear();
		port.hitGraphics.circle(x, y, hitRadius);
		port.hitGraphics.fill({ color: 0xffffff, alpha: 0 });
		port.hitGraphics.hitArea = new Rectangle(
			x - hitRadius,
			y - hitRadius,
			hitRadius * 2,
			hitRadius * 2,
		);

		const baseLabel = `${port.name}: ${port.type}`;
		const canEdit =
			!isReroute && isInput && Boolean(port.uiSpec) && !isConnected;
		const shouldShowValue = canEdit && !isEditing;
		const shouldHideLabel =
			isReroute || (isConnected && !port.isHover && !isEditing);
		if (shouldShowValue) {
			const socketValue =
				node.socketValues?.[port.id] ?? port.defaultValue ?? null;
			const formatted =
				socketValue !== null ? formatSocketPreview(port.type, socketValue) : "";
			port.label.text = formatted ? `${baseLabel} = ${formatted}` : baseLabel;
		} else {
			port.label.text = baseLabel;
		}
		port.label.alpha = shouldHideLabel ? 0 : 1;
		port.label.eventMode = canEdit ? "static" : "none";
		port.label.cursor = canEdit ? "text" : "default";
		if (!isReroute) {
			clampText(port.label, maxPortLabelWidth);
		}

		if (isInput && !isReroute) {
			port.label.position.set(
				portStyles.radius + portStyles.labelOffset,
				y - portStyles.radius,
			);
		} else if (!isReroute) {
			const outputLabelX = Math.max(
				layoutPadding.left,
				node.width - layoutPadding.right - port.label.width,
			);
			port.label.position.set(outputLabelX, y - portStyles.radius);
		}
	};

	const renderPorts = (node: NodeView) => {
		node.ports.forEach((port) => {
			renderPort(node, port);
		});
	};

	const createPortViews = (
		ports: SerializablePort[],
		socketLookup?: Map<string, NodeSocket>,
	) => {
		let inputIndex = 0;
		let outputIndex = 0;
		return ports.map((port) => {
			const socket = socketLookup?.get(port.id);
			const extras: Partial<NodePort> = {};
			if (socket?.uiSpec) {
				extras.uiSpec = socket.uiSpec;
			}
			if (socket?.defaultValue !== undefined) {
				extras.defaultValue = socket.defaultValue;
			}
			if (socket?.conversionRules) {
				extras.conversionRules = socket.conversionRules;
			}
			const graphics = new Graphics();
			const hitGraphics = new Graphics();
			const label = registerText(
				new Text({
					text: "",
					style: {
						fill: portLabelTextColor,
						fontFamily: "Arial",
						fontSize: 11,
					},
				}),
			);

			graphics.eventMode = "none";
			hitGraphics.eventMode = "static";
			hitGraphics.cursor = "crosshair";
			label.text = `${port.name}: ${port.type}`;
			clampText(label, maxPortLabelWidth);
			label.eventMode = "none";

			return {
				...port,
				directionIndex:
					port.direction === "input" ? inputIndex++ : outputIndex++,
				graphics,
				hitGraphics,
				label,
				isHover: false,
				isDragTarget: false,
				isDragValid: false,
				...extras,
			};
		});
	};

	const mountPortViews = (node: NodeView, portViews: NodePort[]) => {
		portViews.forEach((port) => {
			node.container.addChild(port.hitGraphics);
			node.container.addChild(port.graphics);
			node.container.addChild(port.label);
			port.hitGraphics.on("pointerdown", (event) => {
				const data = event as unknown as {
					stopPropagation?: () => void;
					button?: number;
					ctrlKey?: boolean;
				};
				data.stopPropagation?.();
				const isRightClick =
					data.button === 2 || (data.button === 0 && data.ctrlKey);
				if (isRightClick) {
					onSocketQuickDisconnect?.(node.id, port.id, port.direction);
					return;
				}
				onStartConnectionDrag(event, node.id, port.id);
			});
			port.hitGraphics.on("pointerover", () => {
				port.isHover = true;
				renderPort(node, port);
				onSocketHoverChange?.({ nodeId: node.id, portId: port.id });
			});
			port.hitGraphics.on("pointerout", () => {
				port.isHover = false;
				renderPort(node, port);
				onSocketHoverChange?.(null);
			});
			port.label.on("pointerdown", (event) => {
				const data = event as unknown as { stopPropagation?: () => void };
				data.stopPropagation?.();
				if (port.direction === "input") {
					onStartSocketEdit?.(node.id, port.id);
				}
			});
		});
	};

	const destroyPortViews = (node: NodeView) => {
		node.ports.forEach((port) => {
			port.hitGraphics.removeAllListeners();
			node.container.removeChild(port.hitGraphics);
			node.container.removeChild(port.graphics);
			node.container.removeChild(port.label);
			port.hitGraphics.destroy();
			port.graphics.destroy();
			port.label.destroy();
		});
	};

	const getPortWorldPosition = (node: NodeView, port: NodePort) => {
		const inputCount = node.ports.filter(
			(candidate) => candidate.direction === "input",
		).length;
		const outputStartY = getOutputStartY();
		const inputStartY = getInputStartY(node, inputCount);
		const isReroute = node.typeId === "reroute";
		const y = isReroute
			? node.height / 2
			: port.direction === "input"
				? inputStartY + port.directionIndex * portStyles.spacing
				: outputStartY + port.directionIndex * portStyles.spacing;
		const x = isReroute
			? node.width / 2
			: port.direction === "input"
				? 0
				: node.width;

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
		onSelectionChange?.();
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

	const createNode = (
		position: { x: number; y: number },
		options: CreateNodeOptions = {},
	) => {
		const id = options.id ?? nodeState.nextId++;
		if (options.id !== undefined) {
			nodeState.nextId = Math.max(nodeState.nextId, options.id + 1);
		}
		const container = new Container();
		container.position.set(position.x, position.y);
		container.eventMode = "passive";

		const hitGraphics = new Graphics();
		hitGraphics.eventMode = "static";
		hitGraphics.cursor = "pointer";

		const typeId = options.typeId;
		const definition = getNodeDefinition(typeId ?? undefined);
		const background = new Graphics();
		const title = registerText(
			new Text({
				text: options.title ?? definition?.label ?? `Node ${id}`,
				style: {
					fill: 0x1e1e1e,
					fontFamily: "Arial",
					fontSize: 14,
				},
			}),
		);
		title.position.set(headerPadding.x, headerPadding.y);
		const warningBadge = new Graphics();
		const warningLabel = registerText(
			new Text({
				text: "!",
				style: {
					fill: warningBadgeTextColor,
					fontFamily: "Arial",
					fontSize: 10,
				},
			}),
		);
		warningBadge.visible = false;
		warningLabel.visible = false;

		const nodeStateValue =
			options.state ??
			(typeId ? (getDefaultNodeState(typeId) ?? undefined) : undefined);
		const sockets = typeId ? getDefinitionSockets(typeId, nodeStateValue) : [];
		const socketLookup = new Map(sockets.map((socket) => [socket.id, socket]));
		const defaultSocketValues: Record<string, NodeSocketValue> = {};
		sockets.forEach((socket) => {
			const value = socket.value ?? socket.defaultValue;
			if (value !== undefined) {
				defaultSocketValues[socket.id] = value;
			}
		});
		const socketValues = {
			...defaultSocketValues,
			...(options.socketValues ?? {}),
		};
		const ports =
			options.ports ??
			(typeId
				? sockets.map((socket) => ({
						id: socket.id,
						name: socket.label,
						type: socket.dataType,
						direction: socket.direction,
					}))
				: defaultPorts);

		const portViews = createPortViews(ports, socketLookup);

		container.addChild(hitGraphics);
		container.addChild(background);
		container.addChild(title);
		container.addChild(warningBadge);
		container.addChild(warningLabel);

		let valueLabel: Text | undefined;
		let bodyLabel: Text | undefined;
		const footerLabel = getDefinitionFooterLabel(
			typeId,
			nodeStateValue,
			socketValues,
		);
		if (footerLabel !== null) {
			valueLabel = registerText(
				new Text({
					text: "",
					style: {
						fill: footerTextColor,
						fontFamily: "Arial",
						fontSize: 10,
					},
				}),
			);
			valueLabel.position.set(footerPadding.x, headerHeight + bodyPaddingTop);
			container.addChild(valueLabel);
		}

		const bodyText = getDefinitionBodyLabel(
			typeId,
			nodeStateValue,
			socketValues,
		);
		if (bodyText !== null) {
			bodyLabel = registerText(
				new Text({
					text: "",
					style: {
						fill: bodyTextColor,
						fontFamily: "Arial",
						fontSize: 11,
					},
				}),
			);
			bodyLabel.position.set(layoutPadding.left, headerHeight + bodyPaddingTop);
			container.addChild(bodyLabel);
		}

		const node: NodeView = {
			id,
			container,
			hitGraphics,
			background,
			title,
			warningBadge,
			warningLabel,
			ports: portViews,
			width: nodeDimensions.width,
			height: nodeDimensions.height,
			isHover: false,
			...(nodeStateValue ? { state: nodeStateValue } : {}),
			...(Object.keys(socketValues).length > 0 ? { socketValues } : {}),
			...(valueLabel ? { valueLabel } : {}),
			...(bodyLabel ? { bodyLabel } : {}),
			...(typeId ? { typeId } : {}),
		};

		mountPortViews(node, portViews);
		nodesLayer.addChild(container);

		nodeState.nodes.set(id, node);
		renderPorts(node);
		renderFooterLabel(node);
		renderBodyLabel(node);
		updateNodeLayout(node, false);
		if (options.select ?? true) {
			selectSingle(id);
		}

		hitGraphics.on("pointerdown", (event) => {
			const clientEvent = event as unknown as PointerEvent;
			if (clientEvent.detail === 2 && clientEvent.button === 0) {
				const local = event as unknown as {
					getLocalPosition: (container: Container) => { x: number; y: number };
				};
				const position = local.getLocalPosition(node.container);
				if (position.y <= headerHeight) {
					onRequestNodeRename?.(id);
					return;
				}
			}
			onStartNodeDrag(event, id);
		});
		hitGraphics.on("pointerover", () => {
			node.isHover = true;
			renderNode(node, nodeState.selectedIds.has(id));
			onNodeHoverChange?.(id);
		});
		hitGraphics.on("pointerout", () => {
			node.isHover = false;
			renderNode(node, nodeState.selectedIds.has(id));
			onNodeHoverChange?.(null);
		});

		return node;
	};

	const clearGraph = () => {
		onCancelConnectionDrag();
		connectionState.hoverId = null;
		connectionState.selectedIds.clear();
		connectionState.connections.clear();
		connectionsLayer.clear();
		updateSelection(new Set());
		nodeState.nodes.forEach((node) => {
			node.container.destroy({ children: true });
		});
		nodeState.nodes.clear();
		nodeState.nextId = 1;
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
			connectionState.selectedIds.delete(id);
		});

		nodesToDelete.forEach((node) => {
			node.container.destroy({ children: true });
			nodeState.nodes.delete(node.id);
		});

		clearSelection();
		return true;
	};

	const renderAllNodes = () => {
		nodeState.nodes.forEach((node) => {
			renderBodyLabel(node);
			renderFooterLabel(node);
			updateNodeLayout(node, nodeState.selectedIds.has(node.id));
		});
	};

	const updateNodePorts = (
		nodeId: number,
		nextPorts: SerializablePort[],
		options?: { preserveNames?: boolean },
	) => {
		const node = nodeState.nodes.get(nodeId);
		if (!node) {
			return false;
		}

		const preserveNames = options?.preserveNames ?? true;
		const nextPortsWithNames = preserveNames
			? nextPorts.map((port) => {
					const existing = node.ports.find(
						(candidate) => candidate.id === port.id,
					);
					if (!existing || existing.name === port.name) {
						return port;
					}
					return { ...port, name: existing.name };
				})
			: nextPorts;

		const hasSamePorts =
			node.ports.length === nextPortsWithNames.length &&
			node.ports.every((port, index) => {
				const next = nextPortsWithNames[index];
				return (
					port.id === next.id &&
					port.name === next.name &&
					port.type === next.type &&
					port.direction === next.direction
				);
			});

		if (hasSamePorts) {
			return false;
		}

		const nextPortsById = new Map(
			nextPortsWithNames.map((port) => [port.id, port]),
		);
		const removals: string[] = [];
		const getPortForConnection = (ref: PortRef) => {
			if (ref.nodeId === nodeId) {
				return nextPortsById.get(ref.portId) ?? null;
			}
			const otherNode = nodeState.nodes.get(ref.nodeId);
			return (
				otherNode?.ports.find((candidate) => candidate.id === ref.portId) ??
				null
			);
		};
		connectionState.connections.forEach((connection, id) => {
			if (
				connection.from.nodeId !== nodeId &&
				connection.to.nodeId !== nodeId
			) {
				return;
			}

			const fromPort = getPortForConnection(connection.from);
			const toPort = getPortForConnection(connection.to);
			if (!fromPort || !toPort) {
				removals.push(id);
				return;
			}

			if (fromPort.direction !== "output" || toPort.direction !== "input") {
				removals.push(id);
				return;
			}

			if (!arePortTypesCompatible(fromPort.type, toPort.type)) {
				removals.push(id);
				return;
			}

			const nextType = resolveConnectionType(fromPort.type, toPort.type);
			if (connection.type !== nextType) {
				connection.type = nextType;
			}
		});
		removals.forEach((id) => {
			connectionState.connections.delete(id);
			connectionState.selectedIds.delete(id);
		});
		if (removals.length > 0) {
			onConnectionsPruned?.(removals.length);
		}

		destroyPortViews(node);
		const socketLookup = node.typeId
			? new Map(
					getDefinitionSockets(node.typeId, node.state).map((socket) => [
						socket.id,
						socket,
					]),
				)
			: undefined;
		const portViews = createPortViews(nextPortsWithNames, socketLookup);
		node.ports = portViews;
		mountPortViews(node, portViews);
		renderPorts(node);
		updateNodeLayout(node, nodeState.selectedIds.has(nodeId));
		return true;
	};

	const updatePerformanceWarnings = (warnings?: ShaderPerformanceWarnings) => {
		const textureSet = new Set(warnings?.textureSampleNodes ?? []);
		const mathSet = new Set(warnings?.complexMathNodes ?? []);
		nodeState.nodes.forEach((node) => {
			const nextWarnings: string[] = [];
			if (textureSet.has(node.id)) {
				nextWarnings.push("texture-sample");
			}
			if (mathSet.has(node.id)) {
				nextWarnings.push("complex-math");
			}
			node.performanceWarnings = nextWarnings;
			renderWarningBadge(node);
		});
	};

	return {
		renderNode,
		renderPorts,
		updateNodeLayout,
		renderPort,
		renderFooterLabel: (node: NodeView) => {
			renderFooterLabel(node);
			updateNodeLayout(node, nodeState.selectedIds.has(node.id));
		},
		renderBodyLabel: (node: NodeView) => {
			renderBodyLabel(node);
			updateNodeLayout(node, nodeState.selectedIds.has(node.id));
		},
		getPortWorldPosition,
		getNodePort,
		updateSelection,
		clearSelection,
		selectSingle,
		toggleSelection,
		ensureSelectedForDrag,
		updateNodeTitle: (nodeId: number, title: string) => {
			const node = nodeState.nodes.get(nodeId);
			if (!node) {
				return false;
			}
			const nextTitle = title.trim();
			if (!nextTitle || node.title.text === nextTitle) {
				return false;
			}
			node.title.text = nextTitle;
			updateNodeLayout(node, nodeState.selectedIds.has(nodeId));
			return true;
		},
		createNode,
		clearGraph,
		deleteSelectedNode,
		renderAllNodes,
		updateNodePorts,
		updatePerformanceWarnings,
	};
};
