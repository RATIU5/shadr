import type {
	Connection,
	ConnectionDrag,
	GroupView,
	NodeView,
	PortType,
	SerializableGraph,
} from "./types";
import {
	type ConnectionStyleSettings,
	defaultVisualSettings,
} from "./visual-settings";

export type InteractionState = {
	isPanning: boolean;
	pointerId: number | null;
	lastX: number;
	lastY: number;
	startPivotX: number;
	startPivotY: number;
	spacePressed: boolean;
	panMode: "default" | "space" | "middle";
};

export type DragState = {
	isDragging: boolean;
	pointerId: number | null;
	anchorId: number | null;
	groupId: number | null;
	offsetX: number;
	offsetY: number;
	startPositions: Map<number, { x: number; y: number }>;
	groupStart: { x: number; y: number } | null;
};

export type NodeCollectionState = {
	nextId: number;
	nodes: Map<number, NodeView>;
	selectedIds: Set<number>;
	suppressPanPointerId: number | null;
};

export type GroupState = {
	nextId: number;
	groups: Map<number, GroupView>;
	selectedIds: Set<number>;
	nodeToGroup: Map<number, number>;
};

export type ConnectionState = {
	connections: Map<string, Connection>;
	active: ConnectionDrag | null;
	hoverId: string | null;
	selectedIds: Set<string>;
};

export type HistoryState = {
	past: SerializableGraph[];
	current: SerializableGraph | null;
	future: SerializableGraph[];
	currentSerialized: string;
};

export type ContextMenuStateInternal = {
	isOpen: boolean;
	screenX: number;
	screenY: number;
	worldX: number;
	worldY: number;
};

export type EditorState = {
	interactionState: InteractionState;
	dragState: DragState;
	nodeState: NodeCollectionState;
	groupState: GroupState;
	connectionState: ConnectionState;
	historyState: HistoryState;
	contextMenuState: ContextMenuStateInternal;
};

export type ZoomLimits = {
	min: number;
	max: number;
};

export type NodeDimensions = {
	width: number;
	height: number;
};

export type PortStyles = {
	radius: number;
	hoverRadius: number;
	hitRadius: number;
	hoverStroke: number;
	dragStrokeValid: number;
	dragStrokeInvalid: number;
	dragStrokeAlpha: number;
	startY: number;
	spacing: number;
	labelOffset: number;
	outputLabelOffset: number;
};

export type ConnectionStyles = ConnectionStyleSettings;

export const zoomLimits: ZoomLimits = {
	min: 0.25,
	max: 4,
};

export const nodeDimensions: NodeDimensions = {
	width: 180,
	height: 84,
};

export const portStyles: PortStyles = {
	radius: 5,
	hoverRadius: 7,
	hitRadius: 12,
	hoverStroke: 2,
	dragStrokeValid: 0x3bb54a,
	dragStrokeInvalid: 0xe05a5a,
	dragStrokeAlpha: 0.9,
	startY: 44,
	spacing: 18,
	labelOffset: 10,
	outputLabelOffset: 72,
};

export const connectionStyles: ConnectionStyles = {
	...defaultVisualSettings.connections,
};

export const arePortTypesCompatible = (first: PortType, second: PortType) =>
	first === second ||
	(first === "color" && second === "vec4") ||
	(first === "vec4" && second === "color");

export const resolveConnectionType = (
	first: PortType,
	second: PortType,
): PortType => (first === "color" || second === "color" ? "color" : first);

export const createEditorState = (): EditorState => ({
	interactionState: {
		isPanning: false,
		pointerId: null,
		lastX: 0,
		lastY: 0,
		startPivotX: 0,
		startPivotY: 0,
		spacePressed: false,
		panMode: "default",
	},
	dragState: {
		isDragging: false,
		pointerId: null,
		anchorId: null,
		groupId: null,
		offsetX: 0,
		offsetY: 0,
		startPositions: new Map<number, { x: number; y: number }>(),
		groupStart: null,
	},
	nodeState: {
		nextId: 1,
		nodes: new Map<number, NodeView>(),
		selectedIds: new Set<number>(),
		suppressPanPointerId: null,
	},
	groupState: {
		nextId: 1,
		groups: new Map<number, GroupView>(),
		selectedIds: new Set<number>(),
		nodeToGroup: new Map<number, number>(),
	},
	connectionState: {
		connections: new Map<string, Connection>(),
		active: null,
		hoverId: null,
		selectedIds: new Set<string>(),
	},
	historyState: {
		past: [],
		current: null,
		future: [],
		currentSerialized: "",
	},
	contextMenuState: {
		isOpen: false,
		screenX: 0,
		screenY: 0,
		worldX: 0,
		worldY: 0,
	},
});
