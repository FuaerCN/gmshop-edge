import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
	readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("storefront account-required purchase guidance", () => {
	it("guides guests to sign in from automation product purchases", () => {
		const product = source("src/features/storefront/pages/product.tsx");

		expect(product).toContain('selectedItem?.deliveryType === "automation"');
		expect(product).toContain("m.store_account_required_description()");
		expect(product).toContain("search={{ redirect: checkoutPath }}");
		expect(product).toContain('to="/sign-in"');
	});

	it("replaces guest checkout actions with a sign-in return path", () => {
		const cart = source("src/features/storefront/pages/cart.tsx");
		const checkout = source("src/features/storefront/pages/checkout.tsx");

		for (const page of [cart, checkout]) {
			expect(page).toContain('item.deliveryType === "automation"');
			expect(page).toContain("m.store_sign_in_to_purchase()");
			expect(page).toContain('to="/sign-in"');
		}
		expect(cart).toContain('search={{ redirect: "/checkout" }}');
		expect(checkout).toContain("signInRequired ||");
		expect(checkout).toContain("search={{ redirect: checkoutPath }}");
	});
});
