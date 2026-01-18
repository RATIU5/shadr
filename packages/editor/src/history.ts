import type { Container } from "pixi.js";
import {
	type ConnectionState,
	type GroupState,
	type HistoryState,
	type NodeCollectionState,
	resolveConnectionType,
	type ZoomLimits,
} from "./editor-state";
import { GRAPH_SCHEMA_VERSION } from "./graph-version";
import type {
	NodeSocketValue,
	NodeState,
	PortRef,
	PortType,
	SerializableConnection,
	SerializableGraph,
	SerializableGroup,
	SerializablePort,
} from "./types";

type CreateNodeOptions = {
	id?: number;
	title?: string;
	ports?: SerializablePort[];
	select?: boolean;
	typeId?: string;
	state?: NodeState;
	socketValues?: Record<string, NodeSocketValue>;
};

type HistoryDeps = {
	camera: Container;
	zoomLimits: ZoomLimits;
	nodeState: NodeCollectionState;
	groupState: GroupState;
	connectionState: ConnectionState;
	historyState: HistoryState;
	arePortTypesCompatible: (first: PortType, second: PortType) => boolean;
	createNode: (
		position: { x: number; y: number },
		options: CreateNodeOptions,
	) => void;
	createGroup: (
		nodeIds: number[],
		options: {
			id?: number;
			title?: string;
			collapsed?: boolean;
			x?: number;
			y?: number;
			color?: number | null;
		},
	) => void;
	clearGraph: () => void;
	clearSelection: () => void;
	getNodePort: (
		ref: PortRef,
	) => { port: { type: PortType; direction: "input" | "output" } } | null;
	updateShaderFromSnapshot: (snapshot: SerializableGraph) => void;
	updateNodePorts: (
		nodeId: number,
		ports: SerializablePort[],
		options?: { preserveNames?: boolean },
	) => boolean;
};

