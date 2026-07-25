import { describe, expect, it } from "vitest";
import {
	configurationLogoObjectKey,
	configurationLogoUrl,
	resolvePublicConfigurationLogoKey,
} from "#/server/configuration-logo";

const paymentId = "11111111-1111-4111-8111-111111111111";

type AuthProviderFixture = {
	id: string;
	providerId: string;
	providerType: "social";
	displayName: string;
	icon: string | null;
	clientId: string;
	scopes: string[];
	allowSignup: boolean;
	enabled: boolean;
	sortOrder: number;
};

describe("public configuration logo resolution", () => {
	it("derives an enabled payment channel key without trusting the stored key", async () => {
		const database = databaseReturning({
			id: paymentId,
			logo_object_key: "untrusted/object-key",
		});
		await expect(
			resolvePublicConfigurationLogoKey(database, "payment", paymentId),
		).resolves.toBe(configurationLogoObjectKey("payment", paymentId));
	});

	it("rejects invalid or unconfigured payment channels", async () => {
		const database = databaseReturning(null);
		await expect(
			resolvePublicConfigurationLogoKey(database, "payment", "not-a-uuid"),
		).resolves.toBeNull();
		await expect(
			resolvePublicConfigurationLogoKey(database, "payment", paymentId),
		).resolves.toBeNull();
	});

	it("maps an enabled auth provider's public ID to its internal object key", async () => {
		const internalId = "22222222-2222-4222-8222-222222222222";
		const database = authDatabase([
			authProvider(internalId, {
				icon: configurationLogoUrl("auth", "google", 123),
			}),
		]);
		await expect(
			resolvePublicConfigurationLogoKey(database, "auth", "google"),
		).resolves.toBe(configurationLogoObjectKey("auth", internalId));
	});

	it("rejects disabled providers and icons that do not match the requested URL", async () => {
		const internalId = "22222222-2222-4222-8222-222222222222";
		for (const provider of [
			authProvider(internalId, { enabled: false }),
			authProvider(internalId, {
				icon: "/api/configuration-logo/auth/github?v=123",
			}),
			authProvider(internalId, { icon: null }),
		])
			await expect(
				resolvePublicConfigurationLogoKey(
					authDatabase([provider]),
					"auth",
					"google",
				),
			).resolves.toBeNull();
	});
});

function authProvider(
	id: string,
	overrides: Partial<AuthProviderFixture> = {},
): AuthProviderFixture {
	return {
		id,
		providerId: "google",
		providerType: "social",
		displayName: "Google",
		icon: configurationLogoUrl("auth", "google", 123),
		clientId: "client",
		scopes: ["openid", "email", "profile"],
		allowSignup: true,
		enabled: true,
		sortOrder: 10,
		...overrides,
	};
}

function authDatabase(providers: unknown[]) {
	return databaseReturning({ value: JSON.stringify(providers) });
}

function databaseReturning(result: unknown) {
	return {
		prepare: () => ({
			bind: () => ({
				first: async () => result,
			}),
		}),
	} as unknown as D1Database;
}
