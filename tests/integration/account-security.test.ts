import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	listStoreNotificationPreferences,
	listStoreSessions,
	revokeStoreSession,
	updateStoreNotificationPreference,
	updateStoreProfile,
} from "#/features/storefront/server/account-security";
import { applyMigrations } from "./migrations";

describe("store account security", { timeout: 30_000 }, () => {
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

	it("updates the user profile with an audit record", async () => {
		await expect(
			updateStoreProfile(
				database,
				{ name: "Updated buyer", preferredLocale: "zh-CN" },
				{
					userId: "user-account",
					currentName: "Buyer",
					currentPreferredLocale: "en-US",
					request: testRequest(),
				},
			),
		).resolves.toEqual({ name: "Updated buyer" });
		const state = await database
			.prepare(
				`SELECT u.name AS user_name, u.preferred_locale,
				 (SELECT COUNT(*) FROM audit_logs WHERE action = 'account.profile_updated'
				  AND actor_user_id = u.id) AS audits
				 FROM users u WHERE u.id = ?`,
			)
			.bind("user-account")
			.first<Record<string, unknown>>();
		expect(state).toMatchObject({
			user_name: "Updated buyer",
			preferred_locale: "zh-CN",
			audits: 1,
		});
	});

	it("lists active sessions without tokens and revokes only owned non-current sessions", async () => {
		const sessions = await listStoreSessions(
			database,
			"user-account",
			"session-current",
			1_000,
		);
		expect(sessions).toEqual([
			expect.objectContaining({ id: "session-current", current: true }),
			expect.objectContaining({ id: "session-other", current: false }),
		]);
		expect(sessions[0]).not.toHaveProperty("token");
		await expect(
			revokeStoreSession(database, "session-other", {
				userId: "user-account",
				currentSessionId: "session-current",
				request: testRequest(),
			}),
		).resolves.toEqual({ id: "session-other" });
		await expect(
			revokeStoreSession(database, "session-current", {
				userId: "user-account",
				currentSessionId: "session-current",
				request: testRequest(),
			}),
		).rejects.toMatchObject({ code: "current_session_revoke_denied" });
		await expect(
			revokeStoreSession(database, "session-foreign", {
				userId: "user-account",
				currentSessionId: "session-current",
				request: testRequest(),
			}),
		).rejects.toMatchObject({ code: "session_not_found" });
		const state = await database
			.prepare(
				`SELECT (SELECT COUNT(*) FROM sessions WHERE id = 'session-other') AS remaining,
				 (SELECT COUNT(*) FROM audit_logs WHERE action = 'account.session_revoked'
				  AND target_id = 'session-other') AS audits`,
			)
			.first<Record<string, unknown>>();
		expect(state).toMatchObject({ remaining: 0, audits: 1 });
	});

	it("stores customer notification preferences without plaintext destinations", async () => {
		await expect(
			updateStoreNotificationPreference(
				database,
				{ event: "delivery_ready", enabled: false },
				{
					userId: "user-account",
					email: "buyer@example.com",
					emailVerified: true,
					preferredLocale: "zh-CN",
					request: testRequest(),
				},
			),
		).resolves.toMatchObject({
			event: "delivery_ready",
			enabled: false,
		});
		const preferences = await listStoreNotificationPreferences(
			database,
			"user-account",
		);
		expect(preferences.get("delivery_ready")).toEqual({
			enabled: false,
		});
		const stored = await database
			.prepare(
				`SELECT destination_encrypted FROM notification_subscriptions
				 WHERE user_id = 'user-account' AND event = 'delivery_ready'`,
			)
			.first<{ destination_encrypted: string }>();
		expect(stored?.destination_encrypted).not.toContain("buyer@example.com");
	});
});

async function seed(database: D1Database) {
	await database.batch([
		database.prepare(
			`INSERT INTO system_settings (key, value, is_secret, created_at, updated_at)
			 VALUES ('runtime.data_encryption_secret', '"commerce-test-secret"', 1, 1, 1)`,
		),
		database.prepare(
			`INSERT INTO users
			 (id, name, email, email_verified, enabled, created_at, updated_at)
			 VALUES
			 ('user-account', 'Buyer', 'buyer@example.com', 1, 1, 1, 1),
			 ('user-foreign', 'Other', 'other@example.com', 1, 1, 1, 1)`,
		),
		database.prepare(
			`INSERT INTO sessions
			 (id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at)
			 VALUES
			 ('session-current', 'user-account', 'token-current', 5000, '127.0.0.1', 'Current browser', 1, 30),
			 ('session-other', 'user-account', 'token-other', 5000, '127.0.0.2', 'Other browser', 1, 20),
			 ('session-expired', 'user-account', 'token-expired', 999, NULL, NULL, 1, 10),
			 ('session-foreign', 'user-foreign', 'token-foreign', 5000, NULL, NULL, 1, 1)`,
		),
	]);
}

function testRequest() {
	return new Request("https://shop.example/account", {
		headers: { "x-request-id": crypto.randomUUID() },
	});
}
