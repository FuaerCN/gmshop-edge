import { describe, expect, it } from "vitest";
import { formatMinorInput, parseMajorInput } from "#/lib/money-input";

describe("money form input", () => {
	it("formats integer minor units as a customer-facing decimal", () => {
		expect(formatMinorInput("0", 2)).toBe("0.00");
		expect(formatMinorInput("1050", 2)).toBe("10.50");
		expect(formatMinorInput("42", 0)).toBe("42");
		expect(formatMinorInput(null, 2)).toBe("");
	});

	it("parses decimals without floating-point arithmetic", () => {
		expect(parseMajorInput("10.50", 2)).toBe("1050");
		expect(parseMajorInput("10.5", 2)).toBe("1050");
		expect(parseMajorInput("0.01", 2)).toBe("1");
		expect(parseMajorInput("", 2)).toBeNull();
		expect(parseMajorInput("10.001", 2)).toBeUndefined();
	});
});
