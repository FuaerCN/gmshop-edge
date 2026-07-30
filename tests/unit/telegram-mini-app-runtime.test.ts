import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	bindCssVars: vi.fn(),
	backButtonMount: vi.fn(),
	expand: vi.fn(),
	init: vi.fn(),
	miniAppMount: vi.fn(),
	ready: vi.fn(),
	requestFullscreen: vi.fn(),
	retrieveLaunchParams: vi.fn(),
	retrieveRawInitData: vi.fn(),
	viewportMount: vi.fn(),
}));

vi.mock("@tma.js/sdk", () => {
	const availability = {
		expand: true,
		miniAppMount: true,
		ready: true,
		requestFullscreen: true,
		bindCssVars: true,
		backButtonMount: true,
		viewportMount: true,
	};
	const available = <T extends ReturnType<typeof vi.fn>>(
		fn: T,
		key: keyof typeof availability,
	) => Object.assign(fn, { isAvailable: () => availability[key] });
	return {
		backButton: {
			mount: available(mocks.backButtonMount, "backButtonMount"),
		},
		init: mocks.init,
		retrieveLaunchParams: mocks.retrieveLaunchParams,
		retrieveRawInitData: mocks.retrieveRawInitData,
		miniApp: {
			mount: available(mocks.miniAppMount, "miniAppMount"),
			ready: available(mocks.ready, "ready"),
		},
		viewport: {
			bindCssVars: available(mocks.bindCssVars, "bindCssVars"),
			expand: available(mocks.expand, "expand"),
			mount: available(mocks.viewportMount, "viewportMount"),
			requestFullscreen: available(
				mocks.requestFullscreen,
				"requestFullscreen",
			),
		},
	};
});

afterEach(() => vi.clearAllMocks());

describe("Telegram Mini App runtime", () => {
	it("does not initialize the SDK outside Telegram", async () => {
		mocks.retrieveRawInitData.mockReturnValue(undefined);
		const { startTelegramMiniApp } = await import(
			"#/features/auth/components/telegram-mini-app-auto-sign-in"
		);

		await expect(startTelegramMiniApp()).resolves.toBeUndefined();
		expect(mocks.init).not.toHaveBeenCalled();
		expect(mocks.requestFullscreen).not.toHaveBeenCalled();
	});

	it("does not let a pending mobile fullscreen request block sign-in", async () => {
		mocks.retrieveRawInitData.mockReturnValue("query_id=mobile-fullscreen");
		mocks.retrieveLaunchParams.mockReturnValue({
			tgWebAppPlatform: "android",
		});
		mocks.viewportMount.mockResolvedValue(undefined);
		mocks.requestFullscreen.mockReturnValue(new Promise(() => undefined));
		const { startTelegramMiniApp } = await import(
			"#/features/auth/components/telegram-mini-app-auto-sign-in"
		);

		await expect(startTelegramMiniApp()).resolves.toBe(
			"query_id=mobile-fullscreen",
		);
		expect(mocks.ready).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(mocks.bindCssVars).toHaveBeenCalledOnce());
		expect(mocks.expand).toHaveBeenCalledOnce();
		expect(mocks.requestFullscreen).toHaveBeenCalledWith({ timeout: 3_000 });
	});

	it("expands without requesting fullscreen on Telegram Desktop", async () => {
		mocks.retrieveRawInitData.mockReturnValue("query_id=desktop");
		mocks.retrieveLaunchParams.mockReturnValue({
			tgWebAppPlatform: "tdesktop",
		});
		mocks.viewportMount.mockResolvedValue(undefined);
		const { startTelegramMiniApp } = await import(
			"#/features/auth/components/telegram-mini-app-auto-sign-in"
		);

		await expect(startTelegramMiniApp()).resolves.toBe("query_id=desktop");
		await vi.waitFor(() => expect(mocks.expand).toHaveBeenCalledOnce());
		expect(mocks.requestFullscreen).not.toHaveBeenCalled();
	});
});
