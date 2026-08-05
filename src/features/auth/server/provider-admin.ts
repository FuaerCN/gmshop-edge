import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAdmin } from "#/features/access/server/require-admin";
import { systemPermission } from "#/features/access/system-rbac";
import {
	authProviderEnabledSchema,
	authProviderIdSchema,
	authProviderInputSchema,
	authProviderOrderSchema,
	authProviderTypes,
} from "#/features/auth/provider-schema";
import {
	authProviderSecretKey,
	authProviderSecretPurpose,
	authProviderSettingKeys,
	parseAuthProviderSettings,
	type StoredAuthProvider,
	storedAuthProvidersSchema,
	telegramBotTokenSecretPurpose,
} from "#/features/auth/provider-settings";
import { DomainError } from "#/lib/domain-error";
import { decryptSecret, encryptSecret } from "#/lib/secrets";
import { createAuditStatement } from "#/server/audit";
import {
	configurationLogoInputSchema,
	configurationLogoObjectKey,
	configurationLogoUrl,
	deleteConfigurationLogo,
	putConfigurationLogo,
} from "#/server/configuration-logo";
import { getCloudflareEnv } from "#/server/db.server";
import { loadRequestRuntimeConfig } from "#/server/runtime-config";
import { assertAuthProviderCanBeDisabled } from "./provider-policy";

export const listAuthProvidersFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const context = await adminContext("read");
		const state = await loadProviderState(context.db);
		return {
			providers: state.settings.providers
				.slice()
				.sort(
					(left, right) =>
						left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
				)
				.map((provider) =>
					presentProvider(
						provider,
						state.clientSecretProviderIds.has(provider.providerId),
						state.settings,
						state.updatedAt,
						context.runtime.betterAuthUrl ||
							new URL(context.request.url).origin,
					),
				),
		};
	},
);

export const listPublicAuthProvidersFn = createServerFn({
	method: "GET",
}).handler(async () => {
	const request = getRequest();
	const db = getCloudflareEnv(request).DB;
	if (!db) throw new Error("D1 binding DB is unavailable");
	const [state, email] = await Promise.all([
		loadProviderState(db),
		db
			.prepare(
				"SELECT 1 AS enabled FROM notification_channel_configs WHERE channel = 'email' AND enabled = 1 LIMIT 1",
			)
			.first<{ enabled: number }>(),
	]);
	return state.settings.providers
		.filter((provider) => provider.enabled)
		.sort(
			(left, right) =>
				left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
		)
		.flatMap((provider) => {
			const oidcEnabled = Boolean(
				provider.clientId &&
					state.clientSecretProviderIds.has(provider.providerId),
			);
			const widgetEnabled = Boolean(
				provider.providerId === "telegram" &&
					state.hasTelegramToken &&
					state.settings.telegram.username,
			);
			if (provider.providerType !== "email" && !oidcEnabled && !widgetEnabled)
				return [];
			return [
				{
					providerId: provider.providerId,
					providerType: provider.providerType,
					displayName: provider.displayName,
					icon: provider.icon,
					allowSignup: provider.allowSignup,
					passwordLoginEnabled: provider.passwordLoginEnabled,
					emailOtpEnabled: provider.emailOtpEnabled,
					emailDeliveryEnabled: email?.enabled === 1,
					telegramMiniAppEnabled:
						provider.providerId === "telegram" &&
						state.settings.telegram.miniAppEnabled,
					telegramOidcEnabled:
						provider.providerId === "telegram" && oidcEnabled,
					telegramWidgetEnabled: widgetEnabled,
				},
			];
		});
});

