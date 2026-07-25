import { describe, expect, it } from "vitest";
import { couponInputSchema } from "#/features/coupons/schema";

const base = {
	code: "SAVE10",
	name: "Save ten",
	enabled: true,
	productIds: [],
	tagIds: [],
};

describe("coupon input contract", () => {
	it("requires explicit currency precision for monetary coupons", () => {
		expect(() =>
			couponInputSchema.parse({
				...base,
				type: "fixed",
				currency: "CNY",
				valueMinor: "1000",
			}),
		).toThrow();
		expect(
			couponInputSchema.parse({
				...base,
				type: "fixed",
				currency: "cny",
				currencyDecimals: 2,
				valueMinor: "1000",
			}),
		).toMatchObject({ currency: "CNY", currencyDecimals: 2 });
	});

	it("allows global percentages but requires currency for amount thresholds", () => {
		expect(
			couponInputSchema.parse({
				...base,
				type: "percentage",
				valueBps: 1_000,
			}),
		).toMatchObject({ valueBps: 1_000 });
		expect(() =>
			couponInputSchema.parse({
				...base,
				type: "percentage",
				valueBps: 1_000,
				maximumDiscountMinor: "5000",
			}),
		).toThrow();
	});

	it("rejects reversed validity and impossible per-customer limits", () => {
		expect(() =>
			couponInputSchema.parse({
				...base,
				type: "percentage",
				valueBps: 500,
				startsAt: 2_000,
				endsAt: 1_000,
			}),
		).toThrow();
		expect(() =>
			couponInputSchema.parse({
				...base,
				type: "percentage",
				valueBps: 500,
				usageLimit: 2,
				usageLimitPerCustomer: 3,
			}),
		).toThrow();
	});
});
