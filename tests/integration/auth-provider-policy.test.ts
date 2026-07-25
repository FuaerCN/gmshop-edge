import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "#/db/schema";
import {
	authProviderSettingKeys,
	initialStoredAuthProviders,
} from "#/features/auth/provider-settings";
import {
	assertAccountCanBeUnlinked,
	assertAuthProviderCanBeDisabled,
} from "#/features/auth/server/provider-policy";
import { installSystem } from "#/features/installation/server/install";
import { createInitialRuntimeConfig } from "#/server/runtime-config";
import { applyMigrations } from "./migrations";

describe("authentication provider lockout policy", () => {
	let miniflare: Miniflare;
	let database: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-auth-provider-policy" },
		});
		database = await miniflare.getD1Database("DB");
		await applyMigrations(database);
		await installSystem(
			drizzle(database, { schema }),
			{
				name: "Root",
				email: "root@example.com",
				password: "root-secure-password",
			},
			createInitialRuntimeConfig("https://shop.example"),
		);
	});

	afterAll(async () => miniflare.dispose());

	it("rejects disabling the only enabled method linked to a user", async () => {
		await expect(
			assertAuthProviderCanBeDisabled(database, "credential"),
		).rejects.toMatchObject({
			code: "auth_provider_would_lock_accounts",
			status: 409,
		});
	});

	it("allows disabling a method after another linked method is enabled", async () => {
		const root = await database
			.prepare("SELECT id FROM users WHERE email = 'root@example.com'")
			.first<{ id: string }>();
		expect(root).not.toBeNull();
		const now = Date.now();
		const providers = [
			...initialStoredAuthProviders,
			{
				id: "33333333-3333-4333-8333-333333333333",
				providerId: "github",
				providerType: "social",
				displayName: "GitHub",
				icon: null,
				clientId: null,
				scopes: [],
				allowSignup: true,
				enabled: true,
				sortOrder: 20,
			},
		];
		await database.batch([
			database
				.prepare(
					`UPDATE system_settings SET value = ?, updated_at = ?
					 WHERE key = ?`,
				)
				.bind(
					JSON.stringify(providers),
					now,
					authProviderSettingKeys.providers,
				),
			database
				.prepare(
					`INSERT INTO accounts
					 (id, account_id, provider_id, user_id, created_at, updated_at)
					 VALUES (?, 'root-github', 'github', ?, ?, ?)`,
				)
				.bind(crypto.randomUUID(), root?.id, now, now),
		]);

		await expect(
			assertAuthProviderCanBeDisabled(database, "credential"),
		).resolves.toBeUndefined();
		await expect(
			assertAccountCanBeUnlinked(database, {
				userId: root?.id ?? "",
				providerId: "credential",
			}),
		).resolves.toBeUndefined();

		const disabledProviders = providers.map((provider) =>
			provider.providerId === "github"
				? { ...provider, enabled: false }
				: provider,
		);
		await database
			.prepare("UPDATE system_settings SET value = ? WHERE key = ?")
			.bind(
				JSON.stringify(disabledProviders),
				authProviderSettingKeys.providers,
			)
			.run();
		await expect(
			assertAuthProviderCanBeDisabled(database, "credential"),
		).rejects.toMatchObject({ code: "auth_provider_would_lock_accounts" });
		await expect(
			assertAccountCanBeUnlinked(database, {
				userId: root?.id ?? "",
				providerId: "credential",
			}),
		).rejects.toMatchObject({ code: "auth_last_login_method", status: 409 });
	});
});
