import {
	Container,
	type FederatedPointerEvent,
	Graphics,
	Rectangle,
	Text,
} from "pixi.js";
import type {
	ConnectionState,
	GroupState,
	NodeCollectionState,
	NodeDimensions,
	PortStyles,
} from "./editor-state";
import type { GroupPort, GroupView, PortRef, PortType } from "./types";
import type { GroupStyleSettings } from "./visual-settings";

type PortTypeColorMap = Record<PortType, number>;

type GroupSystemDeps = {
	groupLayer: Container;
	nodeState: NodeCollectionState;
	groupState: GroupState;
	connectionState: ConnectionState;
	nodeDimensions: NodeDimensions;
	portStyles: PortStyles;
	portTypeColors: PortTypeColorMap;
	getGroupStyles: () => GroupStyleSettings;
	registerText: (text: Text) => Text;
	onStartGroupDrag: (event: FederatedPointerEvent, groupId: number) => void;
	onStartConnectionDrag: (
		event: FederatedPointerEvent,
		nodeId: number,
		portId: string,
	) => void;
	onSelectGroup: (groupId: number, event: FederatedPointerEvent) => void;
	onToggleGroupCollapsed: (groupId: number) => void;
};

const groupPadding = 20;
const groupHeaderHeight = 26;
const groupMinWidth = 220;

type GroupBounds = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};

export const maxGroupDepth = 10;

