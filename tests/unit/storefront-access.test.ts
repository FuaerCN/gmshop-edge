import { describe, expect, it } from "vitest";
import {
	hasStorefrontPermission,
	requireStorefrontPermission,
} from "#/features/access/storefront-access";

describe("storefront access policy", () => {
	it("keeps guest access public and bounded without an account", () => {
		expect(hasStorefrontPermission("guest", "catalog.read")).toBe(true);
		expect(hasStorefrontPermission("guest", "checkout.create")).toBe(true);
		expect(hasStorefrontPermission("guest", "account.read")).toBe(false);
		expect(() => requireStorefrontPermission("guest", "library.read")).toThrow(
			"Storefront access is denied",
		);
	});

	it("allows authenticated customers to manage only their storefront account", () => {
		expect(hasStorefrontPermission("customer", "account.read")).toBe(true);
		expect(hasStorefrontPermission("customer", "cart.manage")).toBe(true);
		expect(hasStorefrontPermission("customer", "library.read")).toBe(true);
	});
});
