// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelegramMiniAppAutoSignIn } from "#/features/auth/components/telegram-mini-app-auto-sign-in";

const mocks = vi.hoisted(() => ({
	invalidate: vi.fn(),
	listProviders: vi.fn(),
	refetch: vi.fn(),
	signInWithMiniApp: vi.fn(),
}));

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

vi.mock("#/features/auth/server/provider-admin", () => ({
	listPublicAuthProvidersFn: mocks.listProviders,
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
		mocks.listProviders.mockResolvedValue([
			{
				providerId: "telegram",
				telegramMiniAppEnabled: true,
			},
		]);
		Object.assign(window, {
			Telegram: {
				WebApp: {
					initData: "query_id=unique-mini-app-launch",
					ready: vi.fn(),
				},
			},
		});
	});

	afterEach(() => {
		delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		delete (window as typeof window & { Telegram?: unknown }).Telegram;
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

		await act(async () => root.unmount());
	});
});
