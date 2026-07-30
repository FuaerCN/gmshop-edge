import { useRouter, useRouterState } from "@tanstack/react-router";
import { backButton } from "@tma.js/sdk";
import { useEffect } from "react";
import { initializeTelegramMiniApp } from "#/features/auth/components/telegram-mini-app-auto-sign-in";

const telegramMiniAppRootRoutes = new Set(["/", "/cart", "/me"]);

export function TelegramMiniAppBackButton() {
	const router = useRouter();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	useEffect(() => {
		let disposed = false;
		let removeClickListener: (() => void) | undefined;

		void initializeTelegramMiniApp().then((initData) => {
			if (!initData || disposed) return;
			try {
				if (telegramMiniAppRootRoutes.has(pathname)) {
					backButton.hide();
					return;
				}
				backButton.show();
				removeClickListener = backButton.onClick(() => router.history.back());
			} catch {
				// The page is not running in a Telegram client with BackButton support.
			}
		});

		return () => {
			disposed = true;
			removeClickListener?.();
			try {
				backButton.hide();
			} catch {
				// The page is not running in a Telegram client with BackButton support.
			}
		};
	}, [pathname, router]);

	return null;
}
