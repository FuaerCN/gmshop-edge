import { isInternalIdentityEmail } from "#/features/auth/identity-email";
import {
	authProviderSettingKeys,
	parseAuthProviderSettings,
	type StoredAuthProvider,
} from "#/features/auth/provider-settings";
import { DomainError } from "#/lib/domain-error";

export async function assertAuthProviderCanBeDisabled(
	db: D1Database,
	providerId: string,
	providers?: readonly StoredAuthProvider[],
) {
	const configured = providers ?? (await loadStoredProviders(db));
	const enabled = new Set(
		configured
			.filter(
				(provider) => provider.enabled && provider.providerId !== providerId,
			)
			.map((provider) => provider.providerId),
	);
	const email = configured.find(
		(provider) => provider.enabled && provider.providerType === "email",
	);
	const query =
		providerId === "credential"
			? db.prepare(
					`SELECT u.id AS user_id, u.email, account.provider_id
					 FROM users u
					 LEFT JOIN accounts account ON account.user_id = u.id`,
				)
			: db
					.prepare(
						`SELECT owner.user_id, u.email, alternative.provider_id
						 FROM accounts owner
						 JOIN users u ON u.id = owner.user_id
						 LEFT JOIN accounts alternative
						  ON alternative.user_id = owner.user_id AND alternative.id <> owner.id
						 WHERE owner.provider_id = ?`,
					)
					.bind(providerId);
	const rows = await query.all<{
		user_id: string;
		email: string;
		provider_id: string | null;
	}>();
	const alternatives = new Map<
		string,
		{ email: string; providerIds: string[] }
	>();
	for (const row of rows.results) {
		const user = alternatives.get(row.user_id) ?? {
			email: row.email,
			providerIds: [],
		};
		if (row.provider_id) user.providerIds.push(row.provider_id);
		alternatives.set(row.user_id, user);
	}
	if (
		[...alternatives.values()].some(
			(user) =>
				!user.providerIds.some((id) => enabled.has(id)) &&
				!(email?.emailOtpEnabled && !isInternalIdentityEmail(user.email)),
		)
	)
		throw new DomainError(
			"auth_provider_would_lock_accounts",
			409,
			"Link another login method before disabling this provider",
		);
}

export async function assertAccountCanBeUnlinked(
	db: D1Database,
	input: { userId: string; providerId: string; accountId?: string },
) {
	const target = await db
		.prepare(
			`SELECT id FROM accounts WHERE user_id = ? AND provider_id = ?
			 AND (? IS NULL OR account_id = ?) LIMIT 1`,
		)
		.bind(
			input.userId,
			input.providerId,
			input.accountId ?? null,
			input.accountId ?? null,
		)
		.first<{ id: string }>();
	if (!target) return;
	const providers = await loadStoredProviders(db);
	const enabled = new Set(
		providers
			.filter((provider) => provider.enabled)
			.map((provider) => provider.providerId),
	);
	const email = providers.find(
		(provider) => provider.enabled && provider.providerType === "email",
	);
	const alternatives = await db
		.prepare("SELECT provider_id FROM accounts WHERE user_id = ? AND id <> ?")
		.bind(input.userId, target.id)
		.all<{ provider_id: string }>();
	const user = await db
		.prepare("SELECT email FROM users WHERE id = ? LIMIT 1")
		.bind(input.userId)
		.first<{ email: string }>();
	if (
		!alternatives.results.some((row) => enabled.has(row.provider_id)) &&
		!(email?.emailOtpEnabled && user && !isInternalIdentityEmail(user.email))
	)
		throw new DomainError(
			"auth_last_login_method",
			409,
			"Link another enabled login method before unlinking this account",
		);
}

async function loadStoredProviders(db: D1Database) {
	const row = await db
		.prepare("SELECT key, value FROM system_settings WHERE key = ? LIMIT 1")
		.bind(authProviderSettingKeys.providers)
		.first<{ key: string; value: string }>();
	return parseAuthProviderSettings(row ? [row] : []).providers;
}
