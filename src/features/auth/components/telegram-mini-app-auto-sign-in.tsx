import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "#/features/auth/auth-client";
import { listPublicAuthProvidersFn } from "#/features/auth/server/provider-admin";

type TelegramWebApp = {
	initData?: string;
	ready?: () => void;
};

let telegramMiniAppSignIn:
	| {
			initData: string;
			request: ReturnType<typeof authClient.signInWithMiniApp>;
	  }
	| undefined;
let telegramWebAppScript: Promise<TelegramWebApp | undefined> | undefined;

export function TelegramMiniAppAutoSignIn() {
	const router = useRouter();
	const session = authClient.useSession();
	const publicProviders = useQuery({
		queryKey: ["public", "auth-providers"],
		queryFn: () => listPublicAuthProvidersFn(),
		staleTime: 30_000,
	});
	const enabled = (publicProviders.data ?? []).some(
		(provider) =>
			provider.providerId === "telegram" && provider.telegramMiniAppEnabled,
	);

	useEffect(() => {
		if (!enabled || session.isPending || session.data?.user) return;
		const controller = new AbortController();
		void loadTelegramWebApp()
			.then(async (telegram) => {
				const initData = telegram?.initData;
				if (!initData || controller.signal.aborted) return;
				telegram.ready?.();
				if (telegramMiniAppSignIn?.initData !== initData) {
					telegramMiniAppSignIn = {
						initData,
						request: authClient.signInWithMiniApp(initData),
					};
				}
				const result = await telegramMiniAppSignIn.request;
				if (result.error || controller.signal.aborted) return;
				await session.refetch();
				await router.invalidate();
			})
			.catch(() => undefined);
		return () => controller.abort();
	}, [enabled, router, session.data?.user, session.isPending, session.refetch]);

	return null;
}

function loadTelegramWebApp() {
	const telegram = getTelegramWebApp();
	if (telegram?.initData) return Promise.resolve(telegram);
	if (!isTelegramMiniAppLaunch()) return Promise.resolve(undefined);
	if (telegramWebAppScript) return telegramWebAppScript;

	telegramWebAppScript = new Promise((resolve) => {
		const existing = document.querySelector<HTMLScriptElement>(
			'script[src^="https://telegram.org/js/telegram-web-app.js"]',
		);
		const script = existing ?? document.createElement("script");
		const finish = () => resolve(getTelegramWebApp());
		script.addEventListener("load", finish, { once: true });
		script.addEventListener("error", () => resolve(undefined), { once: true });
		if (!existing) {
			script.src = "https://telegram.org/js/telegram-web-app.js?63";
			script.async = true;
			document.head.appendChild(script);
		}
	});
	return telegramWebAppScript;
}

function getTelegramWebApp() {
	return (
		window as typeof window & {
			Telegram?: { WebApp?: TelegramWebApp };
		}
	).Telegram?.WebApp;
}

function isTelegramMiniAppLaunch() {
	return [window.location.search, window.location.hash.slice(1)].some((value) =>
		new URLSearchParams(value).has("tgWebAppData"),
	);
}
