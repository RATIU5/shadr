import { type Application, Container, Graphics, Text } from "pixi.js";
import type {
	ConnectionState,
	DragState,
	GroupState,
	InteractionState,
	NodeCollectionState,
} from "./editor-state";
import type { ShaderCompileMessage, UiMessage, UiMessageTone } from "./types";

type DebugOverlayOptions = {
	app: Application;
	camera: Container;
	nodeState: NodeCollectionState;
	groupState: GroupState;
	connectionState: ConnectionState;
	interactionState: InteractionState;
	dragState: DragState;
	registerText: (text: Text) => Text;
};

type DebugMessageLine = {
	text: string;
	tone: UiMessageTone;
};

export type DebugOverlay = {
	setEnabled: (enabled: boolean) => void;
	update: () => void;
	recordUiMessage: (message: UiMessage) => void;
	recordShaderMessages: (
		messages: ShaderCompileMessage[],
		compileMs?: number,
	) => void;
	destroy: () => void;
};

const toneColors: Record<UiMessageTone, number> = {
	info: 0x8fb7ff,
	warning: 0xf1c15b,
	error: 0xf0897b,
};

const formatNumber = (value: number, digits = 0) =>
	Number.isFinite(value) ? value.toFixed(digits) : "0";

export const createDebugOverlay = (
	options: DebugOverlayOptions,
): DebugOverlay => {
	const {
		app,
		camera,
		nodeState,
		groupState,
		connectionState,
		interactionState,
		dragState,
		registerText,
	} = options;

	const worldLayer = new Container();
	worldLayer.eventMode = "none";
	camera.addChild(worldLayer);

	const screenLayer = new Container();
	screenLayer.eventMode = "none";
	app.stage.addChild(screenLayer);

	const nodeOutlines = new Graphics();
	worldLayer.addChild(nodeOutlines);

	const nodeLabelPool: Text[] = [];
	const messageLabelPool: Text[] = [];

	const hudBackground = new Graphics();
	const hudText = registerText(
		new Text({
			text: "",
			style: {
				fill: 0xcfe1ff,
				fontFamily: "Arial",
				fontSize: 11,
				lineHeight: 14,
			},
		}),
	);
	const messagesHeader = registerText(
		new Text({
			text: "Messages",
			style: {
				fill: 0xcfd7e6,
				fontFamily: "Arial",
				fontSize: 10,
				letterSpacing: 1,
			},
		}),
	);

	screenLayer.addChild(hudBackground);
	screenLayer.addChild(hudText);
	screenLayer.addChild(messagesHeader);

	const uiMessageBuffer: Array<UiMessage & { time: number }> = [];
	let shaderMessages: ShaderCompileMessage[] = [];
	let lastCompileMs: number | null = null;
	let enabled = true;
	let lastFpsUpdate = 0;
	let cachedFps = 0;

	const maxUiMessages = 6;
	const maxMessageLines = 8;
	const padding = 10;
	const gap = 6;

	const ensureNodeLabel = (index: number) => {
		if (nodeLabelPool[index]) {
			return nodeLabelPool[index];
		}
		const label = registerText(
			new Text({
				text: "",
				style: {
					fill: 0xb5d7ff,
					fontFamily: "Arial",
					fontSize: 10,
				},
			}),
		);
		worldLayer.addChild(label);
		nodeLabelPool[index] = label;
		return label;
	};

	const ensureMessageLabel = (index: number) => {
		if (messageLabelPool[index]) {
			return messageLabelPool[index];
		}
		const label = registerText(
			new Text({
				text: "",
				style: {
					fill: 0xcdd7ea,
					fontFamily: "Arial",
					fontSize: 10,
				},
			}),
		);
		screenLayer.addChild(label);
		messageLabelPool[index] = label;
		return label;
	};

	const updateNodeOverlay = () => {
		nodeOutlines.clear();
		let labelIndex = 0;
		nodeState.nodes.forEach((node) => {
			const selected = nodeState.selectedIds.has(node.id);
			nodeOutlines.setStrokeStyle({
				width: selected ? 2 : 1,
				color: selected ? 0xffd36b : 0x4fa3ff,
				alpha: selected ? 0.85 : 0.45,
				cap: "round",
				join: "round",
			});
			nodeOutlines.rect(
				node.container.position.x,
				node.container.position.y,
				node.width,
				node.height,
			);
			nodeOutlines.stroke();

			const label = ensureNodeLabel(labelIndex++);
			label.text = `#${node.id} (${formatNumber(
				node.container.position.x,
				0,
			)}, ${formatNumber(node.container.position.y, 0)})`;
			label.position.set(
				node.container.position.x + 6,
				node.container.position.y - 14,
			);
			const scale = camera.scale.x || 1;
			label.scale.set(1 / scale, 1 / scale);
			label.visible = true;
		});
		for (let index = labelIndex; index < nodeLabelPool.length; index += 1) {
			nodeLabelPool[index].visible = false;
		}
	};

	const buildMessageLines = (): DebugMessageLine[] => {
		const lines: DebugMessageLine[] = [];
		shaderMessages.forEach((message) => {
			lines.push({
				text: `Shader ${message.kind.toUpperCase()}: ${message.message}`,
				tone: message.kind,
			});
		});

		const uiLines = [...uiMessageBuffer]
			.slice(-maxUiMessages)
			.reverse()
			.map((message) => ({
				text: `${message.tone.toUpperCase()}: ${message.message}`,
				tone: message.tone,
			}));

		lines.push(...uiLines);

		if (lines.length === 0) {
			lines.push({ text: "None", tone: "info" });
		}

		return lines.slice(0, maxMessageLines);
	};

	const updateHud = () => {
		const now = performance.now();
		if (now - lastFpsUpdate > 200) {
			lastFpsUpdate = now;
			const ticker = app.ticker as { deltaMS?: number };
			const deltaMs = ticker.deltaMS ?? 16.6667;
			cachedFps = deltaMs > 0 ? 1000 / deltaMs : 0;
		}

		const uiCounts = uiMessageBuffer.reduce(
			(acc, message) => {
				acc[message.tone] += 1;
				return acc;
			},
			{ info: 0, warning: 0, error: 0 } as Record<UiMessageTone, number>,
		);

		const shaderCounts = shaderMessages.reduce(
			(acc, message) => {
				acc[message.kind] += 1;
				return acc;
			},
			{ warning: 0, error: 0 } as Record<ShaderCompileMessage["kind"], number>,
		);

		const lines = [
			`FPS: ${formatNumber(cachedFps, 0)}`,
			`Scale: ${formatNumber(camera.scale.x || 1, 2)}`,
			`Pivot: ${formatNumber(camera.pivot.x, 1)}, ${formatNumber(
				camera.pivot.y,
				1,
			)}`,
			`Nodes: ${nodeState.nodes.size} (sel ${nodeState.selectedIds.size})`,
			`Groups: ${groupState.groups.size} (sel ${groupState.selectedIds.size})`,
			`Connections: ${connectionState.connections.size}`,
			`Pan: ${
				interactionState.isPanning ? interactionState.panMode : "idle"
			} | Drag: ${dragState.isDragging ? "active" : "idle"}`,
			`Compile: ${
				lastCompileMs === null ? "--" : `${formatNumber(lastCompileMs, 1)}ms`
			}`,
			`Shader: ${shaderCounts.error}E/${shaderCounts.warning}W`,
			`UI: ${uiCounts.error}E/${uiCounts.warning}W/${uiCounts.info}I`,
		];

		hudText.text = lines.join("\n");

		messagesHeader.text = "Messages";
		messagesHeader.position.set(padding, padding + hudText.height + gap);

		const messageLines = buildMessageLines();
		let messageTop = messagesHeader.position.y + messagesHeader.height + gap;
		let maxMessageWidth = messagesHeader.width;
		messageLines.forEach((line, index) => {
			const label = ensureMessageLabel(index);
			label.text = line.text;
			label.style.fill = toneColors[line.tone];
			label.position.set(padding, messageTop);
			label.visible = true;
			messageTop += label.height + 2;
			maxMessageWidth = Math.max(maxMessageWidth, label.width);
		});
		for (
			let index = messageLines.length;
			index < messageLabelPool.length;
			index += 1
		) {
			messageLabelPool[index].visible = false;
		}

		const hudWidth = Math.max(hudText.width, maxMessageWidth) + padding * 2;
		const hudHeight = messageTop + padding;

		hudText.position.set(padding, padding);

		hudBackground.clear();
		hudBackground
			.roundRect(0, 0, hudWidth, hudHeight, 10)
			.fill({ color: 0x0b0f16, alpha: 0.85 });

		screenLayer.position.set(12, 12);
	};

	const update = () => {
		if (!enabled) {
			return;
		}
		updateNodeOverlay();
		updateHud();
	};

	const recordUiMessage = (message: UiMessage) => {
		uiMessageBuffer.push({ ...message, time: performance.now() });
		if (uiMessageBuffer.length > maxUiMessages * 3) {
			uiMessageBuffer.splice(0, uiMessageBuffer.length - maxUiMessages * 3);
		}
	};

	const recordShaderMessages = (
		messages: ShaderCompileMessage[],
		compileMs?: number,
	) => {
		shaderMessages = messages.filter(
			(message) => message.kind === "error" || message.kind === "warning",
		);
		if (typeof compileMs === "number" && Number.isFinite(compileMs)) {
			lastCompileMs = compileMs;
		}
	};

	const setEnabled = (nextEnabled: boolean) => {
		enabled = nextEnabled;
		worldLayer.visible = nextEnabled;
		screenLayer.visible = nextEnabled;
	};

	const destroy = () => {
		worldLayer.destroy({ children: true });
		screenLayer.destroy({ children: true });
	};

	return {
		setEnabled,
		update,
		recordUiMessage,
		recordShaderMessages,
		destroy,
	};
};
