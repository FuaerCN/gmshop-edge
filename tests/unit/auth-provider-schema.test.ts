import { describe, expect, it } from "vitest";
import { isInternalIdentityEmail } from "#/features/auth/identity-email";
import { authProviderPresets } from "#/features/auth/provider-presets";
import { authProviderInputSchema } from "#/features/auth/provider-schema";
import {
	authProviderSettingKeys,
	parseAuthProviderSettings,
} from "#/features/auth/provider-settings";
import { sensitiveProofSchema } from "#/features/auth/reauthentication-schema";

describe("authentication provider configuration", () => {
	it("offers Telegram as a Better Auth social provider", () => {
		expect(
			authProviderPresets
				.filter((provider) => provider.providerType === "social")
				.map((provider) => provider.providerId),
		).toEqual([
			"google",
			"github",
			"discord",
			"apple",
			"microsoft",
			"line",
			"telegram",
			"wechat",
		]);
	});

	it("models email as one built-in method with password and code options", () => {
		expect(
			authProviderPresets.map((provider) => String(provider.providerId)),
		).not.toContain("email-otp");
		expect(
			authProviderInputSchema.parse({
				id: "auth-provider-credential",
				providerId: "credential",
				providerType: "email",
				displayName: "Email",
				scopes: [],
				passwordLoginEnabled: false,
				emailOtpEnabled: true,
				enabled: true,
			}),
		).toMatchObject({
			providerType: "email",
			passwordLoginEnabled: false,
			emailOtpEnabled: true,
		});
	});

	it("requires an enabled email method to expose a sign-in flow", () => {
		expect(
			authProviderInputSchema.safeParse({
				providerId: "credential",
				providerType: "email",
				displayName: "Email",
				scopes: [],
				passwordLoginEnabled: false,
				emailOtpEnabled: false,
				enabled: true,
			}).success,
		).toBe(false);
	});

	it("normalizes legacy email providers without a database migration", () => {
		const legacyProvider = {
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
		};
		const legacyOtp = {
			...legacyProvider,
			id: "22222222-2222-4222-8222-222222222222",
			providerId: "email-otp",
			providerType: "email_otp",
			displayName: "Email OTP",
			sortOrder: 20,
		};
		const settings = parseAuthProviderSettings([
			{
				key: authProviderSettingKeys.providers,
				value: JSON.stringify([legacyProvider, legacyOtp]),
			},
		]);

		expect(settings.providers).toHaveLength(1);
		expect(settings.providers[0]).toMatchObject({
			providerId: "credential",
			providerType: "email",
			displayName: "Email",
			passwordLoginEnabled: true,
			emailOtpEnabled: true,
			enabled: true,
		});
	});

	it("accepts the canonical Telegram OIDC preset", () => {
		const telegram = authProviderPresets.find(
			(provider) => provider.providerId === "telegram",
		);
		expect(telegram).toBeDefined();
		expect(
			authProviderInputSchema.parse({
				...telegram,
				clientId: "123456789",
				clientSecret: "secret",
				telegramBotToken: "123456789:telegram-bot-token-value",
			}),
		).toMatchObject({
			providerId: "telegram",
			providerType: "social",
			telegramBotToken: "123456789:telegram-bot-token-value",
		});
	});

	it("rejects a non-canonical Telegram provider", () => {
		const base = {
			providerId: "telegram-custom",
			providerType: "social" as const,
			displayName: "Telegram",
			scopes: ["openid"],
		};
		expect(authProviderInputSchema.safeParse(base).success).toBe(false);
	});

	it("rejects scopes and endpoint overrides outside the closed preset", () => {
		const google = {
			...authProviderPresets[0],
			clientId: "client",
			clientSecret: "secret",
		};
		expect(
			authProviderInputSchema.safeParse({
				...google,
				scopes: ["openid", "admin"],
			}).success,
		).toBe(false);
		expect(
			authProviderInputSchema.safeParse({
				...google,
				authorizationUrl: "https://evil.example/authorize",
			}).success,
		).toBe(false);
		expect(
			authProviderInputSchema.safeParse({
				...google,
				pkce: "disabled",
			}).success,
		).toBe(false);
	});

	it("recognizes only the reserved non-deliverable identity domain", () => {
		expect(isInternalIdentityEmail("42@telegram.invalid")).toBe(true);
		expect(isInternalIdentityEmail("telegram-42@identity.gmshop.invalid")).toBe(
			true,
		);
		expect(isInternalIdentityEmail("buyer@example.com")).toBe(false);
		expect(isInternalIdentityEmail(null)).toBe(false);
	});

	it("requires a current password proof for sensitive actions", () => {
		expect(sensitiveProofSchema.safeParse({}).success).toBe(false);
		expect(
			sensitiveProofSchema.safeParse({ password: "current" }).success,
		).toBe(true);
		expect(sensitiveProofSchema.safeParse({ totpCode: "123456" }).success).toBe(
			false,
		);
		expect(sensitiveProofSchema.safeParse({ password: "" }).success).toBe(
			false,
		);
	});
});
