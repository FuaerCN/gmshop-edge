import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { authClient } from "#/features/auth/auth-client";
import { safePostAuthRedirect } from "#/features/auth/post-auth-redirect";
import {
	decodeTelegramWidgetResult,
	type TelegramWidgetAuthData,
} from "#/features/auth/telegram-widget";
import { m } from "#/paraglide/messages";

let pendingWidgetSignIn:
	| {
			authData: TelegramWidgetAuthData;
			request?: ReturnType<typeof authClient.signInWithTelegram>;
	  }
	| undefined;

export function TelegramWidgetAutoSignIn() {
	const navigate = useNavigate();
	const router = useRouter();
	const session = authClient.useSession();

	useEffect(() => {
		const controller = new AbortController();
		const result = takeTelegramWidgetResult();
		if (result) pendingWidgetSignIn = { authData: result };
		if (session.data?.user) {
			pendingWidgetSignIn = undefined;
			return () => controller.abort();
		}
		if (!pendingWidgetSignIn || session.isPending)
			return () => controller.abort();

		const attempt = pendingWidgetSignIn;
		attempt.request ??= authClient.signInWithTelegram(attempt.authData);
		void attempt.request
			.then(async (response) => {
				if (controller.signal.aborted || pendingWidgetSignIn !== attempt)
					return;
				pendingWidgetSignIn = undefined;
				if (response.error) {
					toast.error(m.auth_signInFailed());
					return;
				}
				await session.refetch();
				await router.invalidate();
				const redirect = safePostAuthRedirect(
					window.sessionStorage.getItem("gmshop.post_auth_redirect"),
				);
				window.sessionStorage.removeItem("gmshop.post_auth_redirect");
				void navigate({ to: redirect, replace: true });
			})
			.catch(() => {
				if (controller.signal.aborted || pendingWidgetSignIn !== attempt)
					return;
				pendingWidgetSignIn = undefined;
				toast.error(m.auth_signInFailed());
			});
		return () => controller.abort();
	}, [
		navigate,
		router,
		session.data?.user,
		session.isPending,
		session.refetch,
	]);

	return null;
}

function takeTelegramWidgetResult() {
	const match = /(?:^|&)tgAuthResult=([^&]*)/.exec(
		window.location.hash.slice(1),
	);
	if (!match) return null;
	window.history.replaceState(
		window.history.state,
		"",
		`${window.location.pathname}${window.location.search}`,
	);
	let encoded: string | null = null;
	try {
		encoded = match[1] ? decodeURIComponent(match[1]) : null;
	} catch {
		encoded = null;
	}
	if (!encoded) {
		toast.error(m.auth_signInFailed());
		return null;
	}
	const result = decodeTelegramWidgetResult(encoded);
	if (!result) toast.error(m.auth_signInFailed());
	return result;
}
