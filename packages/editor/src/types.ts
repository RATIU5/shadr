import type { Application, Container, Graphics, Text } from "pixi.js";

export type PortType = "float" | "vec2" | "vec3" | "vec4" | "texture" | "color";

export type PortDirection = "input" | "output";

export type NodePort = {
	id: string;
	name: string;
	type: PortType;
	direction: PortDirection;
	graphics: Graphics;
	label: Text;
	isHover: boolean;
	isDragTarget: boolean;
	isDragValid: boolean;
};

export type NodeData = {
	value?: number;
	color?: {
		r: number;
		g: number;
		b: number;
		a: number;
	};
	vector?: {
		x: number;
		y: number;
		z?: number;
		w?: number;
	};
};

export type NodeView = {
	id: number;
	container: Container;
	background: Graphics;
	title: Text;
	ports: NodePort[];
	width: number;
	height: number;
	isHover: boolean;
	data?: NodeData;
	valueLabel?: Text;
	templateId?: string;
};

export type PortRef = {
	nodeId: number;
	portId: string;
};

export type Connection = {
	id: string;
	from: PortRef;
	to: PortRef;
	type: PortType;
};

export type ConnectionDrag = {
	pointerId: number;
	start: PortRef;
	direction: PortDirection;
	type: PortType;
	x: number;
	y: number;
	target: PortRef | null;
	isValid: boolean;
};

export type ContextMenuItem = {
	id: string;
	label: string;
	action: () => void;
	enabled: boolean;
};

export type ContextMenuState = {
	isOpen: boolean;
	screenX: number;
	screenY: number;
	items: ContextMenuItem[];
};

export type EditorApp = Application & {
	closeContextMenu: () => void;
	exportGlsl: () => void;
};

export type SerializablePort = {
	id: string;
	name: string;
	type: PortType;
	direction: PortDirection;
};

export type SerializableNode = {
	id: number;
	title: string;
	x: number;
	y: number;
	ports: SerializablePort[];
	data?: NodeData;
	templateId?: string;
};

export type SerializableConnection = {
	from: PortRef;
	to: PortRef;
	type: PortType;
};

export type SerializableGraph = {
	version: 1;
	nodes: SerializableNode[];
	connections: SerializableConnection[];
	camera?: {
		pivotX: number;
		pivotY: number;
		scale: number;
	};
};

export type NodeTemplate = {
	id: string;
	label: string;
	title: string;
	ports: SerializablePort[];
};

export type ShaderCompileMessage = {
	kind: "error" | "warning";
	message: string;
};

export type ShaderCompileResult = {
	vertexSource: string;
	fragmentSource: string;
	messages: ShaderCompileMessage[];
	hasFragmentOutput: boolean;
};

export type InitCanvasOptions = {
	onShaderChange?: (result: ShaderCompileResult) => void;
	onContextMenuChange?: (state: ContextMenuState) => void;
};
