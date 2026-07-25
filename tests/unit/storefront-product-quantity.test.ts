import { describe, expect, it } from "vitest";
import { purchaseMaximum } from "#/features/storefront/product-quantity";

describe("storefront product quantity", () => {
	it("uses the configured maximum for delivery without finite stock", () => {
		expect(purchaseMaximum({ availableStock: -1, maximumQuantity: 8 })).toBe(8);
	});

	it("does not allow card quantity beyond current inventory", () => {
		expect(purchaseMaximum({ availableStock: 3, maximumQuantity: 8 })).toBe(3);
		expect(purchaseMaximum({ availableStock: 12, maximumQuantity: 8 })).toBe(8);
	});
});
