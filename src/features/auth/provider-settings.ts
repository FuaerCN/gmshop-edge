import { z } from "zod";
import { authProviderAllowedScopes } from "#/features/auth/provider-presets";
import {
	authProviderTypes,
	builtInSocialProviderIds,
} from "#/features/auth/provider-schema";

export const authProviderSettingKeys = {
	providers: "auth.providers",
	revision: "auth.providers_revision",
	telegramBotUserId: "auth.telegram.bot_user_id",
	telegramUsername: "auth.telegram.username",
	telegramMiniAppEnabled: "auth.telegram.mini_app_enabled",
} as const;

export const storedAuthProviderSchema = z
	.object({
		id: z.union([z.uuid(), z.literal("auth-provider-credential")]),
		providerId: z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/),
		providerType: z.enum(authProviderTypes),
		displayName: z.string().min(1).max(80),
		icon: z.string().max(160).nullable(),
		clientId: z.string().max(500).nullable(),
		scopes: z.array(z.string().min(1).max(100)).max(20),
		allowSignup: z.boolean(),
		enabled: z.boolean(),
		sortOrder: z.number().int().min(0).max(1_000_000),
	})
	.strict()
	.superRefine((provider, context) => {
		if (provider.providerType !== "social") return;
		const allowed =
			authProviderAllowedScopes[
				provider.providerId as keyof typeof authProviderAllowedScopes
			];
		for (const [index, scope] of provider.scopes.entries())
			if (!allowed?.includes(scope as never))
				context.addIssue({
					code: "custom",
					path: ["scopes", index],
					message: "Unsupported scope for authentication provider preset",
				});
	});

export const storedAuthProvidersSchema = z
	.array(storedAuthProviderSchema)
	.max(20)
	.superRefine((providers, context) => {
		const ids = new Set<string>();
		const providerIds = new Set<string>();
		for (const [index, provider] of providers.entries()) {
			if (ids.has(provider.id))
				context.addIssue({
					code: "custom",
					path: [index, "id"],
					message: "Duplicate authentication provider ID",
				});
			if (providerIds.has(provider.providerId))
				context.addIssue({
					code: "custom",
					path: [index, "providerId"],
					message: "Duplicate authentication provider",
				});
			ids.add(provider.id);
			providerIds.add(provider.providerId);
			if (
				provider.providerType === "social" &&
				!builtInSocialProviderIds.includes(provider.providerId as never)
			)
				context.addIssue({
					code: "custom",
					path: [index, "providerId"],
					message: "Unsupported authentication provider",
				});
		}
	});

export type StoredAuthProvider = z.infer<typeof storedAuthProviderSchema>;

export const initialStoredAuthProviders: StoredAuthProvider[] = [
	{
		id: "auth-provider-credential",
		providerId: "credential",
		providerType: "email_password",
		displayName: "Email and password",
		icon: null,
		clientId: null,
		scopes: [],
		allowSignup: true,
		enabled: true,
		sortOrder: 10,
	},
];

export function authProviderSecretKey(providerId: string) {
	return `auth.provider.${providerId}.secret`;
}

export function authProviderSecretPurpose(providerId: string) {
	return `auth-provider:${providerId}`;
}

export function parseAuthProviderSettings(
	rows: readonly { key: string; value: string }[],
) {
	const values = new Map(rows.map((row) => [row.key, parseJson(row.value)]));
	return {
		providers: storedAuthProvidersSchema.parse(
			values.get(authProviderSettingKeys.providers) ??
				initialStoredAuthProviders,
		),
		revision: z
			.number()
			.int()
			.positive()
			.parse(values.get(authProviderSettingKeys.revision) ?? 1),
		telegram: {
			botUserId: z
				.string()
				.regex(/^\d{1,20}$/)
				.nullable()
				.parse(values.get(authProviderSettingKeys.telegramBotUserId) ?? null),
			username: z
				.string()
				.min(1)
				.max(64)
				.nullable()
				.parse(values.get(authProviderSettingKeys.telegramUsername) ?? null),
			miniAppEnabled: z
				.boolean()
				.parse(
					values.get(authProviderSettingKeys.telegramMiniAppEnabled) ?? false,
				),
		},
	};
}

function parseJson(value: string) {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return undefined;
	}
}
