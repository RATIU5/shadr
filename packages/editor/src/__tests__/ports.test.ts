import { describe, expect, it } from "vitest";
import { arePortTypesCompatible, resolveConnectionType } from "../editor-state";
import type { PortType } from "../types";

describe("port type compatibility", () => {
	const truthyPairs: Array<[PortType, PortType]> = [
		["float", "float"],
		["float", "int"],
		["int", "float"],
		["float", "vec2"],
		["float", "vec3"],
		["float", "vec4"],
		["vec2", "vec2"],
		["vec2", "vec3"],
		["vec2", "vec4"],
		["vec3", "vec3"],
		["vec3", "vec2"],
		["vec3", "vec4"],
		["vec4", "vec4"],
		["vec4", "vec2"],
		["vec4", "vec3"],
		["color", "color"],
		["color", "vec4"],
		["color", "vec3"],
		["vec4", "color"],
		["vec3", "color"],
	];

	for (const [first, second] of truthyPairs) {
		it(`allows ${first} -> ${second}`, () => {
			expect(arePortTypesCompatible(first, second)).toBe(true);
		});
	}

	it("rejects mismatched types that are not compatible", () => {
		expect(arePortTypesCompatible("vec2", "float")).toBe(false);
		expect(arePortTypesCompatible("texture", "color")).toBe(false);
	});
});

describe("connection type resolution", () => {
	it("prefers color when either side is color-compatible", () => {
		expect(resolveConnectionType("color", "vec4")).toBe("color");
		expect(resolveConnectionType("vec4", "color")).toBe("color");
		expect(resolveConnectionType("color", "color")).toBe("color");
	});

	it("uses the input type when converting color to vec3", () => {
		expect(resolveConnectionType("color", "vec3")).toBe("vec3");
		expect(resolveConnectionType("vec3", "color")).toBe("color");
	});

	it("preserves the non-color type for matching connections", () => {
		expect(resolveConnectionType("vec2", "vec2")).toBe("vec2");
		expect(resolveConnectionType("float", "float")).toBe("float");
	});
});
