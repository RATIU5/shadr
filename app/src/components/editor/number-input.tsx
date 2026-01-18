import { createEffect, createSignal } from "solid-js";

type NumberInputProps = {
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	class?: string;
	disabled?: boolean;
	placeholder?: string;
	ariaLabel?: string;
	onKeyDown?: (
		event: KeyboardEvent & { currentTarget: HTMLInputElement },
	) => void;
};

const clamp = (value: number, min?: number, max?: number) => {
	let next = value;
	if (min !== undefined) {
		next = Math.max(min, next);
	}
	if (max !== undefined) {
		next = Math.min(max, next);
	}
	return next;
};

const formatNumber = (value: number) =>
	Number.isFinite(value) ? String(value) : "0";

export const NumberInput = (props: NumberInputProps) => {
	const [displayValue, setDisplayValue] = createSignal(
		formatNumber(props.value),
	);
	let inputRef: HTMLInputElement | undefined;
	let isScrubbing = false;
	let pointerId: number | null = null;
	let startX = 0;
	let startValue = 0;
	let scrubStarted = false;

	const getStep = () => props.step ?? 0.01;

	const commitValue = (value: number) => {
		const clamped = clamp(value, props.min, props.max);
		props.onChange(clamped);
		setDisplayValue(formatNumber(clamped));
	};

	createEffect(() => {
		if (inputRef && document.activeElement === inputRef) {
			return;
		}
		if (isScrubbing) {
			return;
		}
		setDisplayValue(formatNumber(props.value));
	});

	const handleInput = (
		event: InputEvent & { currentTarget: HTMLInputElement },
	) => {
		const target = event.currentTarget;
		const raw = target.value;
		setDisplayValue(raw);
		const parsed = Number.parseFloat(raw);
		if (Number.isFinite(parsed)) {
			commitValue(parsed);
		}
	};

	const handleBlur = () => {
		const parsed = Number.parseFloat(displayValue());
		if (Number.isFinite(parsed)) {
			commitValue(parsed);
			return;
		}
		setDisplayValue(formatNumber(props.value));
	};

	const handleWheel = (
		event: WheelEvent & { currentTarget: HTMLInputElement },
	) => {
		if (event.currentTarget !== document.activeElement) {
			return;
		}
		event.preventDefault();
		const step = getStep();
		const direction = event.deltaY > 0 ? -1 : 1;
		const next =
			(Number.isFinite(props.value) ? props.value : 0) + direction * step;
		commitValue(next);
	};

	const handlePointerDown = (
		event: PointerEvent & { currentTarget: HTMLInputElement },
	) => {
		if (event.button !== 0 || props.disabled) {
			return;
		}
		pointerId = event.pointerId;
		startX = event.clientX;
		startValue = Number.isFinite(props.value) ? props.value : 0;
		scrubStarted = false;
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handlePointerMove = (
		event: PointerEvent & { currentTarget: HTMLInputElement },
	) => {
		if (pointerId !== event.pointerId || props.disabled) {
			return;
		}
		const deltaX = event.clientX - startX;
		if (!scrubStarted && Math.abs(deltaX) < 3) {
			return;
		}
		if (!scrubStarted) {
			scrubStarted = true;
			isScrubbing = true;
			document.body.style.cursor = "ew-resize";
		}
		event.preventDefault();
		const step = getStep();
		const multiplier = event.shiftKey ? 0.1 : 1;
		const next = startValue + deltaX * step * multiplier;
		commitValue(next);
	};

	const endScrub = (
		event: PointerEvent & { currentTarget: HTMLInputElement },
	) => {
		if (pointerId !== event.pointerId) {
			return;
		}
		event.currentTarget.releasePointerCapture(event.pointerId);
		pointerId = null;
		if (scrubStarted) {
			isScrubbing = false;
			scrubStarted = false;
			document.body.style.cursor = "";
		}
	};

	return (
		<input
			ref={(element) => {
				inputRef = element;
			}}
			type="text"
			inputMode="decimal"
			spellcheck={false}
			class={props.class}
			value={displayValue()}
			placeholder={props.placeholder}
			disabled={props.disabled}
			aria-label={props.ariaLabel}
			onInput={handleInput}
			onBlur={handleBlur}
			onWheel={handleWheel}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={endScrub}
			onPointerCancel={endScrub}
			onKeyDown={props.onKeyDown}
		/>
	);
};