export const setAuthProviderEnabledFn = createServerFn({ method: "POST" })
	.validator((input: z.input<typeof authProviderEnabledSchema>) =>
		authProviderEnabledSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const context = await adminContext("update");
		const state = await loadProviderState(context.db);
		const provider = state.settings.providers.find(
			(entry) => entry.id === data.id,
		);
		if (!provider)
			throw new DomainError(
				"auth_provider_not_found",
				404,
				"Authentication provider not found",
			);
		if (provider.enabled === data.enabled) return data;
		if (!data.enabled)
			await assertAuthProviderCanBeDisabled(
				context.db,
				provider.providerId,
				state.settings.providers,
			);
		if (data.enabled) {
			await assertEmailOtpCanBeEnabled(
				context.db,
				provider.providerType === "email" && provider.emailOtpEnabled,
			);
			assertProviderCanBeEnabled(
				{
					...provider,
					telegramMiniAppEnabled: state.settings.telegram.miniAppEnabled,
				},
				state.clientSecretProviderIds.has(provider.providerId),
				state.settings.telegram,
				state.hasTelegramToken,
			);
		}
		const now = Date.now();
		await context.db.batch([
			upsertSetting(
				context.db,
				authProviderSettingKeys.providers,
				state.settings.providers.map((entry) =>
					entry.id === provider.id
						? { ...entry, enabled: data.enabled }
						: entry,
				),
				now,
			),
			bumpProvidersRevision(context.db, now),
			createAuditStatement(context.db, context.request, context.user.id, {
				action: "auth_provider.enabled_changed",
				targetType: "auth_provider",
				targetId: provider.id,
				before: { enabled: provider.enabled },
				after: { enabled: data.enabled },
			}),
		]);
		return data;
	});

export const reorderAuthProvidersFn = createServerFn({ method: "POST" })
	.validator((input: z.input<typeof authProviderOrderSchema>) =>
		authProviderOrderSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const context = await adminContext("update");
		const state = await loadProviderState(context.db);
		const requested = new Set(data.ids);
		const slots = state.settings.providers
			.map((provider, index) => (requested.has(provider.id) ? index : -1))
			.filter((index) => index >= 0);
		if (slots.length !== data.ids.length)
			throw new DomainError(
				"auth_provider_order_invalid",
				409,
				"Authentication provider order contains missing records",
			);
		const ordered = [...state.settings.providers];
		for (const [index, slot] of slots.entries()) {
			const id = data.ids[index];
			const provider = state.settings.providers.find(
				(entry) => entry.id === id,
			);
			if (provider) ordered[slot] = provider;
		}
		const providers = ordered.map((provider, index) => ({
			...provider,
			sortOrder: (index + 1) * 100,
		}));
		const now = Date.now();
		await context.db.batch([
			upsertSetting(
				context.db,
				authProviderSettingKeys.providers,
				providers,
				now,
			),
			bumpProvidersRevision(context.db, now),
			createAuditStatement(context.db, context.request, context.user.id, {
				action: "auth_provider.reordered",
				targetType: "auth_provider",
				targetId: "auth-providers",
				after: { ids: data.ids },
			}),
		]);
		return data;
	});

export const saveAuthProviderFn = createServerFn({ method: "POST" })
	.validator((input: z.input<typeof authProviderInputSchema>) =>
		authProviderInputSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const context = await adminContext("update");
		const state = await loadProviderState(context.db);
		const before = data.id
			? state.settings.providers.find((provider) => provider.id === data.id)
			: undefined;
		if (data.id && !before)
			throw new DomainError(
				"auth_provider_not_found",
				404,
				"Authentication provider not found",
			);
		const conflict = state.settings.providers.find(
			(provider) =>
				provider.providerId === data.providerId && provider.id !== data.id,
		);
		if (conflict)
			throw new DomainError(
				"auth_provider_conflict",
				409,
				"Authentication provider ID already exists",
			);
		if (before && before.providerId !== data.providerId)
			await assertProviderIdCanChange(context.db, before.providerId);
		if (before?.enabled && !data.enabled)
			await assertAuthProviderCanBeDisabled(
				context.db,
				before.providerId,
				state.settings.providers,
			);

		const secret = await resolveProviderSecret(
			context,
			data,
			before,
			state.clientSecretProviderIds,
		);
		const telegramToken = await resolveTelegramToken(
			context,
			data,
			before,
			state,
		);
		const telegram = telegramToken.metadata;
		assertProviderCanBeEnabled(
			data,
			secret.exists,
			telegram,
			telegramToken.exists,
		);
		if (data.enabled)
			await assertEmailOtpCanBeEnabled(
				context.db,
				data.providerType === "email" && data.emailOtpEnabled,
			);
		const now = Date.now();
		const id = data.id ?? crypto.randomUUID();
		const provider: StoredAuthProvider = {
			id,
			providerId: data.providerId,
			providerType: data.providerType,
			displayName: data.displayName,
			icon: data.icon === undefined ? (before?.icon ?? null) : data.icon,
			clientId: data.clientId ?? null,
			scopes: data.scopes,
			allowSignup: data.allowSignup,
			passwordLoginEnabled: data.passwordLoginEnabled,
			emailOtpEnabled: data.emailOtpEnabled,
			enabled: data.enabled,
			sortOrder: data.sortOrder,
		};
		const providers = storedAuthProvidersSchema.parse(
			[
				...state.settings.providers.filter((entry) => entry.id !== id),
				provider,
			].sort(
				(left, right) =>
					left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
			),
		);
		const statements = [
			upsertSetting(
				context.db,
				authProviderSettingKeys.providers,
				providers,
				now,
			),
			bumpProvidersRevision(context.db, now),
			...secret.statements,
			...telegramToken.statements,
			...(data.providerId === "telegram" || before?.providerId === "telegram"
				? telegramSettingStatements(context.db, telegram, now)
				: []),
		];
		if (before && before.providerId !== data.providerId) {
			statements.push(
				context.db
					.prepare("DELETE FROM system_settings WHERE key = ?")
					.bind(authProviderSecretKey(before.providerId)),
			);
			if (before.providerId === "telegram")
				statements.push(
					context.db
						.prepare("DELETE FROM system_settings WHERE key = ?")
						.bind(authProviderSettingKeys.telegramBotToken),
				);
		}
		statements.push(
			createAuditStatement(context.db, context.request, context.user.id, {
				action: before ? "auth_provider.updated" : "auth_provider.created",
				targetType: "auth_provider",
				targetId: id,
				before: before
					? {
							providerId: before.providerId,
							enabled: before.enabled,
							hasSecret: state.clientSecretProviderIds.has(before.providerId),
						}
					: null,
				after: {
					providerId: provider.providerId,
					providerType: provider.providerType,
					enabled: provider.enabled,
					hasSecret: secret.exists,
					hasTelegramToken: telegramToken.exists,
					telegramMiniAppEnabled: telegram.miniAppEnabled,
				},
			}),
		);
		await context.db.batch(statements);
		return { id };
	});

