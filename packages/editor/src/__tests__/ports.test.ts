import { describe, expect, it } from "vitest";
import { arePortTypesCompatible, resolveConnectionType } from "../editor-state";
import type { PortType } from "../types";

describe("port type compatibility", () => {
	const truthyPairs: Array<[PortType, PortType]> = [
		["float", "float"],
		["vec2", "vec2"],
		["vec3", "vec3"],
		["vec4", "vec4"],
		["color", "color"],
		["color", "vec4"],
		["vec4", "color"],
	];

	for (const [first, second] of truthyPairs) {
		it(`allows ${first} <-> ${second}`, () => {
			expect(arePortTypesCompatible(first, second)).toBe(true);
		});
	}

	it("rejects mismatched types that are not color/vec4 compatible", () => {
		expect(arePortTypesCompatible("float", "vec2")).toBe(false);
		expect(arePortTypesCompatible("color", "vec3")).toBe(false);
		expect(arePortTypesCompatible("texture", "color")).toBe(false);
	});
});

describe("connection type resolution", () => {
	it("prefers color when either side is color-compatible", () => {
		expect(resolveConnectionType("color", "vec4")).toBe("color");
		expect(resolveConnectionType("vec4", "color")).toBe("color");
		expect(resolveConnectionType("color", "color")).toBe("color");
	});

	it("preserves the non-color type for matching connections", () => {
		expect(resolveConnectionType("vec2", "vec2")).toBe("vec2");
		expect(resolveConnectionType("float", "float")).toBe("float");
	});
});
