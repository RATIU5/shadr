import type { Application, Container, Graphics, Text } from "pixi.js";
import type { GraphSchemaVersion } from "./graph-version";
import type { EditorVisualSettings } from "./visual-settings";

export type PortType =
	| "float"
	| "int"
	| "vec2"
	| "vec3"
	| "vec4"
	| "texture"
	| "color";

export type NodeFamilyId =
	| "math"
	| "vector"
	| "color"
	| "conversion"
	| "logic"
	| "texture-uv"
	| "output"
	| "constants"
	| "inputs";

export type PortDirection = "input" | "output";

export type NodePort = {
	id: string;
	name: string;
	type: PortType;
	direction: PortDirection;
	directionIndex: number;
	graphics: Graphics;
	hitGraphics: Graphics;
	label: Text;
	isHover: boolean;
	isDragTarget: boolean;
	isDragValid: boolean;
};

export type NodeParamKind =
	| "float"
	| "int"
	| "vec2"
	| "vec3"
	| "vec4"
	| "color"
	| "boolean"
	| "string"
	| "enum"
	| "texture"
	| "image";

export type NodeParamValue =
	| number
	| boolean
	| string
	| string[]
	| {
			x: number;
			y: number;
			z?: number;
			w?: number;
	  }
	| {
			r: number;
			g: number;
			b: number;
			a: number;
	  };

export type NodeParamSpec = {
	id: string;
	kind: NodeParamKind;
	label: string;
	description?: string;
	defaultValue: NodeParamValue;
	min?: number;
	max?: number;
	step?: number;
	options?: Array<{ value: string; label: string }>;
	isVisible?: (state: NodeState) => boolean;
	ui?: {
		tab?: string;
		section?: string;
		inline?: boolean;
		bodyLabel?: boolean;
		order?: number;
	};
};

export type NodeState = {
	version: number;
	params: Record<string, NodeParamValue>;
	ui?: {
		lastTabId?: string;
	};
};

export type NodeView = {
	id: number;
	container: Container;
	hitGraphics: Graphics;
	background: Graphics;
	title: Text;
	ports: NodePort[];
	width: number;
	height: number;
	isHover: boolean;
	state?: NodeState;
	valueLabel?: Text;
	bodyLabel?: Text;
	typeId?: string;
};

export type GroupPort = NodePort & {
	target: PortRef;
};

export type GroupView = {
	id: number;
	container: Container;
	hitGraphics: Graphics;
	background: Graphics;
	title: Text;
	label: string;
	ports: GroupPort[];
	width: number;
	height: number;
	isHover: boolean;
	nodeIds: Set<number>;
	collapsed: boolean;
	collapsedPosition: { x: number; y: number };
	portKeys: string[];
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

export type NodeRenameState = {
	nodeId: number;
	title: string;
	screenX: number;
	screenY: number;
	scale: number;
};

export type SelectedNode = {
	id: number;
	title: string;
	typeId?: string;
	state?: NodeState;
	ports: SerializablePort[];
};

export type SelectedGroup = {
	id: number;
	title: string;
	nodeIds: number[];
	collapsed: boolean;
};

export type SelectedConnection = {
	id: string;
	from: PortRef;
	to: PortRef;
	type: PortType;
};

export type EditorSelectionState =
	| { kind: "none" }
	| {
			kind: "multi";
			nodes: number[];
			groups: number[];
			connections: string[];
	  }
	| { kind: "node"; node: SelectedNode }
	| { kind: "group"; group: SelectedGroup }
	| { kind: "connection"; connection: SelectedConnection };

export type EditorHoverState =
	| { kind: "none" }
	| { kind: "node"; node: SelectedNode }
	| { kind: "connection"; connection: SelectedConnection };

export type EditorApp = Application & {
	closeContextMenu: () => void;
	closeNodeRename: () => void;
	exportGlsl: () => void;
	openSearchPalette: () => void;
	undo: () => void;
	redo: () => void;
	copySelected: () => boolean;
	cutSelected: () => void;
	paste: () => void;
	deleteSelected: () => void;
	resetView: () => void;
	frameSelection: () => void;
	saveGraph: () => void;
	loadGraph: () => void;
	loadGraphFromText: (text: string) => boolean;
	getGraphJson: () => string;
	updateNodeState: (nodeId: number, state: NodeState) => boolean;
	updateNodeTitle: (nodeId: number, title: string) => boolean;
	updateNodePortName: (nodeId: number, portId: string, name: string) => boolean;
	updateVisualSettings: (settings: Partial<EditorVisualSettings>) => void;
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
	state?: NodeState;
	typeId?: string;
	familyId?: NodeFamilyId;
};

export type SerializableConnection = {
	from: PortRef;
	to: PortRef;
	type: PortType;
};

export type SerializableGroup = {
	id: number;
	title: string;
	nodeIds: number[];
	collapsed: boolean;
	x: number;
	y: number;
};

export type SerializableGraph = {
	version: GraphSchemaVersion;
	nodes: SerializableNode[];
	connections: SerializableConnection[];
	camera?: {
		pivotX: number;
		pivotY: number;
		scale: number;
	};
	groups?: SerializableGroup[];
};

export type NodeTemplate = {
	id: string;
	label: string;
	title: string;
	category: string;
	ports: SerializablePort[];
};

export type NodeUiLayoutTab = {
	id: string;
	label: string;
	description?: string;
};

export type NodeDefinition = {
	id: string;
	label: string;
	category: string;
	tags: string[];
	description?: string;
	parameters: NodeParamSpec[];
	uiTabs?: NodeUiLayoutTab[];
	buildPorts: (state: NodeState) => SerializablePort[];
	getBodyLabel?: (state: NodeState) => string | null;
	getFooterLabel?: (state: NodeState) => string | null;
	getPreviewLabel?: (state: NodeState) => string | null;
	compile?: (context: NodeCompileContext) => string | null;
};

export type NodeCompileContext = {
	node: NodeView;
	state: NodeState;
	portId: string;
	stage: "vertex" | "fragment";
	getInputExpression: (
		inputId: string,
		type: PortType,
		fallback?: string,
	) => string;
	getInputPortType: (inputId: string, fallback: PortType) => PortType;
	defaultValueForPort: (type: PortType) => string;
	addWarning: (message: string) => void;
	addError: (message: string) => void;
	markNeed: (need: "uv" | "position" | "time" | "texture") => void;
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
	nodeCount?: number;
	connectionCount?: number;
	compileMs?: number;
};

export type UiMessageTone = "info" | "warning" | "error";

export type UiMessage = {
	tone: UiMessageTone;
	message: string;
};

export type InitCanvasOptions = {
	onShaderChange?: (result: ShaderCompileResult) => void;
	onExportRequest?: (result: ShaderCompileResult) => void;
	onContextMenuChange?: (state: ContextMenuState) => void;
	onUiMessage?: (message: UiMessage) => void;
	onNodeRenameChange?: (state: NodeRenameState | null) => void;
	onSelectionChange?: (state: EditorSelectionState) => void;
	onHoverChange?: (state: EditorHoverState) => void;
	debugOverlay?: boolean;
	visualSettings?: Partial<EditorVisualSettings>;
};