export const uploadAuthProviderLogoFn = createServerFn({ method: "POST" })
	.validator((input: z.input<typeof configurationLogoInputSchema>) =>
		configurationLogoInputSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const context = await adminContext("update");
		const state = await loadProviderState(context.db);
		const provider = state.settings.providers.find(
			(entry) => entry.id === data.id,
		);
		if (!provider)
			throw new DomainError(
				"auth_provider_not_found",
				404,
				"Authentication provider not found",
			);
		const key = configurationLogoObjectKey("auth", provider.id);
		await putConfigurationLogo(context.env.FILES, key, data);
		const now = Date.now();
		const icon = configurationLogoUrl("auth", provider.providerId, now);
		const providers = state.settings.providers.map((entry) =>
			entry.id === provider.id ? { ...entry, icon } : entry,
		);
		await context.db.batch([
			upsertSetting(
				context.db,
				authProviderSettingKeys.providers,
				providers,
				now,
			),
			bumpProvidersRevision(context.db, now),
			createAuditStatement(context.db, context.request, context.user.id, {
				action: "auth_provider.logo_uploaded",
				targetType: "auth_provider",
				targetId: provider.id,
				after: { configured: true },
			}),
		]);
		return { url: icon };
	});

export const removeAuthProviderLogoFn = createServerFn({ method: "POST" })
	.validator((input: z.input<typeof authProviderIdSchema>) =>
		authProviderIdSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const context = await adminContext("update");
		const state = await loadProviderState(context.db);
		const provider = state.settings.providers.find(
			(entry) => entry.id === data.id,
		);
		if (!provider)
			throw new DomainError(
				"auth_provider_not_found",
				404,
				"Authentication provider not found",
			);
		const now = Date.now();
		await context.db.batch([
			upsertSetting(
				context.db,
				authProviderSettingKeys.providers,
				state.settings.providers.map((entry) =>
					entry.id === provider.id ? { ...entry, icon: null } : entry,
				),
				now,
			),
			bumpProvidersRevision(context.db, now),
			createAuditStatement(context.db, context.request, context.user.id, {
				action: "auth_provider.logo_removed",
				targetType: "auth_provider",
				targetId: provider.id,
				after: { configured: false },
			}),
		]);
		await deleteConfigurationLogo(
			context.env.FILES,
			configurationLogoObjectKey("auth", provider.id),
		);
		return { id: provider.id };
	});

