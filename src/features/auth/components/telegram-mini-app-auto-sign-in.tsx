import { useRouter } from "@tanstack/react-router";
import {
	backButton,
	init,
	miniApp,
	retrieveLaunchParams,
	retrieveRawInitData,
	viewport,
} from "@tma.js/sdk";
import { useEffect } from "react";
import { authClient } from "#/features/auth/auth-client";

const telegramMobilePlatforms = new Set(["android", "android_x", "ios"]);

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
				if (result.error) {
					reportTelegramMiniAppSignInError(result.error);
					return;
				}
				if (controller.signal.aborted) return;
				await session.refetch();
				await router.invalidate();
			})
			.catch(reportTelegramMiniAppSignInError);
		return () => controller.abort();
	}, [router, session.data?.user, session.isPending, session.refetch]);

	return null;
}

export function initializeTelegramMiniApp() {
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
		if (backButton.mount.isAvailable()) backButton.mount();
	} catch {
		return initData;
	}
	void initializeTelegramViewport();
	return initData;
}

async function initializeTelegramViewport() {
	try {
		if (viewport.mount.isAvailable()) await viewport.mount();
		if (viewport.bindCssVars.isAvailable()) viewport.bindCssVars();
		if (viewport.expand.isAvailable()) viewport.expand();
		const { tgWebAppPlatform } = retrieveLaunchParams();
		if (
			telegramMobilePlatforms.has(tgWebAppPlatform) &&
			viewport.requestFullscreen.isAvailable()
		)
			void viewport
				.requestFullscreen({ timeout: 3_000 })
				.catch(() => undefined);
	} catch {
		if (viewport.expand.isAvailable()) viewport.expand();
	}
}

function reportTelegramMiniAppSignInError(error: unknown) {
	const details =
		error && typeof error === "object"
			? (error as Record<string, unknown>)
			: undefined;
	console.warn("Telegram Mini App auto sign-in failed", {
		code: typeof details?.code === "string" ? details.code : "UNKNOWN",
		status: typeof details?.status === "number" ? details.status : undefined,
	});
}
