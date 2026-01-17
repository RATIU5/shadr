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
	getDefinitionPorts,
	getNodeDefinition,
} from "./node-definitions";
import type {
	NodePort,
	NodeState,
	NodeView,
	PortRef,
	PortType,
	SerializablePort,
} from "./types";
import type { NodeStyleSettings } from "./visual-settings";

type CreateNodeOptions = {
	id?: number;
	title?: string;
	ports?: SerializablePort[];
	select?: boolean;
	typeId?: string;
	state?: NodeState;
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
	onSelectionChange?: () => void;
	onNodeHoverChange?: (nodeId: number | null) => void;
	onConnectionsPruned?: (count: number) => void;
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
	onSelectionChange,
	onNodeHoverChange,
	onConnectionsPruned,
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
	const headerMix = 0.7;
	const nodeHitPadding = Math.max(6, portStyles.hitRadius - portStyles.radius);
	const bodyTop = headerHeight + bodyPaddingTop;

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

	const getHeaderColor = (node: NodeView) => {
		const primaryPort =
			node.ports.find((port) => port.direction === "output") ??
			node.ports.find((port) => port.direction === "input");
		const baseColor = primaryPort ? portTypeColors[primaryPort.type] : 0xb0b0b0;
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
		renderPorts(node);
	};

	const renderNode = (node: NodeView, isSelected: boolean) => {
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
	};

	const renderFooterLabel = (node: NodeView) => {
		const label = getDefinitionFooterLabel(node.typeId, node.state);
		if (node.valueLabel) {
			node.valueLabel.text = label ?? "";
			clampText(node.valueLabel, maxFooterLabelWidth);
		}
	};

	const renderBodyLabel = (node: NodeView) => {
		const label = getDefinitionBodyLabel(node.typeId, node.state);
		if (node.bodyLabel) {
			node.bodyLabel.text = label ?? "";
			clampText(node.bodyLabel, maxBodyLabelWidth);
		}
	};

	const renderPort = (node: NodeView, port: NodePort) => {
		const inputCount = node.ports.filter(
			(candidate) => candidate.direction === "input",
		).length;
		const outputStartY = getOutputStartY();
		const inputStartY = getInputStartY(node, inputCount);
		const y =
			port.direction === "input"
				? inputStartY + port.directionIndex * portStyles.spacing
				: outputStartY + port.directionIndex * portStyles.spacing;
		const shouldStroke = port.isHover || port.isDragTarget;
		const radius = shouldStroke ? portStyles.hoverRadius : portStyles.radius;
		const hitRadius = Math.max(portStyles.hitRadius, radius);
		const isInput = port.direction === "input";
		const x = isInput ? 0 : node.width;

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
				cap: "round",
				join: "round",
			});
		}
		port.graphics.circle(x, y, radius);
		port.graphics.fill({ color: portTypeColors[port.type], alpha: 1 });
		if (shouldStroke) {
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

		port.label.text = `${port.name}: ${port.type}`;
		clampText(port.label, maxPortLabelWidth);

		if (isInput) {
			port.label.position.set(
				portStyles.radius + portStyles.labelOffset,
				y - portStyles.radius,
			);
		} else {
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

	const createPortViews = (ports: SerializablePort[]) => {
		let inputIndex = 0;
		let outputIndex = 0;
		return ports.map((port) => {
			const graphics = new Graphics();
			const hitGraphics = new Graphics();
			const label = registerText(
				new Text({
					text: "",
					style: {
						fill: portTypeColors[port.type],
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
			};
		});
	};

	const mountPortViews = (node: NodeView, portViews: NodePort[]) => {
		portViews.forEach((port) => {
			node.container.addChild(port.hitGraphics);
			node.container.addChild(port.graphics);
			node.container.addChild(port.label);
			port.hitGraphics.on("pointerdown", (event) => {
				const data = event as unknown as { stopPropagation?: () => void };
				data.stopPropagation?.();
				onStartConnectionDrag(event, node.id, port.id);
			});
			port.hitGraphics.on("pointerover", () => {
				port.isHover = true;
				renderPort(node, port);
			});
			port.hitGraphics.on("pointerout", () => {
				port.isHover = false;
				renderPort(node, port);
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
		const y =
			port.direction === "input"
				? inputStartY + port.directionIndex * portStyles.spacing
				: outputStartY + port.directionIndex * portStyles.spacing;
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

		const nodeStateValue =
			options.state ??
			(typeId ? (getDefaultNodeState(typeId) ?? undefined) : undefined);
		const ports =
			options.ports ??
			(typeId ? getDefinitionPorts(typeId, nodeStateValue) : defaultPorts);

		const portViews = createPortViews(ports);

		container.addChild(hitGraphics);
		container.addChild(background);
		container.addChild(title);

		let valueLabel: Text | undefined;
		let bodyLabel: Text | undefined;
		const footerLabel = getDefinitionFooterLabel(typeId, nodeStateValue);
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

		const bodyText = getDefinitionBodyLabel(typeId, nodeStateValue);
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
			ports: portViews,
			width: nodeDimensions.width,
			height: nodeDimensions.height,
			isHover: false,
			...(nodeStateValue ? { state: nodeStateValue } : {}),
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
			renderNode(node, nodeState.selectedIds.has(node.id));
			renderPorts(node);
			renderBodyLabel(node);
			renderFooterLabel(node);
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
		const portViews = createPortViews(nextPortsWithNames);
		node.ports = portViews;
		mountPortViews(node, portViews);
		renderPorts(node);
		updateNodeLayout(node, nodeState.selectedIds.has(nodeId));
		return true;
	};

	return {
		renderNode,
		renderPorts,
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
	};
};
