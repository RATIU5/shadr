import type { NodeView } from "./types";

type ConstEditorOptions = {
	container: HTMLElement;
	canvas: HTMLCanvasElement;
	getNodeById: (id: number) => NodeView | undefined;
	onCommit: () => void;
};

export type ConstEditorController = {
	isOpen: () => boolean;
	open: (node: NodeView) => void;
	close: () => void;
	renderValue: (node: NodeView) => void;
	dispose: () => void;
};

type ConstColor = { r: number; g: number; b: number; a: number };
type ConstVector = { x: number; y: number; z: number; w: number };

const defaultConstColor: ConstColor = { r: 1, g: 1, b: 1, a: 1 };
const defaultConstVector: ConstVector = { x: 0, y: 0, z: 0, w: 0 };
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const formatDisplayFloat = (value: number) => {
	if (!Number.isFinite(value)) {
		return "0";
	}
	const rounded = Math.round(value * 1000) / 1000;
	return rounded.toString();
};
const formatDisplayVector = (values: number[]) =>
	values.map((value) => formatDisplayFloat(value)).join(", ");
const formatDisplayColor = (color: { r: number; g: number; b: number }) => {
	const channel = (value: number) =>
		Math.min(255, Math.max(0, Math.round(value * 255)))
			.toString(16)
			.padStart(2, "0");
	return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
};
const parseHexColor = (value: string) => {
	const normalized = value.replace("#", "");
	if (normalized.length !== 6) {
		return null;
	}
	const r = Number.parseInt(normalized.slice(0, 2), 16);
	const g = Number.parseInt(normalized.slice(2, 4), 16);
	const b = Number.parseInt(normalized.slice(4, 6), 16);
	if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
		return null;
	}
	return {
		r: r / 255,
		g: g / 255,
		b: b / 255,
	};
};