export const deleteAuthProviderFn = createServerFn({ method: "POST" })
	.validator((input: z.input<typeof authProviderIdSchema>) =>
		authProviderIdSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const context = await adminContext("delete");
		const state = await loadProviderState(context.db);
		const provider = state.settings.providers.find(
			(entry) => entry.id === data.id,
		);
		if (!provider)
			throw new DomainError(
				"auth_provider_not_found",
				404,
				"Authentication provider not found",
			);
		if (provider.providerId === "credential")
			throw new DomainError(
				"auth_provider_protected",
				409,
				"Credential authentication cannot be deleted",
			);
		const account = await context.db
			.prepare("SELECT id FROM accounts WHERE provider_id = ? LIMIT 1")
			.bind(provider.providerId)
			.first<{ id: string }>();
		if (account)
			throw new DomainError(
				"auth_provider_in_use",
				409,
				"Disable providers that have linked accounts",
			);
		const now = Date.now();
		const statements = [
			upsertSetting(
				context.db,
				authProviderSettingKeys.providers,
				state.settings.providers.filter((entry) => entry.id !== data.id),
				now,
			),
			bumpProvidersRevision(context.db, now),
			context.db
				.prepare("DELETE FROM system_settings WHERE key = ?")
				.bind(authProviderSecretKey(provider.providerId)),
		];
		if (provider.providerId === "telegram")
			statements.push(
				context.db
					.prepare("DELETE FROM system_settings WHERE key = ?")
					.bind(authProviderSettingKeys.telegramBotToken),
				...telegramSettingStatements(context.db, emptyTelegram(), now),
			);
		statements.push(
			createAuditStatement(context.db, context.request, context.user.id, {
				action: "auth_provider.deleted",
				targetType: "auth_provider",
				targetId: data.id,
				before: {
					providerId: provider.providerId,
					enabled: provider.enabled,
					hasSecret: state.clientSecretProviderIds.has(provider.providerId),
				},
			}),
		);
		await context.db.batch(statements);
		await context.env.FILES?.delete(
			configurationLogoObjectKey("auth", provider.id),
		).catch(() => undefined);
		return { id: data.id };
	});

