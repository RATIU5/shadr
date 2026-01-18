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
	uiSpec?: NodeSocketUiSpec;
	defaultValue?: NodeSocketValue;
	isConnected?: boolean;
	conversionRules?: PortType[];
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

export type NodeSocketValue = NodeParamValue;

export type NodeSocketUiSpec = {
	kind: NodeParamKind;
	label?: string;
	description?: string;
	min?: number;
	max?: number;
	step?: number;
	options?: Array<{ value: string; label: string }>;
	tab?: string;
	section?: string;
	inline?: boolean;
	order?: number;
};

export type NodeSocket = {
	id: string;
	label: string;
	direction: PortDirection;
	dataType: PortType;
	value?: NodeSocketValue;
	uiSpec?: NodeSocketUiSpec;
	isConnected?: boolean;
	defaultValue?: NodeSocketValue;
	visibilityRules?: (state: NodeState) => boolean;
	conversionRules?: PortType[];
};

export type NodeState = {
	version: number;
	params: Record<string, NodeParamValue>;
	ui?: {
		lastTabId?: string;
		colorTag?: string;
		isBypassed?: boolean;
	};
};

export type NodeView = {
	id: number;
	container: Container;
	hitGraphics: Graphics;
	background: Graphics;
	title: Text;
	warningBadge?: Graphics;
	warningLabel?: Text;
	performanceWarnings?: string[];
	ports: NodePort[];
	width: number;
	height: number;
	isHover: boolean;
	state?: NodeState;
	socketValues?: Record<string, NodeSocketValue>;
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
	color?: number | null;
	ports: GroupPort[];
	width: number;
	height: number;
	isHover: boolean;
	nodeIds: Set<number>;
	childGroupIds: Set<number>;
	parentId: number | null;
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
	detached?: Connection;
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
	socketValues?: Record<string, NodeSocketValue>;
	ports: SerializablePort[];
	connectedInputs?: string[];
};

