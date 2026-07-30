import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	expand: vi.fn(),
	init: vi.fn(),
	miniAppMount: vi.fn(),
	ready: vi.fn(),
	requestFullscreen: vi.fn(),
	retrieveRawInitData: vi.fn(),
	viewportMount: vi.fn(),
}));

vi.mock("@tma.js/sdk", () => {
	const availability = {
		expand: true,
		miniAppMount: true,
		ready: true,
		requestFullscreen: true,
		viewportMount: true,
	};
	const available = <T extends ReturnType<typeof vi.fn>>(
		fn: T,
		key: keyof typeof availability,
	) => Object.assign(fn, { isAvailable: () => availability[key] });
	return {
		init: mocks.init,
		retrieveRawInitData: mocks.retrieveRawInitData,
		miniApp: {
			mount: available(mocks.miniAppMount, "miniAppMount"),
			ready: available(mocks.ready, "ready"),
		},
		viewport: {
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

	it("falls back to expanding when fullscreen fails", async () => {
		mocks.retrieveRawInitData.mockReturnValue("query_id=fullscreen-fallback");
		mocks.viewportMount.mockResolvedValue(undefined);
		mocks.requestFullscreen.mockRejectedValue(new Error("unsupported"));
		const { startTelegramMiniApp } = await import(
			"#/features/auth/components/telegram-mini-app-auto-sign-in"
		);

		await expect(startTelegramMiniApp()).resolves.toBe(
			"query_id=fullscreen-fallback",
		);
		expect(mocks.ready).toHaveBeenCalledOnce();
		expect(mocks.expand).toHaveBeenCalledOnce();
	});
});
