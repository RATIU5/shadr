export type GridSettings = {
	minorStep: number;
	majorStep: number;
	minScreenSpacing: number;
	maxScreenSpacing: number;
	minorColor: number;
	majorColor: number;
	axisColor: number;
	minorAlpha: number;
	majorAlpha: number;
	axisAlpha: number;
};

export type NodeStyleSettings = {
	cornerRadius: number;
	fillColor: number;
	hoverFillColor: number;
	borderColor: number;
	hoverBorderColor: number;
	selectedBorderColor: number;
};

export type GroupStyleSettings = {
	borderColor: number;
	hoverBorderColor: number;
	selectedBorderColor: number;
	fillColor: number;
	fillAlpha: number;
	collapsedFillColor: number;
	collapsedFillAlpha: number;
	borderWidth: number;
	collapsedBorderWidth: number;
};

export type ConnectionStyleSettings = {
	style: "curved" | "straight" | "step" | "orthogonal";
	width: number;
	hoverWidth: number;
	hoverDistance: number;
	hoverSegments: number;
	ghostAlpha: number;
	invalidColor: number;
	invalidAlpha: number;
	showFlow: boolean;
	flowSpacing: number;
	flowSpeed: number;
	flowRadius: number;
	flowAlpha: number;
	emphasisMode: boolean;
	bundleConnections: boolean;
	lodEnabled: boolean;
	lodDistance: number;
	showLabels: boolean;
};

export type EditorVisualSettings = {
	backgroundColor: number;
	debugOverlay: boolean;
	grid: GridSettings;
	nodes: NodeStyleSettings;
	groups: GroupStyleSettings;
	connections: ConnectionStyleSettings;
};

export const defaultVisualSettings: EditorVisualSettings = {
	backgroundColor: 0x0d0f14,
	debugOverlay: false,
	grid: {
		minorStep: 32,
		majorStep: 160,
		minScreenSpacing: 12,
		maxScreenSpacing: 96,
		minorColor: 0xd6d6d6,
		majorColor: 0xb0b0b0,
		axisColor: 0x8a8a8a,
		minorAlpha: 0.05,
		majorAlpha: 0.05,
		axisAlpha: 0.05,
	},
	nodes: {
		cornerRadius: 6,
		fillColor: 0xf4f4f4,
		hoverFillColor: 0xfafafa,
		borderColor: 0x6b6b6b,
		hoverBorderColor: 0x4a4a4a,
		selectedBorderColor: 0x2f6fed,
	},
	groups: {
		borderColor: 0x6b6b6b,
		hoverBorderColor: 0x4a4a4a,
		selectedBorderColor: 0x2f6fed,
		fillColor: 0x9aa7c7,
		fillAlpha: 0.08,
		collapsedFillColor: 0xf4f4f4,
		collapsedFillAlpha: 1,
		borderWidth: 1,
		collapsedBorderWidth: 2,
	},
	connections: {
		style: "curved",
		width: 1,
		hoverWidth: 3,
		hoverDistance: 10,
		hoverSegments: 12,
		ghostAlpha: 0.45,
		invalidColor: 0xe05a5a,
		invalidAlpha: 0.6,
		showFlow: false,
		flowSpacing: 36,
		flowSpeed: 120,
		flowRadius: 2.5,
		flowAlpha: 0.7,
		emphasisMode: false,
		bundleConnections: false,
		lodEnabled: true,
		lodDistance: 900,
		showLabels: false,
	},
};
