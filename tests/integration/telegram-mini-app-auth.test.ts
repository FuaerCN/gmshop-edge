import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "#/db/schema";
import {
	authProviderSecretKey,
	authProviderSecretPurpose,
	authProviderSettingKeys,
	initialStoredAuthProviders,
} from "#/features/auth/provider-settings";
import { createAuth } from "#/features/auth/server/auth-factory";
import { loadRuntimeAuthProviders } from "#/features/auth/server/provider-runtime";
import { installSystem } from "#/features/installation/server/install";
import { encryptSecret } from "#/lib/secrets";
import { createInitialRuntimeConfig } from "#/server/runtime-config";
import { signedTelegramInitData } from "../helpers/telegram-init-data";
import { applyMigrations } from "./migrations";

describe("Telegram Mini App Better Auth login", { timeout: 30_000 }, () => {
	let miniflare: Miniflare;
	let database: D1Database;
	let auth: ReturnType<typeof createAuth>;
	const runtime = createInitialRuntimeConfig("https://shop.example");
	const botToken = "123456:telegram-integration-token";

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-telegram-mini-app-auth" },
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
			runtime,
		);
		const now = Date.now();
		const providers = [
			...initialStoredAuthProviders,
			{
				id: "11111111-1111-4111-8111-111111111111",
				providerId: "telegram",
				providerType: "social",
				displayName: "Telegram",
				icon: null,
				clientId: "123456",
				scopes: ["openid", "profile"],
				allowSignup: true,
				enabled: true,
				sortOrder: 20,
			},
		];
		await database.batch([
			database
				.prepare(
					`INSERT OR REPLACE INTO system_settings
					 (key, value, is_secret, created_at, updated_at)
					 VALUES (?, ?, 0, ?, ?)`,
				)
				.bind(
					authProviderSettingKeys.providers,
					JSON.stringify(providers),
					now,
					now,
				),
			database
				.prepare(
					`INSERT OR REPLACE INTO system_settings
					 (key, value, is_secret, created_at, updated_at)
					 VALUES (?, ?, 1, ?, ?)`,
				)
				.bind(
					authProviderSecretKey("telegram"),
					JSON.stringify(
						await encryptSecret(
							botToken,
							runtime.authProviderSecret,
							authProviderSecretPurpose("telegram"),
						),
					),
					now,
					now,
				),
			...[
				[authProviderSettingKeys.telegramBotUserId, "123456"],
				[authProviderSettingKeys.telegramUsername, "gmshop_test_bot"],
				[authProviderSettingKeys.telegramMiniAppEnabled, true],
			].map(([key, value]) =>
				database
					.prepare(
						`INSERT OR REPLACE INTO system_settings
						 (key, value, is_secret, created_at, updated_at)
						 VALUES (?, ?, 0, ?, ?)`,
					)
					.bind(key, JSON.stringify(value), now, now),
			),
		]);
		auth = createAuth(drizzle(database, { schema }), {
			BETTER_AUTH_SECRET: runtime.betterAuthSecret,
			BETTER_AUTH_URL: runtime.betterAuthUrl,
			AUTH_PROVIDERS: await loadRuntimeAuthProviders(
				database,
				runtime.authProviderSecret,
				runtime.integrationConfigSecret,
			),
		});
	});

	afterAll(async () => miniflare.dispose());

	it("creates one canonical Telegram account/session and rejects replay", async () => {
		const initData = await signedTelegramInitData(
			botToken,
			Math.floor(Date.now() / 1_000),
		);
		const request = () =>
			new Request("https://shop.example/api/auth/telegram/miniapp/signin", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://shop.example",
					"cf-connecting-ip": "203.0.113.10",
				},
				body: JSON.stringify({ initData }),
			});
		const response = await auth.handler(request());
		expect(response.status).toBe(200);
		expect(response.headers.get("set-cookie")).toContain(
			"better-auth.session_token",
		);
		const state = await database
			.prepare(`SELECT
			 (SELECT COUNT(*) FROM users) AS users,
			 (SELECT COUNT(*) FROM accounts WHERE provider_id = 'telegram') AS accounts,
			 (SELECT preferred_locale FROM users WHERE email LIKE 'telegram-%@identity.gmshop.invalid' LIMIT 1) AS telegram_locale,
			 (SELECT COUNT(*) FROM verifications WHERE identifier LIKE 'telegram-mini-app:%') AS receipts,
			 (SELECT COUNT(*) FROM audit_logs WHERE action = 'auth.telegram_mini_app_signed_in') AS audits`)
			.first<Record<string, unknown>>();
		expect(state).toEqual({
			users: 2,
			accounts: 1,
			telegram_locale: "zh-CN",
			receipts: 1,
			audits: 1,
		});

		const replay = await auth.handler(request());
		expect(replay.status).toBe(401);
		const replayBody = await replay.text();
		expect(replayBody).not.toContain(botToken);
		expect(replayBody).not.toContain(initData);
	});

	it("rejects untrusted origins, disabled users and disabled providers", async () => {
		const authDate = Math.floor(Date.now() / 1_000);
		const untrustedData = await signedTelegramInitData(botToken, authDate, {
			query_id: "AAEAA-untrusted-origin",
		});
		const untrusted = await auth.handler(
			new Request("https://shop.example/api/auth/telegram/miniapp/signin", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://evil.example",
				},
				body: JSON.stringify({
					initData: untrustedData,
				}),
			}),
		);
		expect(untrusted.status).toBeGreaterThanOrEqual(400);

		await database
			.prepare(
				`UPDATE users SET enabled = 0 WHERE email =
				 'telegram-900719925474000@identity.gmshop.invalid'`,
			)
			.run();
		const disabledData = await signedTelegramInitData(botToken, authDate, {
			query_id: "AAEAA-disabled-user",
		});
		const disabled = await auth.handler(
			new Request("https://shop.example/api/auth/telegram/miniapp/signin", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://shop.example",
				},
				body: JSON.stringify({
					initData: disabledData,
				}),
			}),
		);
		expect(disabled.status).toBe(403);

		const withoutProvider = createAuth(drizzle(database, { schema }), {
			BETTER_AUTH_SECRET: runtime.betterAuthSecret,
			BETTER_AUTH_URL: runtime.betterAuthUrl,
			AUTH_PROVIDERS: [],
		});
		const unavailable = await withoutProvider.handler(
			new Request("https://shop.example/api/auth/telegram/miniapp/signin", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://shop.example",
				},
				body: JSON.stringify({
					initData: disabledData,
				}),
			}),
		);
		expect(unavailable.status).toBe(404);
	});
});
