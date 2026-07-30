import { useRouter } from "@tanstack/react-router";
import { init, miniApp, retrieveRawInitData, viewport } from "@tma.js/sdk";
import { useEffect } from "react";
import { authClient } from "#/features/auth/auth-client";

let telegramMiniAppSignIn:
	| {
			initData: string;
			request: ReturnType<typeof authClient.signInWithMiniApp>;
	  }
	| undefined;
let telegramMiniAppRuntime: Promise<string | undefined> | undefined;

export function TelegramMiniAppAutoSignIn() {
	const router = useRouter();
	const session = authClient.useSession();

	useEffect(() => {
		const controller = new AbortController();
		void initializeTelegramMiniApp()
			.then(async (initData) => {
				if (
					!initData ||
					controller.signal.aborted ||
					session.isPending ||
					session.data?.user
				)
					return;
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
	}, [router, session.data?.user, session.isPending, session.refetch]);

	return null;
}

function initializeTelegramMiniApp() {
	telegramMiniAppRuntime ??= startTelegramMiniApp();
	return telegramMiniAppRuntime;
}

export async function startTelegramMiniApp() {
	let initData: string | undefined;
	try {
		initData = retrieveRawInitData();
	} catch {
		return undefined;
	}
	if (!initData) return undefined;
	try {
		init();
		if (miniApp.mount.isAvailable()) miniApp.mount();
		if (miniApp.ready.isAvailable()) miniApp.ready();
	} catch {
		return initData;
	}
	try {
		if (viewport.mount.isAvailable()) await viewport.mount();
		if (viewport.bindCssVars.isAvailable()) viewport.bindCssVars();
		if (viewport.requestFullscreen.isAvailable()) {
			await viewport.requestFullscreen();
		} else if (viewport.expand.isAvailable()) {
			viewport.expand();
		}
	} catch {
		if (viewport.expand.isAvailable()) viewport.expand();
	}
	return initData;
}
