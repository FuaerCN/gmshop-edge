// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	cart: {
		items: [] as Array<{ sellableItemId: string; quantity: number }>,
	},
	pathname: "/",
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
		to: string;
	}) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
	useRouterState: ({
		select,
	}: {
		select: (state: { location: { pathname: string } }) => string;
	}) => select({ location: { pathname: mocks.pathname } }),
}));

vi.mock("#/features/storefront/cart-storage", () => ({
	useLocalCart: () => mocks.cart,
}));

vi.mock("#/paraglide/messages", () => ({
	m: {
		store_cart_title: () => "Cart",
		store_mobile_navigation: () => "Mobile navigation",
		store_my_title: () => "My",
		store_nav_shop: () => "Shop",
	},
}));

import {
	MobileBottomNavigation,
	mobileNavigationSection,
} from "#/layouts/public/mobile-bottom-navigation";

describe("mobile bottom navigation", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		(
			globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		mocks.pathname = "/";
		mocks.cart.items = [];
	});

	afterEach(() => {
		delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		container.remove();
		vi.clearAllMocks();
	});

	it.each([
		["/", "shop"],
		["/cart", "cart"],
		["/cart/", "cart"],
		["/me", "my"],
		["/orders", "my"],
		["/account", "my"],
		["/account/profile", "my"],
		["/account/orders", "my"],
		["/account/entitlements/", "my"],
	] as const)("maps %s to the %s section", (pathname, section) => {
		expect(mobileNavigationSection(pathname)).toBe(section);
	});

	it.each([
		"/products/product-id",
		"/checkout",
		"/orders/order-number",
		"/account/orders/order-number",
		"/status",
		"/auth/sign-in",
		"/install",
	])("hides the navigation on %s", (pathname) => {
		expect(mobileNavigationSection(pathname)).toBeNull();
	});

	it("marks the current destination and exposes an accessible cart count", async () => {
		mocks.pathname = "/cart";
		mocks.cart.items = [
			{ sellableItemId: "first", quantity: 70 },
			{ sellableItemId: "second", quantity: 55 },
		];
		const root = createRoot(container);

		await act(async () => root.render(<MobileBottomNavigation />));

		const navigation = container.querySelector("nav");
		expect(navigation?.getAttribute("aria-label")).toBe("Mobile navigation");
		expect(
			container.querySelector('a[href="/cart"]')?.getAttribute("aria-current"),
		).toBe("page");
		expect(
			container.querySelector('a[href="/"]')?.hasAttribute("aria-current"),
		).toBe(false);
		expect(
			container.querySelector('a[href="/"]')?.getAttribute("aria-label"),
		).toBe("Shop");
		expect(
			container.querySelector('a[href="/cart"]')?.getAttribute("aria-label"),
		).toBe("Cart");
		expect(
			container.querySelector('a[href="/me"]')?.getAttribute("aria-label"),
		).toBe("My");
		expect(container.textContent).toContain("99+");
		expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();

		await act(async () => root.unmount());
	});

	it("renders nothing on a flow page", async () => {
		mocks.pathname = "/checkout";
		const root = createRoot(container);

		await act(async () => root.render(<MobileBottomNavigation />));

		expect(container.innerHTML).toBe("");
		await act(async () => root.unmount());
	});
});
