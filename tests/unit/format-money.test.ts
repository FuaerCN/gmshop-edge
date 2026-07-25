import { describe, expect, it } from "vitest";
import {
	formatBasisPoints,
	formatMinorAmount,
	formatMinorAmountWithSymbol,
} from "#/lib/format";

describe("minor-unit money formatting", () => {
	it("keeps bigint precision and uses the locale decimal separator", () => {
		expect(formatMinorAmount("123456", "usd", 2, "en-US")).toBe("USD 1,234.56");
		expect(formatMinorAmount("123456", "eur", 2, "de-DE")).toBe("EUR 1.234,56");
		expect(formatMinorAmount("-123456", "usd", 2, "en-US")).toBe(
			"USD -1,234.56",
		);
		expect(formatMinorAmount("900719925474099312345", "jpy", 0, "en-US")).toBe(
			"JPY 900,719,925,474,099,312,345",
		);
	});

	it("formats dashboard amounts with the currency symbol before the value", () => {
		expect(formatMinorAmountWithSymbol("123456", "USD", 2, "en-US")).toBe(
			"$1,234.56",
		);
		expect(formatMinorAmountWithSymbol("-123456", "CNY", 2, "zh-CN")).toBe(
			"-¥1,234.56",
		);
	});

	it("formats basis points as a localized percentage", () => {
		expect(formatBasisPoints(1_250, "en-US")).toBe("12.50%");
		expect(formatBasisPoints(1_000, "zh-CN")).toBe("10%");
	});
});
