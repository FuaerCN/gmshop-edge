// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	back: vi.fn(),
	hide: vi.fn(),
	onClick: vi.fn(),
	pathname: { value: "/" },
	show: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ history: { back: mocks.back } }),
	useRouterState: () => mocks.pathname.value,
}));

vi.mock("@tma.js/sdk", () => ({
	backButton: {
		hide: mocks.hide,
		onClick: mocks.onClick,
		show: mocks.show,
	},
}));

vi.mock("#/features/auth/components/telegram-mini-app-auto-sign-in", () => ({
	initializeTelegramMiniApp: vi.fn().mockResolvedValue("query_id=mini-app"),
}));

describe("Telegram Mini App back button", () => {
	let container: HTMLDivElement;
	let TelegramMiniAppBackButton: typeof import("#/features/auth/components/telegram-mini-app-back-button").TelegramMiniAppBackButton;

	beforeEach(async () => {
		vi.resetModules();
		({ TelegramMiniAppBackButton } = await import(
			"#/features/auth/components/telegram-mini-app-back-button"
		));
		(
			globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		mocks.pathname.value = "/";
		mocks.onClick.mockReturnValue(vi.fn());
	});

	afterEach(() => {
		delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		container.remove();
		vi.clearAllMocks();
	});

	it.each(["/", "/cart", "/me"])("hides on root route %s", async (pathname) => {
		mocks.pathname.value = pathname;
		const root = createRoot(container);

		await act(async () => root.render(<TelegramMiniAppBackButton />));
		await vi.waitFor(() => expect(mocks.hide).toHaveBeenCalled());

		expect(mocks.show).not.toHaveBeenCalled();
		await act(async () => root.unmount());
	});

	it("shows on deep routes and navigates back", async () => {
		mocks.pathname.value = "/account/orders";
		const removeClickListener = vi.fn();
		mocks.onClick.mockReturnValue(removeClickListener);
		const root = createRoot(container);

		await act(async () => root.render(<TelegramMiniAppBackButton />));
		await vi.waitFor(() => expect(mocks.show).toHaveBeenCalledOnce());

		const handleBack = mocks.onClick.mock.calls[0]?.[0];
		handleBack?.();
		expect(mocks.back).toHaveBeenCalledOnce();

		await act(async () => root.unmount());
		expect(removeClickListener).toHaveBeenCalledOnce();
	});
});