async function loadProviderState(db: D1Database) {
	const rows = await db
		.prepare(
			`SELECT key, value, updated_at FROM system_settings
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
		.all<{ key: string; value: string; updated_at: number }>();
	const settings = parseAuthProviderSettings(rows.results);
	const secretProviderIds = new Set(
		rows.results.flatMap((row) => {
			const match = /^auth\.provider\.([a-z][a-z0-9_-]{1,63})\.secret$/.exec(
				row.key,
			);
			return match?.[1] ? [match[1]] : [];
		}),
	);
	const encryptedValues = new Map(
		rows.results.map((row) => [row.key, row.value]),
	);
	const hasDedicatedTelegramToken = encryptedValues.has(
		authProviderSettingKeys.telegramBotToken,
	);
	const hasLegacyTelegramToken =
		!hasDedicatedTelegramToken &&
		secretProviderIds.has("telegram") &&
		Boolean(settings.telegram.botUserId && settings.telegram.username);
	const clientSecretProviderIds = new Set(secretProviderIds);
	if (hasLegacyTelegramToken) clientSecretProviderIds.delete("telegram");
	return {
		settings,
		clientSecretProviderIds,
		encryptedValues,
		hasLegacyTelegramToken,
		hasTelegramToken: hasDedicatedTelegramToken || hasLegacyTelegramToken,
		updatedAt: Math.max(0, ...rows.results.map((row) => row.updated_at)),
	};
}

async function resolveProviderSecret(
	context: Awaited<ReturnType<typeof adminContext>>,
	data: z.output<typeof authProviderInputSchema>,
	before: StoredAuthProvider | undefined,
	secretProviderIds: Set<string>,
) {
	if (data.providerType !== "social" || data.clearClientSecret)
		return {
			exists: false,
			statements: [
				context.db
					.prepare("DELETE FROM system_settings WHERE key = ?")
					.bind(authProviderSecretKey(data.providerId)),
			],
		};
	const replacement = data.clientSecret;
	const exists =
		Boolean(replacement) ||
		(before?.providerId === data.providerId &&
			secretProviderIds.has(data.providerId));
	if (!replacement) return { exists, statements: [] as D1PreparedStatement[] };
	if (!context.runtime.authProviderSecret)
		throw new DomainError(
			"auth_provider_secret_unavailable",
			503,
			"Authentication provider encryption is unavailable",
		);
	const encrypted = await encryptSecret(
		replacement,
		context.runtime.authProviderSecret,
		authProviderSecretPurpose(data.providerId),
	);
	return {
		exists: true,
		statements: [
			upsertSetting(
				context.db,
				authProviderSecretKey(data.providerId),
				encrypted,
				Date.now(),
				true,
			),
		],
	};
}

async function resolveTelegramToken(
	context: Awaited<ReturnType<typeof adminContext>>,
	data: z.output<typeof authProviderInputSchema>,
	before: StoredAuthProvider | undefined,
	state: Awaited<ReturnType<typeof loadProviderState>>,
) {
	if (data.providerId !== "telegram")
		return {
			exists: false,
			metadata: emptyTelegram(),
			statements: [] as D1PreparedStatement[],
		};
	if (data.clearTelegramBotToken)
		return {
			exists: false,
			metadata: emptyTelegram(),
			statements: [
				context.db
					.prepare("DELETE FROM system_settings WHERE key = ?")
					.bind(authProviderSettingKeys.telegramBotToken),
			],
		};

	let token = data.telegramBotToken ?? null;
	let identity: { id: string; username: string } | null = null;
	if (token) identity = await verifyTelegramAuthToken(token);
	else if (state.hasLegacyTelegramToken) {
		const encrypted = state.encryptedValues.get(
			authProviderSecretKey("telegram"),
		);
		if (
			encrypted &&
			context.runtime.authProviderSecret &&
			state.settings.telegram.botUserId &&
			state.settings.telegram.username
		) {
			token = await decryptSecret(
				encrypted,
				context.runtime.authProviderSecret,
				authProviderSecretPurpose("telegram"),
			);
			identity = {
				id: state.settings.telegram.botUserId,
				username: state.settings.telegram.username,
			};
		}
	}
	if (token && identity) {
		if (!context.runtime.authProviderSecret)
			throw new DomainError(
				"auth_provider_secret_unavailable",
				503,
				"Authentication provider encryption is unavailable",
			);
		const encrypted = await encryptSecret(
			token,
			context.runtime.authProviderSecret,
			telegramBotTokenSecretPurpose(),
		);
		return {
			exists: true,
			metadata: {
				botUserId: identity.id,
				username: identity.username,
				miniAppEnabled: data.telegramMiniAppEnabled,
			},
			statements: [
				upsertSetting(
					context.db,
					authProviderSettingKeys.telegramBotToken,
					encrypted,
					Date.now(),
					true,
				),
			],
		};
	}
	if (
		data.telegramMiniAppEnabled &&
		(before?.providerId !== "telegram" ||
			!state.settings.telegram.botUserId ||
			!state.settings.telegram.username)
	)
		throw new DomainError(
			"telegram_bot_token_required",
			400,
			"Telegram token is required for Mini App authentication",
		);
	return {
		exists: state.hasTelegramToken,
		metadata: {
			...state.settings.telegram,
			miniAppEnabled: data.telegramMiniAppEnabled,
		},
		statements: [] as D1PreparedStatement[],
	};
}

async function verifyTelegramAuthToken(token: string) {
	const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
		signal: AbortSignal.timeout(8_000),
	}).catch(() => null);
	if (!response?.ok)
		throw new DomainError(
			"telegram_token_invalid",
			400,
			"Telegram token could not be verified",
		);
	const parsed = z
		.object({
			ok: z.literal(true),
			result: z.object({
				id: z.union([z.number().int(), z.string().regex(/^\d{1,20}$/)]),
				is_bot: z.literal(true),
				username: z.string().trim().min(1).max(64),
			}),
		})
		.safeParse(await response.json().catch(() => null));
	if (!parsed.success)
		throw new DomainError(
			"telegram_token_invalid",
			400,
			"Telegram token could not be verified",
		);
	return {
		id: String(parsed.data.result.id),
		username: parsed.data.result.username,
	};
}

function assertProviderCanBeEnabled(
	data: {
		enabled: boolean;
		providerType: string;
		providerId: string;
		clientId?: string | null;
		telegramMiniAppEnabled?: boolean;
	},
	hasSecret: boolean,
	telegram: ReturnType<typeof emptyTelegram>,
	hasTelegramToken: boolean,
) {
	if (!data.enabled || data.providerType !== "social") return;
	const oidcEnabled = Boolean(data.clientId && hasSecret);
	if (data.providerId !== "telegram") {
		if (oidcEnabled) return;
		throw new DomainError(
			"auth_email_delivery_required",
			400,
			"Enabled providers require a client ID and secret",
		);
	}
	const widgetEnabled = Boolean(
		hasTelegramToken && telegram.botUserId && telegram.username,
	);
	if (!oidcEnabled && !widgetEnabled)
		throw new DomainError(
			"auth_provider_incomplete",
			400,
			"Telegram requires complete OIDC credentials or a verified bot token",
		);
	if (data.telegramMiniAppEnabled && !widgetEnabled)
		throw new DomainError(
			"auth_provider_incomplete",
			400,
			"Telegram Mini App authentication requires a verified token",
		);
}

async function assertProviderIdCanChange(db: D1Database, providerId: string) {
	const linked = await db
		.prepare("SELECT id FROM accounts WHERE provider_id = ? LIMIT 1")
		.bind(providerId)
		.first<{ id: string }>();
	if (linked)
		throw new DomainError(
			"auth_provider_id_in_use",
			409,
			"Provider IDs with linked accounts cannot be changed",
		);
}

function presentProvider(
	provider: StoredAuthProvider,
	hasSecret: boolean,
	settings: ReturnType<typeof parseAuthProviderSettings>,
	updatedAt: number,
	baseUrl: string,
) {
	const telegram = provider.providerId === "telegram";
	return {
		...provider,
		providerType: z.enum(authProviderTypes).parse(provider.providerType),
		hasClientSecret: hasSecret,
		telegramBotUserId: telegram ? settings.telegram.botUserId : null,
		telegramUsername: telegram ? settings.telegram.username : null,
		hasTelegramToken: telegram && settings.telegram.botUserId !== null,
		telegramMiniAppEnabled: telegram && settings.telegram.miniAppEnabled,
		revision: settings.revision,
		createdAt: updatedAt,
		updatedAt,
		callbackUrl:
			provider.providerType !== "social"
				? null
				: `${new URL(baseUrl).origin}/api/auth/callback/${provider.providerId}`,
	};
}

async function assertEmailOtpCanBeEnabled(db: D1Database, enabled: boolean) {
	if (!enabled) return;
	const email = await db
		.prepare(
			"SELECT 1 AS enabled FROM notification_channel_configs WHERE channel = 'email' AND enabled = 1 LIMIT 1",
		)
		.first<{ enabled: number }>();
	if (email?.enabled !== 1)
		throw new DomainError(
			"auth_provider_incomplete",
			400,
			"Email delivery must be enabled before email code sign-in",
		);
}

function telegramSettingStatements(
	db: D1Database,
	telegram: ReturnType<typeof emptyTelegram>,
	now: number,
) {
	return [
		upsertSetting(
			db,
			authProviderSettingKeys.telegramBotUserId,
			telegram.botUserId,
			now,
		),
		upsertSetting(
			db,
			authProviderSettingKeys.telegramUsername,
			telegram.username,
			now,
		),
		upsertSetting(
			db,
			authProviderSettingKeys.telegramMiniAppEnabled,
			telegram.miniAppEnabled,
			now,
		),
	];
}

function emptyTelegram() {
	return {
		botUserId: null as string | null,
		username: null as string | null,
		miniAppEnabled: false,
	};
}

function upsertSetting(
	db: D1Database,
	key: string,
	value: unknown,
	now: number,
	isSecret = false,
) {
	return db
		.prepare(
			`INSERT INTO system_settings
			 (key, value, is_secret, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value,
			  is_secret = excluded.is_secret, updated_at = excluded.updated_at`,
		)
		.bind(key, JSON.stringify(value), isSecret ? 1 : 0, now, now);
}

function bumpProvidersRevision(db: D1Database, now: number) {
	return db
		.prepare(
			`INSERT INTO system_settings
			 (key, value, is_secret, created_at, updated_at)
			 VALUES (?, '1', 0, ?, ?)
			 ON CONFLICT(key) DO UPDATE SET
			  value = CAST(CAST(system_settings.value AS INTEGER) + 1 AS TEXT),
			  updated_at = excluded.updated_at`,
		)
		.bind(authProviderSettingKeys.revision, now, now);
}

async function adminContext(permission: "read" | "update" | "delete") {
	const request = getRequest();
	const user = await requireAdmin(
		request,
		systemPermission("settings", permission),
	);
	const env = getCloudflareEnv(request);
	const db = env.DB;
	if (!db) throw new Error("D1 binding DB is unavailable");
	const runtime = await loadRequestRuntimeConfig(
		request,
		db,
		new URL(request.url).origin,
	);
	return { db, env, request, runtime, user };
}
