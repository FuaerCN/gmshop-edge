import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "#/db/schema";
import { createAuth } from "#/features/auth/server/auth-factory";
import {
	decryptNotificationMessage,
	encryptNotificationConfig,
} from "#/features/notifications/secrets";
import { applyMigrations } from "./migrations";

describe("authentication email flow", { timeout: 30_000 }, () => {
	let miniflare: Miniflare;
	let database: D1Database;

	beforeEach(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: crypto.randomUUID() },
		});
		database = await miniflare.getD1Database("DB");
		await applyMigrations(database);
		await seed(database);
	});

	afterEach(async () => miniflare.dispose());

	it("queues encrypted verification and reset messages without exposing tokens", async () => {
		const auth = createAuth(drizzle(database, { schema }), {
			BETTER_AUTH_SECRET: "better-auth-test-secret-at-least-32-characters",
			BETTER_AUTH_URL: "https://shop.example",
			TRUSTED_ORIGINS: ["https://shop.example"],
			EMAIL_DELIVERY_ENABLED: true,
			REQUIRE_EMAIL_VERIFICATION: true,
			SITE_NAME: "Test Shop",
			AUTH_PROVIDERS: [
				{
					id: "credential-provider",
					providerId: "credential",
					providerType: "email_password",
					displayName: "Email",
					clientId: null,
					clientSecret: null,
					scopes: [],
					allowSignup: true,
					revision: 1,
					telegramBotUserId: null,
					telegramBotUsername: null,
					telegramBotToken: null,
					telegramMiniAppEnabled: false,
				},
			],
		});
		const signup = await auth.handler(
			jsonRequest("/api/auth/sign-up/email", {
				name: "Buyer",
				email: "buyer@example.com",
				password: "very-secure-password",
				preferredLocale: "zh-CN",
				callbackURL: "/account",
			}),
		);
		expect(signup.status).toBe(200);
		const registered = await database
			.prepare(
				`SELECT u.role_ids, u.preferred_locale, r.name AS role_name, r.permissions_json
				 FROM users u
				 JOIN json_each(u.role_ids) assigned
				 JOIN roles r ON r.id = assigned.value
				 WHERE u.email = 'buyer@example.com'`,
			)
			.first<{
				role_ids: string;
				role_name: string;
				permissions_json: string;
				preferred_locale: string;
			}>();
		expect(registered).toMatchObject({
			role_name: "customer",
			permissions_json: "{}",
			preferred_locale: "zh-CN",
		});
		expect(JSON.parse(registered?.role_ids ?? "[]")).toHaveLength(1);
		const reset = await auth.handler(
			jsonRequest("/api/auth/email-otp/request-password-reset", {
				email: "buyer@example.com",
			}),
		);
		expect(reset.status).toBe(200);
		const deliveries = await database
			.prepare(
				`SELECT event, locale, idempotency_key, message_encrypted
				 FROM notification_deliveries ORDER BY created_at, id`,
			)
			.all<Record<string, unknown>>();
		expect(deliveries.results.map((row) => row.event).sort()).toEqual([
			"auth.email_verification",
			"auth.password_reset",
		]);
		expect(deliveries.results.every((row) => row.locale === "zh-CN")).toBe(
			true,
		);
		for (const delivery of deliveries.results) {
			expect(String(delivery.message_encrypted)).not.toContain(
				"buyer@example.com",
			);
			expect(String(delivery.idempotency_key)).not.toContain("reset-password");
			expect(String(delivery.idempotency_key)).toMatch(/[a-f0-9]{64}$/);
		}
		const resetDelivery = deliveries.results.find(
			(delivery) => delivery.event === "auth.password_reset",
		);
		const resetMessage = JSON.parse(
			await decryptNotificationMessage(
				String(resetDelivery?.message_encrypted),
				"commerce-test-secret",
			),
		) as { text: string };
		expect(resetMessage.text).toContain("密码重置验证码");
		const otp = resetMessage.text.match(/\b\d{6}\b/)?.[0];
		expect(otp).toMatch(/^\d{6}$/);
		const completed = await auth.handler(
			jsonRequest("/api/auth/email-otp/reset-password", {
				email: "buyer@example.com",
				otp,
				password: "new-very-secure-password",
			}),
		);
		expect(completed.status).toBe(200);
		const signIn = await auth.handler(
			jsonRequest("/api/auth/sign-in/email", {
				email: "buyer@example.com",
				password: "new-very-secure-password",
			}),
		);
		expect(signIn.status).toBe(200);
	});
});

function jsonRequest(path: string, body: unknown) {
	return new Request(`https://shop.example${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Origin: "https://shop.example",
		},
		body: JSON.stringify(body),
	});
}

async function seed(database: D1Database) {
	const apiKeyEncrypted = await encryptNotificationConfig(
		"re_test_key",
		"commerce-test-secret",
	);
	await database.batch([
		database.prepare(
			`INSERT INTO roles
			 (id, name, description, built_in, enabled, permissions_json, created_at, updated_at)
			 VALUES ('00000000-0000-4000-8000-000000000050', 'customer',
			  'Built-in authenticated storefront customer role', 1, 1, '{}', 1, 1)`,
		),
		database.prepare(
			`INSERT INTO system_settings (key, value, is_secret, created_at, updated_at)
			 VALUES ('runtime.data_encryption_secret', '"commerce-test-secret"', 1, 1, 1)`,
		),
		database
			.prepare(
				`INSERT INTO notification_channel_configs
				 (id, channel, name, provider, api_key_encrypted, api_key_version,
				  from_address, sort_order, enabled, created_at, updated_at)
				 VALUES ('email-config', 'email', 'Primary', 'resend', ?, 1,
				  'Test Shop <mail@example.com>', 100, 1, 1, 1)`,
			)
			.bind(apiKeyEncrypted),
	]);
}