export const createConstEditor = ({
	container,
	canvas,
	getNodeById,
	onCommit,
}: ConstEditorOptions): ConstEditorController => {
	let isOpen = false;
	let nodeId: number | null = null;

	const constEditor = document.createElement("div");
	constEditor.className = "node-const-editor";
	const constEditorPanel = document.createElement("div");
	constEditorPanel.className = "node-const-editor__panel";
	const constFloatRow = document.createElement("div");
	const constFloatRowClass =
		"node-const-editor__row node-const-editor__row--float";
	constFloatRow.className = constFloatRowClass;
	const constFloatInput = document.createElement("input");
	constFloatInput.type = "number";
	constFloatInput.step = "0.01";
	constFloatInput.className = "node-const-editor__input";
	constFloatRow.append(constFloatInput);
	const constColorRow = document.createElement("div");
	const constColorRowClass =
		"node-const-editor__row node-const-editor__row--color";
	constColorRow.className = constColorRowClass;
	const constColorInput = document.createElement("input");
	constColorInput.type = "color";
	constColorInput.className = "node-const-editor__color";
	const constAlphaInput = document.createElement("input");
	constAlphaInput.type = "number";
	constAlphaInput.step = "0.01";
	constAlphaInput.min = "0";
	constAlphaInput.max = "1";
	constAlphaInput.className = "node-const-editor__input";
	constAlphaInput.placeholder = "Alpha";
	constColorRow.append(constColorInput, constAlphaInput);
	const createVectorInput = (placeholder: string) => {
		const input = document.createElement("input");
		input.type = "number";
		input.step = "0.01";
		input.className = "node-const-editor__input node-const-editor__input--vec";
		input.placeholder = placeholder;
		return input;
	};
	const createVectorRow = (
		mode: "vec2" | "vec3" | "vec4",
		labels: string[],
	) => {
		const row = document.createElement("div");
		row.className = `node-const-editor__row node-const-editor__row--${mode}`;
		const inputs = labels.map((label) => createVectorInput(label));
		row.append(...inputs);
		return { row, inputs };
	};

	const vec2Row = createVectorRow("vec2", ["X", "Y"]);
	const vec3Row = createVectorRow("vec3", ["X", "Y", "Z"]);
	const vec4Row = createVectorRow("vec4", ["X", "Y", "Z", "W"]);
	constEditorPanel.append(
		constFloatRow,
		constColorRow,
		vec2Row.row,
		vec3Row.row,
		vec4Row.row,
	);
	constEditor.append(constEditorPanel);
	container.appendChild(constEditor);

	const getVectorValues = (node: NodeView) => {
		const vector = node.data?.vector ?? defaultConstVector;
		return {
			x: vector.x,
			y: vector.y,
			z: vector.z ?? defaultConstVector.z,
			w: vector.w ?? defaultConstVector.w,
		};
	};

	const renderValue = (node: NodeView) => {
		if (!node.valueLabel) {
			return;
		}

		if (node.templateId === "const-float") {
			const value = node.data?.value ?? 0;
			node.valueLabel.text = `Value: ${formatDisplayFloat(value)}`;
			return;
		}

		if (node.templateId === "const-color") {
			const color = node.data?.color ?? defaultConstColor;
			const alpha = clamp01(color.a);
			node.valueLabel.text = `Color: ${formatDisplayColor(color)}  a:${formatDisplayFloat(alpha)}`;
			return;
		}

		if (node.templateId === "const-vec2") {
			const vector = getVectorValues(node);
			node.valueLabel.text = `Value: (${formatDisplayVector([
				vector.x,
				vector.y,
			])})`;
			return;
		}

		if (node.templateId === "const-vec3") {
			const vector = getVectorValues(node);
			node.valueLabel.text = `Value: (${formatDisplayVector([
				vector.x,
				vector.y,
				vector.z,
			])})`;
			return;
		}

		if (node.templateId === "const-vec4") {
			const vector = getVectorValues(node);
			node.valueLabel.text = `Value: (${formatDisplayVector([
				vector.x,
				vector.y,
				vector.z,
				vector.w,
			])})`;
		}
	};

	const positionEditor = (node: NodeView) => {
		const world = node.container.toGlobal({ x: 0, y: 0 });
		const rect = canvas.getBoundingClientRect();
		const left = world.x + rect.left;
		const top = world.y + rect.top;
		constEditor.style.left = `${left + 8}px`;
		constEditor.style.top = `${top + 8}px`;
	};

	const close = () => {
		if (!isOpen) {
			return;
		}
		isOpen = false;
		nodeId = null;
		constEditor.classList.remove("node-const-editor--open");
	};

	const open = (node: NodeView) => {
		if (
			node.templateId !== "const-float" &&
			node.templateId !== "const-color" &&
			node.templateId !== "const-vec2" &&
			node.templateId !== "const-vec3" &&
			node.templateId !== "const-vec4"
		) {
			return;
		}

		isOpen = true;
		nodeId = node.id;
		if (node.templateId === "const-float") {
			constEditor.dataset.mode = "float";
		} else if (node.templateId === "const-color") {
			constEditor.dataset.mode = "color";
		} else if (node.templateId === "const-vec2") {
			constEditor.dataset.mode = "vec2";
		} else if (node.templateId === "const-vec3") {
			constEditor.dataset.mode = "vec3";
		} else {
			constEditor.dataset.mode = "vec4";
		}
		positionEditor(node);

		if (node.templateId === "const-float") {
			const value = node.data?.value ?? 0;
			constFloatInput.value = Number.isFinite(value) ? value.toString() : "0";
			constEditor.classList.add("node-const-editor--open");
			constFloatInput.focus();
			constFloatInput.select();
			return;
		}

		if (node.templateId === "const-color") {
			const color = node.data?.color ?? defaultConstColor;
			constColorInput.value = formatDisplayColor(color);
			constAlphaInput.value = clamp01(color.a).toString();
			constEditor.classList.add("node-const-editor--open");
			constColorInput.focus();
			return;
		}

		const vector = getVectorValues(node);
		if (node.templateId === "const-vec2") {
			vec2Row.inputs[0].value = vector.x.toString();
			vec2Row.inputs[1].value = vector.y.toString();
			constEditor.classList.add("node-const-editor--open");
			vec2Row.inputs[0].focus();
			vec2Row.inputs[0].select();
			return;
		}

		if (node.templateId === "const-vec3") {
			vec3Row.inputs[0].value = vector.x.toString();
			vec3Row.inputs[1].value = vector.y.toString();
			vec3Row.inputs[2].value = vector.z.toString();
			constEditor.classList.add("node-const-editor--open");
			vec3Row.inputs[0].focus();
			vec3Row.inputs[0].select();
			return;
		}

		vec4Row.inputs[0].value = vector.x.toString();
		vec4Row.inputs[1].value = vector.y.toString();
		vec4Row.inputs[2].value = vector.z.toString();
		vec4Row.inputs[3].value = vector.w.toString();
		constEditor.classList.add("node-const-editor--open");
		vec4Row.inputs[0].focus();
	};

	const applyValue = () => {
		if (nodeId === null) {
			return;
		}
		const node = getNodeById(nodeId);
		if (!node) {
			close();
			return;
		}

		if (node.templateId === "const-float") {
			const nextValue = Number.parseFloat(constFloatInput.value);
			const normalized = Number.isFinite(nextValue) ? nextValue : 0;
			const current = node.data?.value ?? 0;
			if (normalized !== current) {
				node.data = { value: normalized };
				renderValue(node);
				onCommit();
			}
			return;
		}

		if (node.templateId === "const-color") {
			const rgb = parseHexColor(constColorInput.value) ?? {
				r: 1,
				g: 1,
				b: 1,
			};
			const alphaValue = Number.parseFloat(constAlphaInput.value);
			const alpha = clamp01(Number.isFinite(alphaValue) ? alphaValue : 1);
			const nextColor = {
				r: clamp01(rgb.r),
				g: clamp01(rgb.g),
				b: clamp01(rgb.b),
				a: alpha,
			};
			const current = node.data?.color ?? defaultConstColor;
			const didChange =
				nextColor.r !== current.r ||
				nextColor.g !== current.g ||
				nextColor.b !== current.b ||
				nextColor.a !== current.a;
			if (didChange) {
				node.data = { color: nextColor };
				renderValue(node);
				onCommit();
			}
			return;
		}

		const parseVectorInput = (input: HTMLInputElement) => {
			const value = Number.parseFloat(input.value);
			return Number.isFinite(value) ? value : 0;
		};

		const currentVector = node.data?.vector ?? defaultConstVector;

		if (node.templateId === "const-vec2") {
			const nextVector = {
				x: parseVectorInput(vec2Row.inputs[0]),
				y: parseVectorInput(vec2Row.inputs[1]),
			};
			const didChange =
				nextVector.x !== currentVector.x || nextVector.y !== currentVector.y;
			if (didChange) {
				node.data = { vector: nextVector };
				renderValue(node);
				onCommit();
			}
			return;
		}

		if (node.templateId === "const-vec3") {
			const nextVector = {
				x: parseVectorInput(vec3Row.inputs[0]),
				y: parseVectorInput(vec3Row.inputs[1]),
				z: parseVectorInput(vec3Row.inputs[2]),
			};
			const didChange =
				nextVector.x !== currentVector.x ||
				nextVector.y !== currentVector.y ||
				nextVector.z !== currentVector.z;
			if (didChange) {
				node.data = { vector: nextVector };
				renderValue(node);
				onCommit();
			}
			return;
		}

		if (node.templateId === "const-vec4") {
			const nextVector = {
				x: parseVectorInput(vec4Row.inputs[0]),
				y: parseVectorInput(vec4Row.inputs[1]),
				z: parseVectorInput(vec4Row.inputs[2]),
				w: parseVectorInput(vec4Row.inputs[3]),
			};
			const didChange =
				nextVector.x !== currentVector.x ||
				nextVector.y !== currentVector.y ||
				nextVector.z !== currentVector.z ||
				nextVector.w !== currentVector.w;
			if (didChange) {
				node.data = { vector: nextVector };
				renderValue(node);
				onCommit();
			}
		}
	};

	const handleConstEditorKeyDown = (event: KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			applyValue();
			close();
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			close();
		}
	};

	const handleConstEditorBlur = () => {
		setTimeout(() => {
			if (constEditor.contains(document.activeElement)) {
				return;
			}
			applyValue();
			close();
		}, 0);
	};

	const handleConstEditorPointerDown = (event: PointerEvent) => {
		event.stopPropagation();
	};

	constFloatInput.addEventListener("keydown", handleConstEditorKeyDown);
	constFloatInput.addEventListener("blur", handleConstEditorBlur);
	constColorInput.addEventListener("keydown", handleConstEditorKeyDown);
	constColorInput.addEventListener("blur", handleConstEditorBlur);
	constAlphaInput.addEventListener("keydown", handleConstEditorKeyDown);
	constAlphaInput.addEventListener("blur", handleConstEditorBlur);
	[...vec2Row.inputs, ...vec3Row.inputs, ...vec4Row.inputs].forEach((input) => {
		input.addEventListener("keydown", handleConstEditorKeyDown);
		input.addEventListener("blur", handleConstEditorBlur);
	});
	constEditor.addEventListener("pointerdown", handleConstEditorPointerDown);

	const dispose = () => {
		constFloatInput.removeEventListener("keydown", handleConstEditorKeyDown);
		constFloatInput.removeEventListener("blur", handleConstEditorBlur);
		constColorInput.removeEventListener("keydown", handleConstEditorKeyDown);
		constColorInput.removeEventListener("blur", handleConstEditorBlur);
		constAlphaInput.removeEventListener("keydown", handleConstEditorKeyDown);
		constAlphaInput.removeEventListener("blur", handleConstEditorBlur);
		[...vec2Row.inputs, ...vec3Row.inputs, ...vec4Row.inputs].forEach(
			(input) => {
				input.removeEventListener("keydown", handleConstEditorKeyDown);
				input.removeEventListener("blur", handleConstEditorBlur);
			},
		);
		constEditor.removeEventListener(
			"pointerdown",
			handleConstEditorPointerDown,
		);
		constEditor.remove();
	};

	return {
		isOpen: () => isOpen,
		open,
		close,
		renderValue,
		dispose,
	};
};