export const createGroupSystem = ({
	groupLayer,
	nodeState,
	groupState,
	connectionState,
	nodeDimensions,
	portStyles,
	portTypeColors,
	getGroupStyles,
	registerText,
	onStartGroupDrag,
	onStartConnectionDrag,
	onSelectGroup,
	onToggleGroupCollapsed,
}: GroupSystemDeps) => {
	const groupHitPadding = Math.max(6, portStyles.hitRadius - portStyles.radius);
	const groupBackgroundHitPadding = 6;
	const getGroupDepth = (groupId: number) => {
		let depth = 1;
		let current = groupState.groups.get(groupId);
		const visited = new Set<number>();
		while (current && current.parentId !== null) {
			if (visited.has(current.parentId)) {
				break;
			}
			visited.add(current.parentId);
			const parent = groupState.groups.get(current.parentId);
			if (!parent) {
				break;
			}
			depth += 1;
			current = parent;
		}
		return depth;
	};
	const getGroupAncestors = (groupId: number) => {
		const ancestors: number[] = [];
		let current = groupState.groups.get(groupId);
		const visited = new Set<number>();
		while (current && current.parentId !== null) {
			if (visited.has(current.parentId)) {
				break;
			}
			visited.add(current.parentId);
			const parent = groupState.groups.get(current.parentId);
			if (!parent) {
				break;
			}
			ancestors.push(parent.id);
			current = parent;
		}
		return ancestors;
	};
	const getGroupSubtreeDepth = (groupId: number): number => {
		const group = groupState.groups.get(groupId);
		if (!group) {
			return 1;
		}
		let maxDepth = 1;
		group.childGroupIds.forEach((childId) => {
			const childDepth = 1 + getGroupSubtreeDepth(childId);
			if (childDepth > maxDepth) {
				maxDepth = childDepth;
			}
		});
		return maxDepth;
	};
	const isGroupHidden = (groupId: number) => {
		let current = groupState.groups.get(groupId);
		const visited = new Set<number>();
		while (current && current.parentId !== null) {
			if (visited.has(current.parentId)) {
				break;
			}
			visited.add(current.parentId);
			const parent = groupState.groups.get(current.parentId);
			if (!parent) {
				break;
			}
			if (parent.collapsed) {
				return true;
			}
			current = parent;
		}
		return false;
	};
	const getGroupNodeIds = (groupId: number) => {
		const group = groupState.groups.get(groupId);
		if (!group) {
			return [];
		}
		const nodes = new Set<number>(group.nodeIds);
		const stack = Array.from(group.childGroupIds);
		while (stack.length > 0) {
			const nextId = stack.pop();
			if (typeof nextId !== "number") {
				continue;
			}
			const child = groupState.groups.get(nextId);
			if (!child) {
				continue;
			}
			child.nodeIds.forEach((nodeId) => {
				nodes.add(nodeId);
			});
			child.childGroupIds.forEach((childId) => {
				stack.push(childId);
			});
		}
		return Array.from(nodes);
	};
	const canSetGroupParent = (childId: number, parentId: number | null) => {
		if (childId === parentId) {
			return { ok: false, reason: "A group cannot contain itself." };
		}
		if (parentId !== null) {
			let current = groupState.groups.get(parentId);
			const visited = new Set<number>();
			while (current) {
				if (current.id === childId) {
					return { ok: false, reason: "A group cannot contain its parent." };
				}
				if (current.parentId === null) {
					break;
				}
				if (visited.has(current.parentId)) {
					break;
				}
				visited.add(current.parentId);
				current = groupState.groups.get(current.parentId);
			}
		}
		const parentDepth = parentId !== null ? getGroupDepth(parentId) : 0;
		const subtreeDepth = getGroupSubtreeDepth(childId);
		if (parentDepth + subtreeDepth > maxGroupDepth) {
			return {
				ok: false,
				reason: `Group nesting limit (${maxGroupDepth}) reached.`,
			};
		}
		return { ok: true };
	};
	const setGroupParent = (childId: number, parentId: number | null) => {
		const child = groupState.groups.get(childId);
		if (!child) {
			return;
		}
		if (child.parentId === parentId) {
			return;
		}
		if (child.parentId !== null) {
			const prevParent = groupState.groups.get(child.parentId);
			prevParent?.childGroupIds.delete(childId);
		}
		child.parentId = parentId;
		if (parentId !== null) {
			const parent = groupState.groups.get(parentId);
			parent?.childGroupIds.add(childId);
		}
		updateGroupVisibility();
	};
	const updateGroupVisibility = () => {
		groupState.groups.forEach((group) => {
			group.container.visible = !isGroupHidden(group.id);
		});
		nodeState.nodes.forEach((node) => {
			node.container.visible = !isNodeHidden(node.id);
		});
	};
	const getGroupBounds = (group: GroupView): GroupBounds | null => {
		const nodes = Array.from(group.nodeIds)
			.map((id) => nodeState.nodes.get(id))
			.filter((node): node is NonNullable<typeof node> => Boolean(node));
		const childGroups = Array.from(group.childGroupIds)
			.map((id) => groupState.groups.get(id))
			.filter((child): child is GroupView => Boolean(child));

		if (nodes.length === 0 && childGroups.length === 0) {
			return null;
		}

		const initial = nodes[0]
			? {
					minX: nodes[0].container.position.x,
					minY: nodes[0].container.position.y,
					maxX: nodes[0].container.position.x + nodes[0].width,
					maxY: nodes[0].container.position.y + nodes[0].height,
				}
			: {
					minX: childGroups[0].container.position.x,
					minY: childGroups[0].container.position.y,
					maxX: childGroups[0].container.position.x + childGroups[0].width,
					maxY: childGroups[0].container.position.y + childGroups[0].height,
				};

		const nodeBounds = nodes.reduce<GroupBounds>((acc, node) => {
			const x = node.container.position.x;
			const y = node.container.position.y;
			return {
				minX: Math.min(acc.minX, x),
				minY: Math.min(acc.minY, y),
				maxX: Math.max(acc.maxX, x + node.width),
				maxY: Math.max(acc.maxY, y + node.height),
			};
		}, initial);

		return childGroups.reduce<GroupBounds>((acc, child) => {
			const x = child.container.position.x;
			const y = child.container.position.y;
			return {
				minX: Math.min(acc.minX, x),
				minY: Math.min(acc.minY, y),
				maxX: Math.max(acc.maxX, x + child.width),
				maxY: Math.max(acc.maxY, y + child.height),
			};
		}, nodeBounds);
	};

	const buildGroupPortSpecs = (group: GroupView) => {
		const specs = new Map<
			string,
			Pick<GroupPort, "id" | "name" | "type" | "direction" | "target">
		>();
		const nodeIds = getGroupNodeIds(group.id);
		const nodeIdSet = new Set(nodeIds);

		const addSpec = (
			nodeId: number,
			portId: string,
			direction: "input" | "output",
		) => {
			const node = nodeState.nodes.get(nodeId);
			if (!node) {
				return;
			}
			const port = node.ports.find((candidate) => candidate.id === portId);
			if (!port) {
				return;
			}
			const key = `${direction}:${nodeId}:${portId}`;
			if (specs.has(key)) {
				return;
			}
			specs.set(key, {
				id: `${nodeId}:${portId}`,
				name: `${node.title.text}.${port.name}`,
				type: port.type,
				direction,
				target: { nodeId, portId },
			});
		};

		connectionState.connections.forEach((connection) => {
			const fromInside = nodeIdSet.has(connection.from.nodeId);
			const toInside = nodeIdSet.has(connection.to.nodeId);
			if (fromInside && !toInside) {
				addSpec(connection.from.nodeId, connection.from.portId, "output");
				return;
			}
			if (toInside && !fromInside) {
				addSpec(connection.to.nodeId, connection.to.portId, "input");
			}
		});

		const ordered = Array.from(specs.values());
		ordered.sort((a, b) => {
			if (a.direction !== b.direction) {
				return a.direction === "input" ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});
		return ordered;
	};

	const isPortConnected = (port: GroupPort) =>
		Array.from(connectionState.connections.values()).some((connection) =>
			port.direction === "input"
				? connection.to.nodeId === port.target.nodeId &&
					connection.to.portId === port.target.portId
				: connection.from.nodeId === port.target.nodeId &&
					connection.from.portId === port.target.portId,
		);

	const renderGroupPorts = (group: GroupView) => {
		if (!group.collapsed) {
			return;
		}

		const inputs = group.ports.filter((port) => port.direction === "input");
		const outputs = group.ports.filter((port) => port.direction === "output");

		inputs.forEach((port, index) => {
			const y = portStyles.startY + index * portStyles.spacing;
			const shouldStroke = port.isHover || port.isDragTarget;
			const radius = shouldStroke ? portStyles.hoverRadius : portStyles.radius;
			const hitRadius = Math.max(portStyles.hitRadius, radius);
			const isConnected = isPortConnected(port);
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
			port.graphics.circle(0, y, radius);
			port.graphics.fill({
				color: portTypeColors[port.type],
				alpha: isConnected ? 1 : 0,
			});
			if (shouldStroke) {
				port.graphics.stroke();
			}
			port.hitGraphics.clear();
			port.hitGraphics.circle(0, y, hitRadius);
			port.hitGraphics.fill({ color: 0xffffff, alpha: 0 });
			port.hitGraphics.hitArea = new Rectangle(
				-hitRadius,
				y - hitRadius,
				hitRadius * 2,
				hitRadius * 2,
			);
			port.label.text = `${port.name}: ${port.type}`;
			port.label.position.set(
				portStyles.radius + portStyles.labelOffset,
				y - portStyles.radius,
			);
			port.label.alpha = isConnected && !port.isHover ? 0 : 1;
		});

		outputs.forEach((port, index) => {
			const y = portStyles.startY + index * portStyles.spacing;
			const shouldStroke = port.isHover || port.isDragTarget;
			const radius = shouldStroke ? portStyles.hoverRadius : portStyles.radius;
			const hitRadius = Math.max(portStyles.hitRadius, radius);
			const isConnected = isPortConnected(port);
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
			port.graphics.circle(group.width, y, radius);
			port.graphics.fill({
				color: portTypeColors[port.type],
				alpha: isConnected ? 1 : 0,
			});
			if (shouldStroke) {
				port.graphics.stroke();
			}
			port.hitGraphics.clear();
			port.hitGraphics.circle(group.width, y, hitRadius);
			port.hitGraphics.fill({ color: 0xffffff, alpha: 0 });
			port.hitGraphics.hitArea = new Rectangle(
				group.width - hitRadius,
				y - hitRadius,
				hitRadius * 2,
				hitRadius * 2,
			);
			port.label.text = `${port.name}: ${port.type}`;
			port.label.position.set(
				group.width - portStyles.outputLabelOffset,
				y - 6,
			);
			port.label.alpha = isConnected && !port.isHover ? 0 : 1;
		});
	};

	const syncGroupPorts = (group: GroupView) => {
		if (!group.collapsed) {
			return;
		}

		const specs = buildGroupPortSpecs(group);
		const nextKeys = specs.map((spec) => spec.id);
		const sameKeys =
			group.portKeys.length === nextKeys.length &&
			group.portKeys.every((key, index) => key === nextKeys[index]);

		if (sameKeys) {
			let inputIndex = 0;
			let outputIndex = 0;
			group.ports.forEach((port) => {
				const spec = specs.find((candidate) => candidate.id === port.id);
				if (spec) {
					port.name = spec.name;
					port.type = spec.type;
					port.direction = spec.direction;
					port.directionIndex =
						spec.direction === "input" ? inputIndex++ : outputIndex++;
					port.target = spec.target;
				}
			});
			return;
		}

		group.ports.forEach((port) => {
			group.container.removeChild(port.hitGraphics);
			group.container.removeChild(port.graphics);
			group.container.removeChild(port.label);
			port.hitGraphics.destroy();
			port.graphics.destroy();
			port.label.destroy();
		});
		group.ports = [];
		group.portKeys = nextKeys;

		let inputIndex = 0;
		let outputIndex = 0;
		specs.forEach((spec) => {
			const graphics = new Graphics();
			const hitGraphics = new Graphics();
			const label = registerText(
				new Text({
					text: "",
					style: {
						fill: 0x2b2b2b,
						fontFamily: "Arial",
						fontSize: 11,
					},
				}),
			);
			graphics.eventMode = "none";
			hitGraphics.eventMode = "static";
			hitGraphics.cursor = "crosshair";
			const port: GroupPort = {
				...spec,
				directionIndex:
					spec.direction === "input" ? inputIndex++ : outputIndex++,
				graphics,
				hitGraphics,
				label,
				isHover: false,
				isDragTarget: false,
				isDragValid: false,
			};
			hitGraphics.on("pointerdown", (event) => {
				const data = event as unknown as { stopPropagation?: () => void };
				data.stopPropagation?.();
				onStartConnectionDrag(event, spec.target.nodeId, spec.target.portId);
			});
			hitGraphics.on("pointerover", () => {
				port.isHover = true;
				renderGroupPorts(group);
			});
			hitGraphics.on("pointerout", () => {
				port.isHover = false;
				renderGroupPorts(group);
			});
			group.container.addChild(hitGraphics);
			group.container.addChild(graphics);
			group.container.addChild(label);
			group.ports.push(port);
		});
	};

	const teardownCollapsedPortVisuals = (group: GroupView) => {
		if (group.ports.length === 0) {
			return;
		}
		group.ports.forEach((port) => {
			group.container.removeChild(port.hitGraphics);
			group.container.removeChild(port.graphics);
			group.container.removeChild(port.label);
			port.hitGraphics.destroy();
			port.graphics.destroy();
			port.label.destroy();
		});
		group.ports = [];
		group.portKeys = [];
	};

	const renderGroup = (group: GroupView, isSelected: boolean) => {
		const styles = getGroupStyles();
		const isHover = group.isHover && !isSelected;
		const borderColor = isSelected
			? styles.selectedBorderColor
			: isHover
				? styles.hoverBorderColor
				: styles.borderColor;
		const baseFillColor = group.color ?? styles.fillColor;
		const fillAlpha = group.collapsed
			? styles.collapsedFillAlpha
			: styles.fillAlpha;
		const fillColor = group.collapsed
			? (group.color ?? styles.collapsedFillColor)
			: baseFillColor;
		const borderWidth = group.collapsed
			? styles.collapsedBorderWidth
			: styles.borderWidth;

		group.background.clear();
		group.background.setStrokeStyle({
			width: borderWidth,
			color: borderColor,
			alpha: group.collapsed ? 1 : 0.7,
			cap: "round",
			join: "round",
		});
		group.background.rect(0, 0, group.width, group.height);
		group.background.fill({ color: fillColor, alpha: fillAlpha });
		group.background.stroke();

		group.title.text = group.label;
		group.title.position.set(10, 6);
	};

	const updateGroupLayout = (group: GroupView) => {
		if (group.collapsed) {
			syncGroupPorts(group);
			const inputs = group.ports.filter((port) => port.direction === "input");
			const outputs = group.ports.filter((port) => port.direction === "output");
			const maxPorts = Math.max(inputs.length, outputs.length, 1);
			group.width = Math.max(groupMinWidth, nodeDimensions.width + 40);
			group.height = Math.max(
				nodeDimensions.height,
				portStyles.startY + (maxPorts - 1) * portStyles.spacing + 28,
			);
			group.container.position.set(
				group.collapsedPosition.x,
				group.collapsedPosition.y,
			);
			group.hitGraphics.clear();
			group.hitGraphics.rect(
				-groupHitPadding,
				-groupHitPadding,
				group.width + groupHitPadding * 2,
				group.height + groupHitPadding * 2,
			);
			group.hitGraphics.fill({ color: 0xffffff, alpha: 0 });
			group.hitGraphics.hitArea = new Rectangle(
				-groupHitPadding,
				-groupHitPadding,
				group.width + groupHitPadding * 2,
				group.height + groupHitPadding * 2,
			);
			group.hitGraphics.eventMode = "static";
			group.hitGraphics.cursor = "move";
			group.container.eventMode = "passive";
			renderGroup(group, groupState.selectedIds.has(group.id));
			renderGroupPorts(group);
			return;
		}

		const bounds = getGroupBounds(group);
		if (!bounds) {
			return;
		}

		const width = bounds.maxX - bounds.minX + groupPadding * 2;
		const height =
			bounds.maxY - bounds.minY + groupPadding * 2 + groupHeaderHeight;
		group.width = Math.max(width, groupMinWidth);
		group.height = Math.max(height, groupHeaderHeight + 20);
		group.container.position.set(
			bounds.minX - groupPadding,
			bounds.minY - groupPadding - groupHeaderHeight,
		);
		group.collapsedPosition = {
			x: bounds.minX - groupPadding,
			y: bounds.minY - groupPadding,
		};
		group.hitGraphics.clear();
		group.hitGraphics.rect(
			-groupBackgroundHitPadding,
			-groupBackgroundHitPadding,
			group.width + groupBackgroundHitPadding * 2,
			group.height + groupBackgroundHitPadding * 2,
		);
		group.hitGraphics.fill({ color: 0xffffff, alpha: 0 });
		group.hitGraphics.hitArea = new Rectangle(
			-groupBackgroundHitPadding,
			-groupBackgroundHitPadding,
			group.width + groupBackgroundHitPadding * 2,
			group.height + groupBackgroundHitPadding * 2,
		);
		group.hitGraphics.eventMode = "static";
		group.hitGraphics.cursor = "move";
		group.container.eventMode = "passive";
		renderGroup(group, groupState.selectedIds.has(group.id));
	};

	const updateAllGroupLayouts = () => {
		const ordered = Array.from(groupState.groups.values()).sort(
			(a, b) => getGroupDepth(b.id) - getGroupDepth(a.id),
		);
		ordered.forEach((group) => {
			updateGroupLayout(group);
		});
	};

	const setGroupCollapsed = (group: GroupView, collapsed: boolean) => {
		if (group.collapsed === collapsed) {
			return;
		}
		group.collapsed = collapsed;
		if (!collapsed) {
			teardownCollapsedPortVisuals(group);
		}
		updateGroupVisibility();
		updateGroupLayout(group);
	};

	const createGroup = (
		nodeIds: number[],
		options: {
			id?: number;
			title?: string;
			collapsed?: boolean;
			x?: number;
			y?: number;
			parentId?: number | null;
			childGroupIds?: number[];
			color?: number | null;
		} = {},
	) => {
		const id = options.id ?? groupState.nextId++;
		if (options.id !== undefined) {
			groupState.nextId = Math.max(groupState.nextId, options.id + 1);
		}

		const container = new Container();
		container.eventMode = "passive";
		const background = new Graphics();
		const hitGraphics = new Graphics();
		const label = options.title ?? `Group ${id}`;
		const title = registerText(
			new Text({
				text: label,
				style: {
					fill: 0x1e1e1e,
					fontFamily: "Arial",
					fontSize: 13,
				},
			}),
		);
		title.eventMode = "static";
		title.cursor = "pointer";
		hitGraphics.eventMode = "static";
		hitGraphics.cursor = "move";
		container.addChild(hitGraphics);
		container.addChild(background);
		container.addChild(title);
		groupLayer.addChild(container);

		const group: GroupView = {
			id,
			container,
			hitGraphics,
			background,
			title,
			label,
			color: options.color ?? null,
			ports: [],
			width: groupMinWidth,
			height: nodeDimensions.height,
			isHover: false,
			nodeIds: new Set(nodeIds),
			childGroupIds: new Set(options.childGroupIds ?? []),
			parentId: options.parentId ?? null,
			collapsed: options.collapsed ?? false,
			collapsedPosition: { x: 0, y: 0 },
			portKeys: [],
		};

		hitGraphics.on("pointerdown", (event) => {
			onSelectGroup(group.id, event);
			const clientEvent = event as unknown as PointerEvent;
			if (clientEvent.detail === 2) {
				onToggleGroupCollapsed(group.id);
				return;
			}
			onStartGroupDrag(event, group.id);
		});
		hitGraphics.on("pointerover", () => {
			group.isHover = true;
			renderGroup(group, groupState.selectedIds.has(group.id));
		});
		hitGraphics.on("pointerout", () => {
			group.isHover = false;
			renderGroup(group, groupState.selectedIds.has(group.id));
		});
		title.on("pointerdown", (event) => {
			const data = event as unknown as { stopPropagation?: () => void };
			data.stopPropagation?.();
			onSelectGroup(group.id, event);
			onStartGroupDrag(event, group.id);
		});

		groupState.groups.set(id, group);
		group.nodeIds.forEach((nodeId) => {
			groupState.nodeToGroup.set(nodeId, id);
		});
		if (group.parentId !== null) {
			const parent = groupState.groups.get(group.parentId);
			parent?.childGroupIds.add(group.id);
			group.nodeIds.forEach((nodeId) => {
				parent?.nodeIds.delete(nodeId);
			});
		}
		group.childGroupIds.forEach((childId) => {
			const child = groupState.groups.get(childId);
			if (child) {
				if (child.parentId !== null) {
					const previousParent = groupState.groups.get(child.parentId);
					previousParent?.childGroupIds.delete(childId);
				}
				child.parentId = group.id;
			}
		});

		const bounds = getGroupBounds(group);
		if (bounds) {
			group.collapsedPosition = {
				x: bounds.minX - groupPadding,
				y: bounds.minY - groupPadding,
			};
		}
		if (typeof options.x === "number" && typeof options.y === "number") {
			group.collapsedPosition = { x: options.x, y: options.y };
		}

		setGroupCollapsed(group, options.collapsed ?? false);
		updateGroupVisibility();
		return group;
	};

	const clearGroupSelection = () => {
		groupState.selectedIds.clear();
		groupState.groups.forEach((group) => {
			renderGroup(group, false);
		});
	};

	const selectGroup = (id: number, append: boolean) => {
		if (!append) {
			clearGroupSelection();
		}
		groupState.selectedIds.add(id);
		const group = groupState.groups.get(id);
		if (group) {
			renderGroup(group, true);
		}
	};

	const removeGroup = (group: GroupView) => {
		if (group.parentId !== null) {
			const parent = groupState.groups.get(group.parentId);
			parent?.childGroupIds.delete(group.id);
		}
		group.nodeIds.forEach((nodeId) => {
			groupState.nodeToGroup.delete(nodeId);
			const node = nodeState.nodes.get(nodeId);
			if (node) {
				node.container.visible = true;
			}
		});
		group.container.destroy({ children: true });
		groupState.groups.delete(group.id);
		groupState.selectedIds.delete(group.id);
	};

	const clearGroups = () => {
		groupState.groups.forEach((group) => {
			group.container.destroy({ children: true });
		});
		groupState.groups.clear();
		groupState.selectedIds.clear();
		groupState.nodeToGroup.clear();
	};

	const deleteGroups = (groupIds: number[]) => {
		const removals = new Set<number>();
		groupIds.forEach((id) => {
			if (groupState.groups.has(id)) {
				removals.add(id);
			}
		});
		const queue = Array.from(removals);
		while (queue.length > 0) {
			const id = queue.pop();
			if (typeof id !== "number") {
				continue;
			}
			const group = groupState.groups.get(id);
			if (!group) {
				continue;
			}
			group.childGroupIds.forEach((childId) => {
				if (!removals.has(childId)) {
					removals.add(childId);
					queue.push(childId);
				}
			});
		}
		removals.forEach((id) => {
			const group = groupState.groups.get(id);
			if (!group) {
				return;
			}
			group.nodeIds.forEach((nodeId) => {
				const node = nodeState.nodes.get(nodeId);
				if (node) {
					node.container.destroy({ children: true });
				}
				nodeState.nodes.delete(nodeId);
				groupState.nodeToGroup.delete(nodeId);
			});
		});
		removals.forEach((id) => {
			const group = groupState.groups.get(id);
			if (!group) {
				return;
			}
			group.childGroupIds.forEach((childId) => {
				const child = groupState.groups.get(childId);
				if (child) {
					child.parentId = null;
				}
			});
			group.childGroupIds.clear();
			removeGroup(group);
		});
	};

	const ungroupGroups = (groupIds: number[]) => {
		groupIds.forEach((id) => {
			const group = groupState.groups.get(id);
			if (group) {
				const parentId = group.parentId;
				if (parentId !== null) {
					const parent = groupState.groups.get(parentId);
					group.nodeIds.forEach((nodeId) => {
						parent?.nodeIds.add(nodeId);
						groupState.nodeToGroup.set(nodeId, parentId);
					});
				} else {
					group.nodeIds.forEach((nodeId) => {
						groupState.nodeToGroup.delete(nodeId);
					});
				}
				group.nodeIds.clear();
				group.childGroupIds.forEach((childId) => {
					setGroupParent(childId, parentId);
				});
				removeGroup(group);
			}
		});
		updateGroupVisibility();
	};

	const removeNodesFromGroups = (nodeIds: number[]) => {
		const groupsToCheck = new Set<number>();
		nodeIds.forEach((nodeId) => {
			const groupId = groupState.nodeToGroup.get(nodeId);
			if (groupId !== undefined) {
				groupState.nodeToGroup.delete(nodeId);
				groupsToCheck.add(groupId);
			}
		});

		groupsToCheck.forEach((groupId) => {
			const group = groupState.groups.get(groupId);
			if (!group) {
				return;
			}
			nodeIds.forEach((nodeId) => {
				group.nodeIds.delete(nodeId);
			});
			if (group.nodeIds.size === 0 && group.childGroupIds.size === 0) {
				removeGroup(group);
				return;
			}
			updateGroupLayout(group);
		});
	};

	const getGroupForNode = (nodeId: number) =>
		groupState.nodeToGroup.get(nodeId);

	const isNodeHidden = (nodeId: number) => {
		const groupId = groupState.nodeToGroup.get(nodeId);
		if (groupId === undefined) {
			return false;
		}
		const group = groupState.groups.get(groupId);
		if (!group) {
			return false;
		}
		if (group.collapsed) {
			return true;
		}
		return isGroupHidden(group.id);
	};

	const getGroupPortForRef = (ref: PortRef) => {
		const groupId = groupState.nodeToGroup.get(ref.nodeId);
		if (groupId === undefined) {
			return null;
		}
		const group = groupState.groups.get(groupId);
		if (!group || !group.collapsed || isGroupHidden(group.id)) {
			return null;
		}
		const port = group.ports.find(
			(candidate) =>
				candidate.target.nodeId === ref.nodeId &&
				candidate.target.portId === ref.portId,
		);
		if (!port) {
			return null;
		}
		return { group, port };
	};

	const getGroupPortWorldPosition = (group: GroupView, port: GroupPort) => {
		const ports = group.ports.filter(
			(candidate) => candidate.direction === port.direction,
		);
		const index = Math.max(
			0,
			ports.findIndex((candidate) => candidate.id === port.id),
		);
		const y = portStyles.startY + index * portStyles.spacing;
		const x = port.direction === "input" ? 0 : group.width;
		return {
			x: group.container.position.x + x,
			y: group.container.position.y + y,
		};
	};

	const findGroupPortAt = (worldX: number, worldY: number) => {
		const threshold = Math.max(portStyles.hitRadius, portStyles.radius + 4);
		const thresholdSquared = threshold * threshold;

		for (const group of groupState.groups.values()) {
			if (!group.collapsed || isGroupHidden(group.id)) {
				continue;
			}
			for (const port of group.ports) {
				const position = getGroupPortWorldPosition(group, port);
				const deltaX = worldX - position.x;
				const deltaY = worldY - position.y;
				if (deltaX * deltaX + deltaY * deltaY <= thresholdSquared) {
					return { ref: port.target, port };
				}
			}
		}

		return null;
	};

	const renderAllGroups = () => {
		groupState.groups.forEach((group) => {
			renderGroup(group, groupState.selectedIds.has(group.id));
			if (group.collapsed) {
				renderGroupPorts(group);
			}
		});
	};

	const updateGroupLabel = (groupId: number, label: string) => {
		const group = groupState.groups.get(groupId);
		if (!group) {
			return false;
		}
		group.label = label;
		renderGroup(group, groupState.selectedIds.has(group.id));
		if (group.collapsed) {
			renderGroupPorts(group);
		}
		return true;
	};

	const updateGroupColor = (groupId: number, color: number | null) => {
		const group = groupState.groups.get(groupId);
		if (!group) {
			return false;
		}
		group.color = color;
		renderGroup(group, groupState.selectedIds.has(group.id));
		if (group.collapsed) {
			renderGroupPorts(group);
		}
		return true;
	};

	return {
		createGroup,
		updateAllGroupLayouts,
		setGroupCollapsed,
		clearGroupSelection,
		selectGroup,
		removeGroup,
		clearGroups,
		deleteGroups,
		ungroupGroups,
		removeNodesFromGroups,
		getGroupForNode,
		isNodeHidden,
		isGroupHidden,
		getGroupDepth,
		getGroupAncestors,
		getGroupNodeIds,
		canSetGroupParent,
		setGroupParent,
		getGroupPortForRef,
		getGroupPortWorldPosition,
		findGroupPortAt,
		renderAllGroups,
		updateGroupLabel,
		updateGroupColor,
	};
};
