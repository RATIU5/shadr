import { describe, expect, it } from "vitest";
import { getFamilyPorts } from "../node-families";

describe("node family ports", () => {
	it("regenerates math ports when operation or type changes", () => {
		const addFloatPorts = getFamilyPorts("math", {
			mathOp: "add",
			mathType: "float",
		});
		const lerpVec3Ports = getFamilyPorts("math", {
			mathOp: "lerp",
			mathType: "vec3",
		});

		expect(addFloatPorts.length).not.toBe(lerpVec3Ports.length);
		expect(addFloatPorts[addFloatPorts.length - 1]?.type).toBe("float");
		expect(lerpVec3Ports[lerpVec3Ports.length - 1]?.type).toBe("vec3");
	});

	it("regenerates vector ports when operation changes", () => {
		const composePorts = getFamilyPorts("vector", {
			vectorOp: "compose",
			vectorType: "vec2",
		});
		const splitPorts = getFamilyPorts("vector", {
			vectorOp: "split",
			vectorType: "vec2",
		});

		expect(composePorts.length).not.toBe(splitPorts.length);
		const splitOutputPorts = splitPorts.filter(
			(port) => port.direction === "output",
		);
		expect(splitOutputPorts.length).toBe(2);
	});
});
