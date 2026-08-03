// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	selectTheme: vi.fn(),
	setCurrency: vi.fn(),
	setLocale: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

vi.mock("#/layouts/components/theme-switch", () => ({
	useThemeSelection: () => ({ theme: "auto", selectTheme: mocks.selectTheme }),
}));

vi.mock("#/paraglide/runtime", () => ({
	getLocale: () => "en-US",
	locales: ["en-US", "zh-CN"],
	setLocale: mocks.setLocale,
}));

vi.mock("#/paraglide/messages", () => ({
	m: new Proxy(
		{
			layout_signOut_title: () => "Sign out",
			store_account_orders: () => "My orders",
			store_account_settings: () => "Account settings",
			store_account_title: () => "My account",
			store_admin_dashboard: () => "Admin dashboard",
			store_header_settings: () => "Store settings",
			store_header_settings_back: () => "Back to settings",
			store_my_preferences_description: () => "Preferences",
			store_payment_currency: () => "Currency",
			switch_language: () => "Language",
			theme_dark: () => "Dark",
			theme_light: () => "Light",
			theme_system: () => "System",
			toggle_theme: () => "Theme",
		},
		{
			get: (target, property) =>
				target[property as keyof typeof target] ?? (() => String(property)),
		},
	),
}));

import { useState } from "react";
import {
	AccountSettingsPanel,
	type SettingsPanelPage,
} from "#/layouts/public/account-settings-panel";

function TestPanel({
	compact = false,
	root = false,
	signedIn = false,
}: {
	compact?: boolean;
	root?: boolean;
	signedIn?: boolean;
}) {
	const [page, setPage] = useState<SettingsPanelPage>("main");
	return (
		<AccountSettingsPanel
			currencySelection={{
				currency: "USD",
				currencies: ["USD", "EUR"],
				setCurrency: mocks.setCurrency,
			}}
			onClose={vi.fn()}
			onPageChange={setPage}
			onSignOut={mocks.selectTheme}
			page={page}
			root={root}
			showAccountLinks={!compact}
			showSignOut={!compact}
			user={signedIn ? { email: "buyer@example.com", name: "Buyer" } : null}
		/>
	);
}

describe("account settings panel", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		(
			globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		vi.clearAllMocks();
	});

	it("shows concise account actions only when signed in", () => {
		act(() => root.render(<TestPanel root signedIn />));

		expect(container.querySelector('a[href="/admin"]')).not.toBeNull();
		expect(
			container.querySelector('a[href="/account/settings"]'),
		).not.toBeNull();
		expect(container.querySelector('a[href="/account/orders"]')).not.toBeNull();
		expect(container.textContent).toContain("Sign out");
	});

	it("uses a settings action and omits duplicate links in compact account mode", () => {
		act(() => root.render(<TestPanel compact signedIn />));

		expect(
			container.querySelector('a[href="/account/settings"]'),
		).not.toBeNull();
		expect(container.querySelector('a[href="/account/orders"]')).toBeNull();
		expect(container.textContent).not.toContain("Sign out");
		expect(container.textContent).toContain("Buyer");
		expect(container.textContent).toContain("Currency");
	});

	it("selects currency, language, and theme through secondary pages", () => {
		act(() => root.render(<TestPanel />));

		clickButton(container, "Currency");
		clickButton(container, "EUR");
		expect(mocks.setCurrency).toHaveBeenCalledWith("EUR");

		clickButton(container, "Language");
		clickButton(container, "简体中文");
		expect(mocks.setLocale).toHaveBeenCalledWith("zh-CN");

		clickButton(container, "Theme");
		clickButton(container, "Dark");
		expect(mocks.selectTheme).toHaveBeenCalledWith("dark", expect.anything());
		expect(container.textContent).toContain("Currency");
	});
});

function clickButton(container: HTMLElement, label: string) {
	const button = Array.from(container.querySelectorAll("button")).find((item) =>
		item.textContent?.includes(label),
	);
	if (!button) throw new Error(`Missing button: ${label}`);
	act(() => button.click());
}
