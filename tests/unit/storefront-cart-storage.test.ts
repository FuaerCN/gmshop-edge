// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
	addLocalCartItem,
	readLocalCart,
	writeLocalCart,
} from "#/features/storefront/cart-storage";

describe("guest storefront cart", () => {
	beforeEach(() => {
		localStorage.clear();
		writeLocalCart([]);
	});

	it("uses the same item collection for one or multiple products", () => {
		expect(addLocalCartItem("plan-a", 1, 2)).toBe(true);
		expect(readLocalCart().items).toEqual([
			{ sellableItemId: "plan-a", quantity: 1 },
		]);

		expect(addLocalCartItem("plan-b", 2, 2)).toBe(true);
		expect(readLocalCart().items).toEqual([
			{ sellableItemId: "plan-a", quantity: 1 },
			{ sellableItemId: "plan-b", quantity: 2 },
		]);
	});

	it("rejects additions beyond the current purchase limit without mutating the cart", () => {
		expect(addLocalCartItem("plan-a", 1, 1)).toBe(true);
		expect(addLocalCartItem("plan-a", 1, 1)).toBe(false);
		expect(readLocalCart().items).toEqual([
			{ sellableItemId: "plan-a", quantity: 1 },
		]);
	});
});