export const createHistoryManager = ({
	camera,
	zoomLimits,
	nodeState,
	groupState,
	connectionState,
	historyState,
	arePortTypesCompatible,
	createNode,
	createGroup,
	clearGraph,
	clearSelection,
	getNodePort,
	updateShaderFromSnapshot,
	updateNodePorts,
}: HistoryDeps) => {
	const cloneSocketValues = (
		socketValues: Record<string, NodeSocketValue>,
	): Record<string, NodeSocketValue> => {
		const cloned: Record<string, NodeSocketValue> = {};
		Object.entries(socketValues).forEach(([key, value]) => {
			if (Array.isArray(value)) {
				cloned[key] = [...value];
				return;
			}
			if (value && typeof value === "object" && "x" in value && "y" in value) {
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
				return;
			}
			if (
				value &&
				typeof value === "object" &&
				"r" in value &&
				"g" in value &&
				"b" in value &&
				"a" in value
			) {
				const color = value as { r: number; g: number; b: number; a: number };
				cloned[key] = {
					r: color.r,
					g: color.g,
					b: color.b,
					a: color.a,
				};
				return;
			}
			cloned[key] = value;
		});
		return cloned;
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
			...(node.state ? { state: node.state } : {}),
			...(node.socketValues
				? { socketValues: cloneSocketValues(node.socketValues) }
				: {}),
			...(node.typeId ? { typeId: node.typeId } : {}),
		}));

		const connections = Array.from(connectionState.connections.values()).map(
			(connection) => ({
				from: connection.from,
				to: connection.to,
				type: connection.type,
			}),
		);

		const groups = Array.from(groupState.groups.values()).map((group) => ({
			id: group.id,
			title: group.label,
			nodeIds: Array.from(group.nodeIds),
			...(group.parentId !== null ? { parentId: group.parentId } : {}),
			collapsed: group.collapsed,
			x: group.collapsedPosition.x,
			y: group.collapsedPosition.y,
			...(group.color !== undefined ? { color: group.color } : {}),
		}));

		return {
			version: GRAPH_SCHEMA_VERSION,
			nodes,
			connections,
			camera: {
				pivotX: camera.pivot.x,
				pivotY: camera.pivot.y,
				scale: camera.scale.x || 1,
			},
			...(groups.length > 0 ? { groups } : {}),
		};
	};

	const serializeSnapshot = (snapshot: SerializableGraph) =>
		JSON.stringify(snapshot);

	const setHistoryCurrent = (snapshot: SerializableGraph) => {
		historyState.current = snapshot;
		historyState.currentSerialized = serializeSnapshot(snapshot);
	};

	const commitHistory = () => {
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

			if (connection.from.nodeId === connection.to.nodeId) {
				droppedConnections += 1;
				return;
			}

			if (fromPort.direction !== "output" || toPort.direction !== "input") {
				droppedConnections += 1;
				return;
			}

			if (!arePortTypesCompatible(fromPort.type, toPort.type)) {
				droppedConnections += 1;
				return;
			}

			validConnections.push({
				...connection,
				type: resolveConnectionType(fromPort.type, toPort.type),
			});
		});

		const groups = (snapshot.groups ?? []).map((group) => ({
			...group,
			nodeIds: group.nodeIds.filter((nodeId) => nodeMap.has(nodeId)),
		}));
		const groupMap = new Map(groups.map((group) => [group.id, group]));
		groups.forEach((group) => {
			if (group.parentId !== undefined && group.parentId !== null) {
				if (!groupMap.has(group.parentId)) {
					group.parentId = null;
				}
			}
		});
		const childCounts = new Map<number, number>();
		groups.forEach((group) => {
			if (group.parentId !== undefined && group.parentId !== null) {
				childCounts.set(
					group.parentId,
					(childCounts.get(group.parentId) ?? 0) + 1,
				);
			}
		});
		const filteredGroups = groups.filter(
			(group) =>
				group.nodeIds.length > 0 || (childCounts.get(group.id) ?? 0) > 0,
		);
		const filteredMap = new Map(
			filteredGroups.map((group) => [group.id, group]),
		);
		filteredGroups.forEach((group) => {
			if (group.parentId !== undefined && group.parentId !== null) {
				if (!filteredMap.has(group.parentId)) {
					group.parentId = null;
				}
			}
		});

		const sanitizedSnapshot: SerializableGraph = {
			version: snapshot.version,
			nodes: snapshot.nodes,
			connections: validConnections,
			...(snapshot.camera ? { camera: snapshot.camera } : {}),
			...(filteredGroups.length > 0 ? { groups: filteredGroups } : {}),
		};

		return { snapshot: sanitizedSnapshot, droppedConnections };
	};

	const applyGraphSnapshot = (snapshot: SerializableGraph) => {
		const { snapshot: sanitizedSnapshot, droppedConnections } =
			sanitizeGraphSnapshot(snapshot);
		clearGraph();

		sanitizedSnapshot.nodes.forEach((node) => {
			const options: CreateNodeOptions = {
				id: node.id,
				title: node.title,
				...(node.state ? { state: node.state } : {}),
				...(node.socketValues ? { socketValues: node.socketValues } : {}),
				...(node.typeId ? { typeId: node.typeId } : {}),
				select: false,
			};
			if (!node.typeId) {
				options.ports = node.ports;
			}
			createNode({ x: node.x, y: node.y }, options);
			if (node.typeId && node.ports.length > 0) {
				const created = nodeState.nodes.get(node.id);
				if (created) {
					const nameMap = new Map(
						node.ports.map((port) => [port.id, port.name] as const),
					);
					const nextPorts = created.ports.map((port) => ({
						id: port.id,
						name: nameMap.get(port.id) ?? port.name,
						type: port.type,
						direction: port.direction,
					}));
					updateNodePorts(node.id, nextPorts, { preserveNames: false });
				}
			}
		});

		sanitizedSnapshot.connections.forEach((connection) => {
			const fromData = getNodePort(connection.from);
			const toData = getNodePort(connection.to);
			if (!fromData || !toData) {
				return;
			}

			if (connection.from.nodeId === connection.to.nodeId) {
				return;
			}

			if (!arePortTypesCompatible(fromData.port.type, toData.port.type)) {
				return;
			}

			if (
				fromData.port.direction !== "output" ||
				toData.port.direction !== "input"
			) {
				return;
			}

			const id = `${connection.from.nodeId}:${connection.from.portId}->${connection.to.nodeId}:${connection.to.portId}`;
			const connectionType = resolveConnectionType(
				fromData.port.type,
				toData.port.type,
			);
			connectionState.connections.set(id, {
				id,
				from: connection.from,
				to: connection.to,
				type: connectionType,
			});
		});

		clearSelection();
		applyCameraState(sanitizedSnapshot.camera);
		if (sanitizedSnapshot.groups) {
			const groupMap = new Map(
				sanitizedSnapshot.groups.map((group) => [group.id, group] as const),
			);
			const depthCache = new Map<number, number>();
			const getDepth = (group: SerializableGroup) => {
				const cached = depthCache.get(group.id);
				if (cached !== undefined) {
					return cached;
				}
				let depth = 1;
				let current = group;
				const visited = new Set<number>();
				while (
					current.parentId !== undefined &&
					current.parentId !== null &&
					groupMap.has(current.parentId) &&
					!visited.has(current.parentId)
				) {
					visited.add(current.parentId);
					const parent = groupMap.get(current.parentId);
					if (!parent) {
						break;
					}
					depth += 1;
					current = parent;
				}
				depthCache.set(group.id, depth);
				return depth;
			};
			const orderedGroups = [...sanitizedSnapshot.groups].sort(
				(a, b) => getDepth(a) - getDepth(b),
			);
			orderedGroups.forEach((group) => {
				createGroup(group.nodeIds, {
					id: group.id,
					title: group.title,
					collapsed: group.collapsed,
					x: group.x,
					y: group.y,
					color: group.color ?? null,
					...(group.parentId !== undefined ? { parentId: group.parentId } : {}),
				});
			});
		}
		updateShaderFromSnapshot(sanitizedSnapshot);
		return { snapshot: sanitizedSnapshot, droppedConnections };
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

	return {
		buildGraphSnapshot,
		commitHistory,
		setHistoryCurrent,
		undoHistory,
		redoHistory,
		applyGraphSnapshot,
	};
};
