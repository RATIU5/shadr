import { applyPan, applyZoom } from "../controls";

type CameraState = {
	pivotX: number;
	pivotY: number;
	scale: number;
};

type TestCase = {
	name: string;
	run: () => void;
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

const assert = (condition: boolean, message: string) => {
	if (!condition) {
		throw new Error(message);
	}
};

const assertClose = (
	value: number,
	expected: number,
	epsilon: number,
	message: string,
) => {
	if (Math.abs(value - expected) > epsilon) {
		throw new Error(message);
	}
};

const runTest = ({ name, run }: TestCase) => {
	try {
		run();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`${name} failed: ${message}`);
	}
};

export const runCameraControlTests = () => {
	runTest({
		name: "pans by delta adjusted for scale",
		run: () => {
			const next = applyPan(createState({ pivotX: 12, pivotY: -8, scale: 2 }), {
				deltaX: 10,
				deltaY: -20,
			});

			assert(next.pivotX === 7, "expected pivotX to be 7");
			assert(next.pivotY === 2, "expected pivotY to be 2");
			assert(next.scale === 2, "expected scale to remain unchanged");
		},
	});

	runTest({
		name: "clamps zoom to configured limits",
		run: () => {
			const state = createState({ scale: 4, pivotX: 3, pivotY: 4 });
			const next = applyZoom(state, {
				cursorX: 400,
				cursorY: 300,
				deltaY: -9999,
				screenHeight: 600,
				screenWidth: 800,
				limits: { min: 0.25, max: 4 },
			});

			assert(next.scale === 4, "expected scale to remain at max");
			assert(next.pivotX === state.pivotX, "expected pivotX to remain");
			assert(next.pivotY === state.pivotY, "expected pivotY to remain");
		},
	});

	runTest({
		name: "keeps the cursor world point steady while zooming",
		run: () => {
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

			assertClose(after.x, before.x, 1e-6, "expected world X stable");
			assertClose(after.y, before.y, 1e-6, "expected world Y stable");
		},
	});
};
