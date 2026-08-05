import { decryptSecret } from "#/lib/secrets";
import {
	authProviderSecretKey,
	authProviderSecretPurpose,
	authProviderSettingKeys,
	isTelegramBotToken,
	parseAuthProviderSettings,
	telegramBotTokenSecretPurpose,
} from "../provider-settings";

export type RuntimeAuthProvider = {
	id: string;
	providerId: string;
	providerType: "email" | "social";
	displayName: string;
	clientId: string | null;
	clientSecret: string | null;
	scopes: string[];
	allowSignup: boolean;
	passwordLoginEnabled?: boolean;
	emailOtpEnabled?: boolean;
	revision: number;
	telegramBotUserId: string | null;
	telegramBotUsername: string | null;
	telegramBotToken: string | null;
	telegramMiniAppEnabled: boolean;
};

export async function loadRuntimeAuthProviders(
	database: D1Database,
	authProviderSecret: string,
	_integrationConfigSecret?: string,
): Promise<RuntimeAuthProvider[]> {
	const rows = await database
		.prepare(
			`SELECT key, value FROM system_settings
			 WHERE key IN (?, ?, ?, ?, ?, ?)
			    OR (key LIKE 'auth.provider.%.secret' AND is_secret = 1)`,
		)
		.bind(
			authProviderSettingKeys.providers,
			authProviderSettingKeys.revision,
			authProviderSettingKeys.telegramBotUserId,
			authProviderSettingKeys.telegramBotToken,
			authProviderSettingKeys.telegramUsername,
			authProviderSettingKeys.telegramMiniAppEnabled,
		)
		.all<{ key: string; value: string }>();
	const settings = parseAuthProviderSettings(rows.results);
	const rawValues = new Map(
		rows.results.map((row) => [row.key, parseStoredValue(row.value)]),
	);
	return Promise.all(
		settings.providers
			.filter((provider) => provider.enabled)
			.sort(
				(left, right) =>
					left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
			)
			.map(async (provider) => {
				const encrypted = rawValues.get(
					authProviderSecretKey(provider.providerId),
				);
				if (encrypted !== undefined && typeof encrypted !== "string")
					throw new Error("Authentication provider secret is invalid");
				if (encrypted && !authProviderSecret)
					throw new Error("Authentication provider secret is unavailable");
				const secret = encrypted
					? await decryptSecret(
							encrypted,
							authProviderSecret,
							authProviderSecretPurpose(provider.providerId),
						)
					: null;
				const telegram = provider.providerId === "telegram";
				const configuredBotToken = telegram
					? rawValues.get(authProviderSettingKeys.telegramBotToken)
					: undefined;
				if (
					configuredBotToken !== undefined &&
					typeof configuredBotToken !== "string"
				)
					throw new Error("Telegram bot token is invalid");
				const botToken = configuredBotToken
					? await decryptSecret(
							configuredBotToken,
							authProviderSecret,
							telegramBotTokenSecretPurpose(),
						)
					: telegram && isTelegramBotToken(secret)
						? secret
						: null;
				return {
					id: provider.id,
					providerId: provider.providerId,
					providerType: provider.providerType,
					displayName: provider.displayName,
					clientId: provider.clientId,
					clientSecret: telegram && isTelegramBotToken(secret) ? null : secret,
					scopes: provider.scopes,
					allowSignup: provider.allowSignup,
					passwordLoginEnabled: provider.passwordLoginEnabled,
					emailOtpEnabled: provider.emailOtpEnabled,
					revision: settings.revision,
					telegramBotUserId: telegram ? settings.telegram.botUserId : null,
					telegramBotUsername: telegram ? settings.telegram.username : null,
					telegramBotToken: botToken,
					telegramMiniAppEnabled: telegram && settings.telegram.miniAppEnabled,
				};
			}),
	);
}

export function authProviderRevisionSignature(
	providers: RuntimeAuthProvider[],
) {
	return providers[0]?.revision.toString() ?? "0";
}

function parseStoredValue(value: string) {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return undefined;
	}
}
