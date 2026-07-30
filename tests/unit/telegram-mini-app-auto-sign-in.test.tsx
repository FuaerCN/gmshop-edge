// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelegramMiniAppAutoSignIn } from "#/features/auth/components/telegram-mini-app-auto-sign-in";

const mocks = vi.hoisted(() => ({
	expand: vi.fn(),
	init: vi.fn(),
	invalidate: vi.fn(),
	miniAppMount: vi.fn(),
	ready: vi.fn(),
	refetch: vi.fn(),
	requestFullscreen: vi.fn(),
	retrieveRawInitData: vi.fn(),
	signInWithMiniApp: vi.fn(),
	viewportMount: vi.fn(),
}));

vi.mock("@tma.js/sdk", () => {
	const available = <T extends ReturnType<typeof vi.fn>>(fn: T) =>
		Object.assign(fn, { isAvailable: () => true });
	return {
		init: mocks.init,
		retrieveRawInitData: mocks.retrieveRawInitData,
		miniApp: {
			mount: available(mocks.miniAppMount),
			ready: available(mocks.ready),
		},
		viewport: {
			expand: available(mocks.expand),
			mount: available(mocks.viewportMount),
			requestFullscreen: available(mocks.requestFullscreen),
		},
	};
});

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ invalidate: mocks.invalidate }),
}));

vi.mock("#/features/auth/auth-client", () => ({
	authClient: {
		signInWithMiniApp: mocks.signInWithMiniApp,
		useSession: () => ({
			data: null,
			isPending: false,
			refetch: mocks.refetch,
		}),
	},
}));

describe("Telegram Mini App auto sign-in", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		(
			globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		mocks.signInWithMiniApp.mockResolvedValue({ data: {}, error: null });
		mocks.refetch.mockResolvedValue(undefined);
		mocks.invalidate.mockResolvedValue(undefined);
		mocks.retrieveRawInitData.mockReturnValue(
			"query_id=unique-mini-app-launch",
		);
		mocks.viewportMount.mockResolvedValue(undefined);
		mocks.requestFullscreen.mockResolvedValue(undefined);
	});

	afterEach(() => {
		delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		container.remove();
		vi.clearAllMocks();
	});

	it("signs in once on launch even when React replays effects", async () => {
		const root = createRoot(container);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		await act(async () => {
			root.render(
				<StrictMode>
					<QueryClientProvider client={queryClient}>
						<TelegramMiniAppAutoSignIn />
					</QueryClientProvider>
				</StrictMode>,
			);
		});
		await act(async () => {
			await vi.waitFor(() =>
				expect(mocks.signInWithMiniApp).toHaveBeenCalledOnce(),
			);
		});

		expect(mocks.signInWithMiniApp).toHaveBeenCalledWith(
			"query_id=unique-mini-app-launch",
		);
		expect(mocks.refetch).toHaveBeenCalledOnce();
		expect(mocks.invalidate).toHaveBeenCalledOnce();
		expect(mocks.init).toHaveBeenCalledOnce();
		expect(mocks.miniAppMount).toHaveBeenCalledOnce();
		expect(mocks.ready).toHaveBeenCalledOnce();
		expect(mocks.viewportMount).toHaveBeenCalledOnce();
		expect(mocks.requestFullscreen).toHaveBeenCalledOnce();
		expect(mocks.expand).not.toHaveBeenCalled();

		await act(async () => root.unmount());
	});
});
