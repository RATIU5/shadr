import { describe, expect, it } from "vitest";
import { applyPan, applyZoom } from "../controls";

type CameraState = {
	pivotX: number;
	pivotY: number;
	scale: number;
};

const createState = (overrides: Partial<CameraState> = {}): CameraState => ({
	pivotX: 0,
	pivotY: 0,
	scale: 1,
	...overrides,
});

const worldFromScreen = (
	state: CameraState,
	cursorX: number,
	cursorY: number,
	screenWidth: number,
	screenHeight: number,
) => ({
	x: state.pivotX + (cursorX - screenWidth / 2) / state.scale,
	y: state.pivotY + (cursorY - screenHeight / 2) / state.scale,
});

describe("camera controls", () => {
	it("pans by delta adjusted for scale", () => {
		const next = applyPan(createState({ pivotX: 12, pivotY: -8, scale: 2 }), {
			deltaX: 10,
			deltaY: -20,
		});

		expect(next.pivotX).toBe(7);
		expect(next.pivotY).toBe(2);
		expect(next.scale).toBe(2);
	});

	it("clamps zoom to configured limits", () => {
		const state = createState({ scale: 4, pivotX: 3, pivotY: 4 });
		const next = applyZoom(state, {
			cursorX: 400,
			cursorY: 300,
			deltaY: -9999,
			screenHeight: 600,
			screenWidth: 800,
			limits: { min: 0.25, max: 4 },
		});

		expect(next.scale).toBe(4);
		expect(next.pivotX).toBe(state.pivotX);
		expect(next.pivotY).toBe(state.pivotY);
	});

	it("keeps the cursor world point steady while zooming", () => {
		const state = createState({ pivotX: 10, pivotY: -6, scale: 1.5 });
		const screenWidth = 900;
		const screenHeight = 700;
		const cursorX = 120;
		const cursorY = 480;

		const before = worldFromScreen(
			state,
			cursorX,
			cursorY,
			screenWidth,
			screenHeight,
		);
		const next = applyZoom(state, {
			cursorX,
			cursorY,
			deltaY: -120,
			screenHeight,
			screenWidth,
			limits: { min: 0.25, max: 4 },
		});
		const after = worldFromScreen(
			next,
			cursorX,
			cursorY,
			screenWidth,
			screenHeight,
		);

		expect(after.x).toBeCloseTo(before.x, 6);
		expect(after.y).toBeCloseTo(before.y, 6);
	});
});
