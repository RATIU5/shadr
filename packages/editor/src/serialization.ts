import type {
	NodeData,
	PortDirection,
	PortType,
	SerializableConnection,
	SerializableGraph,
	SerializableNode,
	SerializablePort,
} from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isPortType = (value: unknown): value is PortType =>
	value === "float" ||
	value === "vec2" ||
	value === "vec3" ||
	value === "vec4" ||
	value === "texture" ||
	value === "color";

const isPortDirection = (value: unknown): value is PortDirection =>
	value === "input" || value === "output";

const parsePort = (value: unknown): SerializablePort | null => {
	if (!isRecord(value)) {
		return null;
	}

	const { id, name, type, direction } = value;
	if (
		typeof id !== "string" ||
		typeof name !== "string" ||
		!isPortType(type) ||
		!isPortDirection(direction)
	) {
		return null;
	}

	return { id, name, type, direction };
};

const parseNode = (value: unknown): SerializableNode | null => {
	if (!isRecord(value)) {
		return null;
	}

	const { id, title, x, y, ports, templateId, data } = value;
	if (
		typeof id !== "number" ||
		!Number.isFinite(id) ||
		typeof title !== "string" ||
		typeof x !== "number" ||
		!Number.isFinite(x) ||
		typeof y !== "number" ||
		!Number.isFinite(y) ||
		!Array.isArray(ports)
	) {
		return null;
	}

	const parsedTemplateId =
		typeof templateId === "string" ? templateId : undefined;

	const parsedPorts = ports.map(parsePort);
	if (parsedPorts.some((port) => !port)) {
		return null;
	}

	const parseNodeData = (
		template: string | undefined,
		payload: unknown,
	): NodeData | undefined => {
		if (!template || !isRecord(payload)) {
			return undefined;
		}

		const parseVector = (components: Array<"x" | "y" | "z" | "w">) => {
			const vector = payload.vector;
			if (!isRecord(vector)) {
				return undefined;
			}

			const values: { x: number; y: number; z?: number; w?: number } = {
				x: 0,
				y: 0,
			};

			for (const component of components) {
				const value = vector[component];
				if (typeof value !== "number" || !Number.isFinite(value)) {
					return undefined;
				}
				values[component] = value;
			}

			return { vector: values };
		};

		if (template === "const-float") {
			const value = payload.value;
			if (typeof value === "number" && Number.isFinite(value)) {
				return { value };
			}
			return undefined;
		}

		if (template === "const-vec2") {
			return parseVector(["x", "y"]);
		}

		if (template === "const-vec3") {
			return parseVector(["x", "y", "z"]);
		}

		if (template === "const-vec4") {
			return parseVector(["x", "y", "z", "w"]);
		}

		if (template === "const-color") {
			const color = payload.color;
			if (!isRecord(color)) {
				return undefined;
			}

			const r = color.r;
			const g = color.g;
			const b = color.b;
			const a = color.a;
			if (
				typeof r === "number" &&
				Number.isFinite(r) &&
				typeof g === "number" &&
				Number.isFinite(g) &&
				typeof b === "number" &&
				Number.isFinite(b) &&
				typeof a === "number" &&
				Number.isFinite(a)
			) {
				return { color: { r, g, b, a } };
			}
		}

		return undefined;
	};

	const parsedData = parseNodeData(parsedTemplateId, data);

	return {
		id,
		title,
		x,
		y,
		ports: parsedPorts.filter(
			(port): port is SerializablePort => port !== null,
		),
		...(parsedData ? { data: parsedData } : {}),
		...(parsedTemplateId ? { templateId: parsedTemplateId } : {}),
	};
};

const parseConnection = (value: unknown): SerializableConnection | null => {
	if (!isRecord(value)) {
		return null;
	}

	const { from, to, type } = value;
	if (!isRecord(from) || !isRecord(to) || !isPortType(type)) {
		return null;
	}

	const fromNodeId = from.nodeId;
	const fromPortId = from.portId;
	const toNodeId = to.nodeId;
	const toPortId = to.portId;

	if (
		typeof fromNodeId !== "number" ||
		!Number.isFinite(fromNodeId) ||
		typeof fromPortId !== "string" ||
		typeof toNodeId !== "number" ||
		!Number.isFinite(toNodeId) ||
		typeof toPortId !== "string"
	) {
		return null;
	}

	return {
		from: { nodeId: fromNodeId, portId: fromPortId },
		to: { nodeId: toNodeId, portId: toPortId },
		type,
	};
};

const parseCamera = (
	value: unknown,
): SerializableGraph["camera"] | undefined => {
	if (!isRecord(value)) {
		return undefined;
	}

	const { pivotX, pivotY, scale } = value;
	if (
		typeof pivotX !== "number" ||
		!Number.isFinite(pivotX) ||
		typeof pivotY !== "number" ||
		!Number.isFinite(pivotY) ||
		typeof scale !== "number" ||
		!Number.isFinite(scale)
	) {
		return undefined;
	}

	return { pivotX, pivotY, scale };
};

export const parseGraph = (value: unknown): SerializableGraph | null => {
	if (!isRecord(value)) {
		return null;
	}

	const { version, nodes, connections, camera } = value;
	if (version !== undefined && version !== 1) {
		return null;
	}

	if (!Array.isArray(nodes) || !Array.isArray(connections)) {
		return null;
	}

	const parsedNodes = nodes.map(parseNode);
	if (parsedNodes.some((node) => !node)) {
		return null;
	}

	const parsedConnections = connections
		.map(parseConnection)
		.filter(
			(connection): connection is SerializableConnection => connection !== null,
		);

	const parsedCamera = parseCamera(camera);
	const snapshot: SerializableGraph = {
		version: 1,
		nodes: parsedNodes.filter(
			(node): node is SerializableNode => node !== null,
		),
		connections: parsedConnections,
	};

	if (parsedCamera) {
		snapshot.camera = parsedCamera;
	}

	return snapshot;
};
