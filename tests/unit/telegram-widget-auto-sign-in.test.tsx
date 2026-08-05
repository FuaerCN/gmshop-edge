// @vitest-environment jsdom

import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	invalidate: vi.fn(),
	navigate: vi.fn(),
	refetch: vi.fn(),
	sessionData: { value: null as { user: { id: string } } | null },
	signInWithTelegram: vi.fn(),
	toastError: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
	useRouter: () => ({ invalidate: mocks.invalidate }),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

vi.mock("#/features/auth/auth-client", () => ({
	authClient: {
		signInWithTelegram: mocks.signInWithTelegram,
		useSession: () => ({
			data: mocks.sessionData.value,
			isPending: false,
			refetch: mocks.refetch,
		}),
	},
}));

describe("Telegram Widget fallback auto sign-in", () => {
	let container: HTMLDivElement;
	let TelegramWidgetAutoSignIn: typeof import("#/features/auth/components/telegram-widget-auto-sign-in").TelegramWidgetAutoSignIn;

	beforeEach(async () => {
		vi.resetModules();
		({ TelegramWidgetAutoSignIn } = await import(
			"#/features/auth/components/telegram-widget-auto-sign-in"
		));
		(
			globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		mocks.signInWithTelegram.mockResolvedValue({ data: {}, error: null });
		mocks.refetch.mockResolvedValue(undefined);
		mocks.invalidate.mockResolvedValue(undefined);
		mocks.navigate.mockResolvedValue(undefined);
		mocks.sessionData.value = null;
		window.sessionStorage.setItem("gmshop.post_auth_redirect", "/account");
	});

	afterEach(() => {
		delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		container.remove();
		window.sessionStorage.clear();
		vi.clearAllMocks();
	});

	it("clears and submits tgAuthResult only once when effects replay", async () => {
		const authData = {
			id: 1_298_297_851,
			first_name: "Telegram Shopper",
			auth_date: 1_785_958_138,
			hash: "a".repeat(64),
		};
		const encoded = btoa(JSON.stringify(authData));
		window.history.replaceState({}, "", `/#tgAuthResult=${encoded}`);
		const root = createRoot(container);

		await act(async () => {
			root.render(
				<StrictMode>
					<TelegramWidgetAutoSignIn />
				</StrictMode>,
			);
		});
		await act(async () => {
			await vi.waitFor(() =>
				expect(mocks.signInWithTelegram).toHaveBeenCalledOnce(),
			);
		});

		expect(window.location.hash).toBe("");
		expect(mocks.signInWithTelegram).toHaveBeenCalledWith(authData);
		expect(mocks.refetch).toHaveBeenCalledOnce();
		expect(mocks.invalidate).toHaveBeenCalledOnce();
		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/account",
			replace: true,
		});
		expect(mocks.toastError).not.toHaveBeenCalled();

		await act(async () => root.unmount());
	});
});
