import type {
	Connection,
	NodeView,
	PortRef,
	PortType,
	ShaderCompileMessage,
	ShaderCompileResult,
} from "./types";

export const compileGraphToGlsl = (
	nodes: Map<number, NodeView>,
	connections: Map<string, Connection>,
): ShaderCompileResult => {
	const messages: ShaderCompileMessage[] = [];
	const addError = (message: string) => {
		messages.push({ kind: "error", message });
	};
	const addWarning = (message: string) => {
		messages.push({ kind: "warning", message });
	};
	const needs = {
		uv: false,
		position: false,
		time: false,
		texture: false,
	};

	const glslTypeForPort = (type: PortType) => {
		switch (type) {
			case "float":
				return "float";
			case "vec2":
				return "vec2";
			case "vec3":
				return "vec3";
			case "vec4":
				return "vec4";
			case "texture":
				return "sampler2D";
			case "color":
				return "vec4";
		}
	};

	const defaultValueForPort = (type: PortType) => {
		switch (type) {
			case "float":
				return "0.0";
			case "vec2":
				return "vec2(0.0)";
			case "vec3":
				return "vec3(0.0)";
			case "vec4":
				return "vec4(0.0)";
			case "color":
				return "vec4(1.0)";
			case "texture":
				needs.texture = true;
				return "u_texture";
		}
	};

	const sanitizeName = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, "_");
	const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
	const formatFloat = (value: number) => {
		if (!Number.isFinite(value)) {
			return "0.0";
		}
		const fixed = value.toFixed(4);
		const trimmed = fixed.replace(/\.?0+$/, "");
		return trimmed.includes(".") ? trimmed : `${trimmed}.0`;
	};

	const inputConnections = new Map<string, Connection>();
	connections.forEach((connection) => {
		inputConnections.set(
			`${connection.to.nodeId}:${connection.to.portId}`,
			connection,
		);
	});

	type ShaderStage = "vertex" | "fragment";
	const usedNodes = new Set<number>();

	const createEmitter = (stage: ShaderStage) => {
		const outputVars = new Map<string, string>();
		const visiting = new Set<string>();
		const lines: string[] = [];
		const emitPortExpression = (ref: PortRef): string => {
			const key = `${ref.nodeId}:${ref.portId}`;
			const cached = outputVars.get(key);
			if (cached) {
				return cached;
			}

			if (visiting.has(key)) {
				addError(`Cycle detected involving node ${ref.nodeId}.`);
				const node = nodes.get(ref.nodeId);
				const port = node?.ports.find(
					(candidate) => candidate.id === ref.portId,
				);
				return port ? defaultValueForPort(port.type) : "0.0";
			}

			const node = nodes.get(ref.nodeId);
			if (!node) {
				addError(`Missing node ${ref.nodeId} for connection.`);
				return "0.0";
			}

			usedNodes.add(node.id);

			const port = node.ports.find((candidate) => candidate.id === ref.portId);
			if (!port || port.direction !== "output") {
				addError(`Missing output port ${ref.portId} on node ${ref.nodeId}.`);
				return port ? defaultValueForPort(port.type) : "0.0";
			}

			const templateId = node.templateId;
			if (!templateId) {
				addError(`Node "${node.title.text}" is missing a template id.`);
				return defaultValueForPort(port.type);
			}

			visiting.add(key);

			const varName = `n${node.id}_${sanitizeName(port.id)}`;
			const glslType = glslTypeForPort(port.type);
			const getInputExpression = (
				inputId: string,
				type: PortType,
				fallback?: string,
			) => {
				const connection = inputConnections.get(`${node.id}:${inputId}`);
				if (!connection) {
					return fallback ?? defaultValueForPort(type);
				}
				return emitPortExpression(connection.from);
			};

			let expression: string | null = null;
			const getInputPortType = (inputId: string, fallback: PortType) => {
				const inputPort = node.ports.find(
					(candidate) => candidate.id === inputId,
				);
				return inputPort?.type ?? fallback;
			};
			const buildBinaryExpression = (operator: string) => {
				const aType = getInputPortType("a", port.type);
				const bType = getInputPortType("b", port.type);
				const aExpr = getInputExpression("a", aType);
				const bExpr = getInputExpression("b", bType);
				return `(${aExpr} ${operator} ${bExpr})`;
			};
			const buildMixExpression = () => {
				const aType = getInputPortType("a", port.type);
				const bType = getInputPortType("b", port.type);
				const aExpr = getInputExpression("a", aType);
				const bExpr = getInputExpression("b", bType);
				const tExpr = getInputExpression("t", "float");
				return `mix(${aExpr}, ${bExpr}, ${tExpr})`;
			};
			const buildClampExpression = () => {
				const inType = getInputPortType("in", port.type);
				const minType = getInputPortType("min", port.type);
				const maxType = getInputPortType("max", port.type);
				const inExpr = getInputExpression("in", inType);
				const minExpr = getInputExpression("min", minType);
				const maxExpr = getInputExpression("max", maxType);
				return `clamp(${inExpr}, ${minExpr}, ${maxExpr})`;
			};
			const buildUnaryExpression = (inputId: string, fn: string) => {
				const inputType = getInputPortType(inputId, port.type);
				const inputExpr = getInputExpression(inputId, inputType);
				return `${fn}(${inputExpr})`;
			};

			switch (templateId) {
				case "const-float":
					expression = formatFloat(node.data?.value ?? 0);
					break;
				case "const-vec2": {
					const vector = node.data?.vector;
					const x = formatFloat(vector?.x ?? 0);
					const y = formatFloat(vector?.y ?? 0);
					expression = `vec2(${x}, ${y})`;
					break;
				}
				case "const-vec3": {
					const vector = node.data?.vector;
					const x = formatFloat(vector?.x ?? 0);
					const y = formatFloat(vector?.y ?? 0);
					const z = formatFloat(vector?.z ?? 0);
					expression = `vec3(${x}, ${y}, ${z})`;
					break;
				}
				case "const-vec4": {
					const vector = node.data?.vector;
					const x = formatFloat(vector?.x ?? 0);
					const y = formatFloat(vector?.y ?? 0);
					const z = formatFloat(vector?.z ?? 0);
					const w = formatFloat(vector?.w ?? 0);
					expression = `vec4(${x}, ${y}, ${z}, ${w})`;
					break;
				}
				case "const-color":
					if (node.data?.color) {
						const color = node.data.color;
						const r = formatFloat(clamp01(color.r));
						const g = formatFloat(clamp01(color.g));
						const b = formatFloat(clamp01(color.b));
						const a = formatFloat(clamp01(color.a));
						expression = `vec4(${r}, ${g}, ${b}, ${a})`;
					} else {
						expression = "vec4(1.0)";
					}
					break;
				case "input-uv":
					needs.uv = true;
					expression = stage === "vertex" ? "a_uv" : "v_uv";
					break;
				case "input-position":
					needs.position = true;
					expression =
						stage === "vertex" ? "vec3(a_position, 0.0)" : "v_position";
					break;
				case "input-time":
					needs.time = true;
					expression = "u_time";
					break;
				case "input-texture":
					needs.texture = true;
					expression = "u_texture";
					break;
				case "math-add":
				case "math-add-vec2":
				case "math-add-vec3":
				case "math-add-vec4":
					expression = buildBinaryExpression("+");
					break;
				case "math-multiply":
				case "math-multiply-vec2":
				case "math-multiply-vec3":
				case "math-multiply-vec4":
					expression = buildBinaryExpression("*");
					break;
				case "math-subtract":
				case "math-subtract-vec2":
				case "math-subtract-vec3":
				case "math-subtract-vec4":
					expression = buildBinaryExpression("-");
					break;
				case "math-divide":
				case "math-divide-vec2":
				case "math-divide-vec3":
				case "math-divide-vec4":
					expression = buildBinaryExpression("/");
					break;
				case "math-clamp":
				case "math-clamp-vec2":
				case "math-clamp-vec3":
				case "math-clamp-vec4":
					expression = buildClampExpression();
					break;
				case "math-sine":
				case "math-sine-vec2":
				case "math-sine-vec3":
				case "math-sine-vec4":
					expression = buildUnaryExpression("in", "sin");
					break;
				case "math-cosine":
				case "math-cosine-vec2":
				case "math-cosine-vec3":
				case "math-cosine-vec4":
					expression = buildUnaryExpression("in", "cos");
					break;
				case "math-lerp":
				case "math-lerp-vec2":
				case "math-lerp-vec3":
				case "math-lerp-vec4":
					expression = buildMixExpression();
					break;
				case "texture-sample": {
					needs.texture = true;
					const texExpr = getInputExpression("tex", "texture");
					const fallbackUv = stage === "vertex" ? "a_uv" : "v_uv";
					const uvExpr = getInputExpression("uv", "vec2", fallbackUv);
					if (uvExpr === "v_uv" || uvExpr === "a_uv") {
						needs.uv = true;
					}
					expression = `texture2D(${texExpr}, ${uvExpr})`;
					break;
				}
				default:
					addError(
						`Node "${node.title.text}" is not supported by GLSL export.`,
					);
					expression = defaultValueForPort(port.type);
					break;
			}

			lines.push(`${glslType} ${varName} = ${expression};`);
			outputVars.set(key, varName);
			visiting.delete(key);
			return varName;
		};

		return { lines, emitPortExpression };
	};

	const fragmentEmitter = createEmitter("fragment");
	const vertexEmitter = createEmitter("vertex");

	const fragmentNodes = Array.from(nodes.values()).filter(
		(node) => node.templateId === "fragment-output",
	);

	if (fragmentNodes.length === 0) {
		addError("No Fragment Output node found.");
	} else if (fragmentNodes.length > 1) {
		addWarning("Multiple Fragment Output nodes found. Using the first.");
	}

	const fragmentNode = fragmentNodes[0];
	const fragmentColorPort = fragmentNode?.ports.find(
		(port) => port.direction === "input",
	);
	let fragmentOutput = "vec4(0.0)";
	if (fragmentNode && fragmentColorPort) {
		const connection = inputConnections.get(
			`${fragmentNode.id}:${fragmentColorPort.id}`,
		);
		if (!connection) {
			addWarning("Fragment Output input is unconnected.");
			fragmentOutput = defaultValueForPort(fragmentColorPort.type);
		} else {
			fragmentOutput = fragmentEmitter.emitPortExpression(connection.from);
		}
	}

	const vertexNodes = Array.from(nodes.values()).filter(
		(node) => node.templateId === "vertex-output",
	);

	if (vertexNodes.length > 1) {
		addWarning("Multiple Vertex Output nodes found. Using the first.");
	}

	const vertexNode = vertexNodes[0];
	const vertexPositionPort = vertexNode?.ports.find(
		(port) => port.direction === "input",
	);
	let vertexPositionExpr = "vec3(a_position, 0.0)";
	let vertexPositionType: PortType = "vec3";

	if (vertexNode && vertexPositionPort) {
		vertexPositionType = vertexPositionPort.type;
		const connection = inputConnections.get(
			`${vertexNode.id}:${vertexPositionPort.id}`,
		);
		if (connection) {
			vertexPositionExpr = vertexEmitter.emitPortExpression(connection.from);
		} else {
			addWarning("Vertex Output input is unconnected.");
		}
	} else if (vertexNode) {
		addWarning(
			`Vertex Output node "${vertexNode.title.text}" is missing input.`,
		);
	}

	usedNodes.forEach((nodeId) => {
		const node = nodes.get(nodeId);
		if (!node) {
			return;
		}
		if (
			node.templateId === "fragment-output" ||
			node.templateId === "vertex-output"
		) {
			return;
		}
		node.ports.forEach((port) => {
			if (port.direction !== "input") {
				return;
			}
			const key = `${node.id}:${port.id}`;
			if (inputConnections.has(key)) {
				return;
			}
			addWarning(
				`Input "${port.name}" on node "${node.title.text}" is unconnected.`,
			);
		});
	});

	const vertexLines = ["attribute vec2 a_position;"];
	if (needs.uv) {
		vertexLines.push("attribute vec2 a_uv;");
		vertexLines.push("varying vec2 v_uv;");
	}
	if (needs.position) {
		vertexLines.push("varying vec3 v_position;");
	}
	if (needs.time) {
		vertexLines.push("uniform float u_time;");
	}
	if (needs.texture) {
		vertexLines.push("uniform sampler2D u_texture;");
	}
	vertexLines.push("void main() {");
	if (needs.uv) {
		vertexLines.push("\tv_uv = a_uv;");
	}
	if (needs.position) {
		vertexLines.push("\tv_position = vec3(a_position, 0.0);");
	}
	vertexEmitter.lines.forEach((line) => {
		vertexLines.push(`\t${line}`);
	});

	const formatVertexPosition = (expression: string, type: PortType) => {
		switch (type) {
			case "vec4":
			case "color":
				return expression;
			case "vec3":
				return `vec4(${expression}, 1.0)`;
			case "vec2":
				return `vec4(${expression}, 0.0, 1.0)`;
			case "float":
				return `vec4(vec2(${expression}), 0.0, 1.0)`;
			case "texture":
				return "vec4(0.0, 0.0, 0.0, 1.0)";
		}
	};

	const glPosition =
		vertexNode && vertexPositionPort
			? formatVertexPosition(vertexPositionExpr, vertexPositionType)
			: "vec4(a_position, 0.0, 1.0)";

	vertexLines.push(`\tgl_Position = ${glPosition};`);
	vertexLines.push("}");

	const fragmentLines = ["precision mediump float;"];
	if (needs.uv) {
		fragmentLines.push("varying vec2 v_uv;");
	}
	if (needs.position) {
		fragmentLines.push("varying vec3 v_position;");
	}
	if (needs.time) {
		fragmentLines.push("uniform float u_time;");
	}
	if (needs.texture) {
		fragmentLines.push("uniform sampler2D u_texture;");
	}
	fragmentLines.push("void main() {");
	fragmentEmitter.lines.forEach((line) => {
		fragmentLines.push(`\t${line}`);
	});
	fragmentLines.push(`\tgl_FragColor = ${fragmentOutput};`);
	fragmentLines.push("}");

	return {
		vertexSource: `${vertexLines.join("\n")}\n`,
		fragmentSource: `${fragmentLines.join("\n")}\n`,
		messages,
		hasFragmentOutput: Boolean(fragmentNode && fragmentColorPort),
	};
};
