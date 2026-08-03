// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	session: {
		data: null as {
			user: {
				email: string;
				image: string | null;
				name: string;
			};
		} | null,
		isPending: false,
	},
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({ data: { root: false } }),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
		<a href={to}>{children}</a>
	),
}));

vi.mock("#/features/auth/auth-client", () => ({
	authClient: {
		useSession: () => mocks.session,
	},
}));

vi.mock("#/features/auth/server/session", () => ({
	getStorefrontAdminEntryFn: vi.fn(),
}));

vi.mock("#/features/exchange-rates/currency-context", () => ({
	useCurrency: () => ({
		currency: "USD",
		currencies: ["USD", "EUR"],
		setCurrency: vi.fn(),
	}),
}));

vi.mock("#/features/exchange-rates/currency-switch", () => ({
	CurrencySwitch: () => <button type="button">Currency control</button>,
}));

vi.mock("#/features/storefront/components/account-navigation", () => ({
	accountNavigation: [
		{
			to: "/account/orders",
			label: () => "My orders",
			icon: () => <span>Orders icon</span>,
		},
		{
			to: "/account/settings",
			label: () => "Account settings",
			icon: () => <span>Settings icon</span>,
		},
	],
}));

vi.mock("#/layouts/components/locale-switch", () => ({
	LocaleSwitch: () => <button type="button">Language control</button>,
}));

vi.mock("#/layouts/components/sign-out-dialog", () => ({
	SignOutDialog: () => <div>Sign-out dialog</div>,
}));

vi.mock("#/layouts/components/theme-switch", () => ({
	ThemeSwitch: () => <button type="button">Theme control</button>,
}));

vi.mock("#/layouts/public/account-settings-panel", () => ({
	AccountSettingsPanel: () => <div>App settings</div>,
}));

vi.mock("#/paraglide/messages", () => ({
	m: new Proxy(
		{
			common_loading: () => "Loading",
			layout_signOut_title: () => "Sign out",
			public_sign_in: () => "Sign in",
			store_account_title: () => "My account",
			store_my_account_loading: () => "Loading account",
			store_my_currency_description: () => "Currency description",
			store_my_description: () => "My description",
			store_my_guest_description: () => "Guest description",
			store_my_guest_orders_description: () => "Guest orders description",
			store_my_guest_title: () => "Guest title",
			store_not_signed_in: () => "Not signed in",
			store_lookup_title: () => "Guest order lookup",
			store_my_language_description: () => "Language description",
			store_my_preferences_description: () => "Preferences description",
			store_my_preferences_title: () => "Display preferences",
			store_my_theme_description: () => "Theme description",
			store_my_title: () => "My",
			store_nav_orders: () => "Order lookup",
			store_payment_currency: () => "Currency",
			switch_language: () => "Language",
			toggle_theme: () => "Theme",
		},
		{
			get: (target, property) =>
				target[property as keyof typeof target] ?? (() => String(property)),
		},
	),
}));

import { StorefrontMePage } from "#/features/storefront/pages/me";

describe("storefront me page", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(
			globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		mocks.session.data = null;
		mocks.session.isPending = false;
	});

	afterEach(() => {
		act(() => root.unmount());
		delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		container.remove();
		vi.clearAllMocks();
	});

	it("shows guest actions and device display preferences", () => {
		act(() => root.render(<StorefrontMePage />));

		expect(container.textContent).toContain("Guest title");
		expect(container.textContent).toContain("Not signed in");
		expect(container.textContent).toContain("Guest order lookup");
		expect(container.querySelector('a[href="/sign-in"]')).not.toBeNull();
		expect(container.querySelector('a[href="/orders"]')).not.toBeNull();
		expect(container.textContent).toContain("Currency control");
		expect(container.textContent).toContain("Language control");
		expect(container.textContent).toContain("Theme control");
	});

	it("shows account navigation and sign out for an authenticated user", () => {
		mocks.session.data = {
			user: {
				email: "buyer@example.com",
				image: null,
				name: "Buyer",
			},
		};

		act(() => root.render(<StorefrontMePage />));

		expect(container.textContent).toContain("Buyer");
		expect(container.textContent).toContain("buyer@example.com");
		expect(container.querySelector('a[href="/account/orders"]')).not.toBeNull();
		expect(
			container.querySelector('a[href="/account/settings"]'),
		).not.toBeNull();
		expect(container.textContent).toContain("Sign out");
		expect(container.textContent).not.toContain("Guest title");
		expect(container.querySelector("nav.grid-cols-4")).not.toBeNull();
	});

	it("shows an account loading state without hiding preferences", () => {
		mocks.session.isPending = true;

		act(() => root.render(<StorefrontMePage />));

		expect(
			container.querySelector('[aria-label="Loading account"]'),
		).not.toBeNull();
		expect(container.textContent).toContain("Display preferences");
	});
});
