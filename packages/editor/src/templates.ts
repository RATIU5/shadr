import { buildNodeTemplate, getNodeDefinitions } from "./node-definitions";
import type { NodeTemplate, SerializablePort } from "./types";

export const defaultPorts: SerializablePort[] = [
	{ id: "in-a", name: "A", type: "float", direction: "input" },
	{ id: "in-b", name: "B", type: "vec2", direction: "input" },
	{ id: "out", name: "Out", type: "vec4", direction: "output" },
];

export const nodeTemplates: NodeTemplate[] =
	getNodeDefinitions().map(buildNodeTemplate);
