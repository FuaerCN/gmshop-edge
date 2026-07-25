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
	const enabled = new Set(
		(providers ?? (await loadStoredProviders(db)))
			.filter(
				(provider) => provider.enabled && provider.providerId !== providerId,
			)
			.map((provider) => provider.providerId),
	);
	const accounts = await db
		.prepare(
			`SELECT owner.user_id, alternative.provider_id
			 FROM accounts owner
			 LEFT JOIN accounts alternative
			  ON alternative.user_id = owner.user_id AND alternative.id <> owner.id
			 WHERE owner.provider_id = ?`,
		)
		.bind(providerId)
		.all<{ user_id: string; provider_id: string | null }>();
	const alternatives = new Map<string, string[]>();
	for (const row of accounts.results) {
		const list = alternatives.get(row.user_id) ?? [];
		if (row.provider_id) list.push(row.provider_id);
		alternatives.set(row.user_id, list);
	}
	if (
		[...alternatives.values()].some(
			(providerIds) => !providerIds.some((id) => enabled.has(id)),
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
	const enabled = new Set(
		(await loadStoredProviders(db))
			.filter((provider) => provider.enabled)
			.map((provider) => provider.providerId),
	);
	const alternatives = await db
		.prepare("SELECT provider_id FROM accounts WHERE user_id = ? AND id <> ?")
		.bind(input.userId, target.id)
		.all<{ provider_id: string }>();
	if (!alternatives.results.some((row) => enabled.has(row.provider_id)))
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
