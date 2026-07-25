import { describe, expect, it } from "vitest";
import {
	assertShopOrderTransition,
	canTransitionShopOrder,
} from "#/features/shop-orders/status";

describe("shop order status policy", () => {
	it("allows defined recovery paths and closes terminal orders", () => {
		expect(canTransitionShopOrder("pending_payment", "paid")).toBe(true);
		expect(canTransitionShopOrder("failed", "fulfilling")).toBe(true);
		expect(canTransitionShopOrder("refunding", "completed")).toBe(true);
		expect(canTransitionShopOrder("refunded", "paid")).toBe(false);
		expect(() => assertShopOrderTransition("completed", "paid")).toThrow();
	});
});
