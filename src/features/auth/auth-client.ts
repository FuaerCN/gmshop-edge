import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { telegramClient } from "better-auth-telegram/client";

export const authClient = createAuthClient({
	plugins: [emailOTPClient(), telegramClient()],
});