export type SelectedGroup = {
	id: number;
	title: string;
	nodeIds: number[];
	collapsed: boolean;
	color?: number | null;
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
	| { kind: "socket"; socket: SocketHoverState }
	| { kind: "node"; node: SelectedNode }
	| {
			kind: "connection";
			connection: SelectedConnection;
			screenX: number;
			screenY: number;
	  };

export type SelectionBounds = {
	world: { minX: number; minY: number; maxX: number; maxY: number };
	screen: { minX: number; minY: number; maxX: number; maxY: number };
};

export type EditorApp = Application & {
	closeContextMenu: () => void;
	closeNodeRename: () => void;
	closeSocketEditor: () => void;
	compileShader: () => void;
	compilePreviewShader: (
		target?: ShaderPreviewTarget | null,
	) => ShaderCompileResult;
	exportGlsl: () => void;
	openSearchPalette: (query?: string) => void;
	createNodeFromTemplate: (
		typeId: string,
		position?: { x: number; y: number },
	) => boolean;
	undo: () => void;
	redo: () => void;
	copySelected: () => boolean;
	cutSelected: () => void;
	paste: () => void;
	getSelectionClipboardJson: () => string | null;
	pasteSelectionFromText: (
		text: string,
		position?: { x: number; y: number },
	) => boolean;
	deleteSelected: () => void;
	resetView: () => void;
	frameSelection: () => void;
	groupSelectedNodes: () => void;
	convertSelectionToGroup: () => void;
	createCollapsedGroupFromSelection: () => void;
	explodeGroupSelection: () => void;
	openReplacePalette: (query?: string) => void;
	saveGraph: () => void;
	loadGraph: () => void;
	loadGraphFromText: (text: string) => boolean;
	getGraphJson: () => string;
	updateNodeState: (nodeId: number, state: NodeState) => boolean;
	updateNodeSocketValues: (
		nodeId: number,
		socketValues: Record<string, NodeSocketValue>,
	) => boolean;
	updateNodeTitle: (nodeId: number, title: string) => boolean;
	updateNodePortName: (nodeId: number, portId: string, name: string) => boolean;
	updateGroupTitle: (groupId: number, title: string) => boolean;
	updateGroupColor: (groupId: number, color: number | null) => boolean;
	updateVisualSettings: (settings: Partial<EditorVisualSettings>) => void;
	setConnectionFlowActive: (active: boolean) => void;
	setDebugMode: (enabled: boolean) => void;
	setDebugVisualizationState: (state: DebugVisualizationState | null) => void;
};

export type DebugVisualizationState = {
	enabled: boolean;
	dimInactive: boolean;
	activeNodes: number[];
	activeConnections: string[];
	focusNodeId?: number | null;
	focusConnectionIds?: string[];
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
	socketValues?: Record<string, NodeSocketValue>;
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
	parentId?: number | null;
	collapsed: boolean;
	x: number;
	y: number;
	color?: number | null;
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

export type SelectionClipboardPayload = {
	version: GraphSchemaVersion;
	nodes: SerializableNode[];
	connections: SerializableConnection[];
	bounds: { minX: number; minY: number; maxX: number; maxY: number };
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
	buildSockets: (state: NodeState) => NodeSocket[];
	getBodyLabel?: (
		state: NodeState,
		socketValues?: Record<string, NodeSocketValue>,
	) => string | null;
	getFooterLabel?: (
		state: NodeState,
		socketValues?: Record<string, NodeSocketValue>,
	) => string | null;
	getPreviewLabel?: (
		state: NodeState,
		socketValues?: Record<string, NodeSocketValue>,
	) => string | null;
	compile?: (context: NodeCompileContext) => string | null;
};

export type NodeCompileContext = {
	node: NodeView;
	state: NodeState;
	portId: string;
	stage: "vertex" | "fragment";
	getSocketValue: (socketId: string) => NodeSocketValue | null;
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

export type ShaderPreviewTarget = {
	nodeId: number;
	portId?: string;
};

export type ShaderCompileOptions = {
	previewTarget?: ShaderPreviewTarget | null;
	trace?: boolean;
};

export type ShaderCompileResult = {
	vertexSource: string;
	fragmentSource: string;
	messages: ShaderCompileMessage[];
	hasFragmentOutput: boolean;
	nodeCount?: number;
	connectionCount?: number;
	compileMs?: number;
	complexity?: ShaderComplexity;
	performanceWarnings?: ShaderPerformanceWarnings;
	debugTrace?: ShaderDebugTrace;
};

export type ShaderComplexity = {
	vertexInstructions: number;
	fragmentInstructions: number;
	textureSamples: number;
	mathOps: number;
};

export type ShaderPerformanceWarnings = {
	textureSampleNodes: number[];
	complexMathNodes: number[];
};

export type ShaderDebugStep = {
	nodeId: number;
	portId: string;
	stage: "vertex" | "fragment";
	depth: number;
};

export type ShaderDebugNodeInfo = {
	id: number;
	title: string;
	typeId?: string;
};

export type ShaderDebugTrace = {
	steps: ShaderDebugStep[];
	usedNodes: number[];
	usedConnections: string[];
	nodeTimings: Record<number, number>;
	portExpressions: Record<string, string>;
	connectionExpressions: Record<string, string>;
	nodes: ShaderDebugNodeInfo[];
};

export type ShaderCompileStatus = "idle" | "compiling" | "success" | "failed";

export type UiMessageTone = "info" | "warning" | "error";

export type UiMessage = {
	tone: UiMessageTone;
	message: string;
};

export type SocketEditorState = {
	nodeId: number;
	socketId: string;
	label: string;
	dataType: PortType;
	uiSpec: NodeSocketUiSpec;
	value: NodeSocketValue | null;
	screenX: number;
	screenY: number;
	scale: number;
};

export type SocketHoverState = {
	nodeId: number;
	portId: string;
	portName: string;
	direction: PortDirection;
	portType: PortType;
	screenX: number;
	screenY: number;
	isConnected: boolean;
	connectionType?: PortType;
	upstream?: {
		nodeId: number;
		portId: string;
		portName: string;
		portType: PortType;
		value: NodeSocketValue | null;
	};
};

export type InitCanvasOptions = {
	onShaderChange?: (result: ShaderCompileResult) => void;
	onExportRequest?: (result: ShaderCompileResult) => void;
	onCompileStatus?: (status: ShaderCompileStatus) => void;
	onContextMenuChange?: (state: ContextMenuState) => void;
	onUiMessage?: (message: UiMessage) => void;
	onNodeRenameChange?: (state: NodeRenameState | null) => void;
	onSocketEditorChange?: (state: SocketEditorState | null) => void;
	onSelectionChange?: (state: EditorSelectionState) => void;
	onSelectionBoundsChange?: (bounds: SelectionBounds | null) => void;
	onHoverChange?: (state: EditorHoverState) => void;
	debugOverlay?: boolean;
	visualSettings?: Partial<EditorVisualSettings>;
};
