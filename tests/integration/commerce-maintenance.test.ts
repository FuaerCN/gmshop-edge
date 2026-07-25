import { drizzle } from "drizzle-orm/d1";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "#/db/schema";
import {
	authProviderSecretKey,
	authProviderSecretPurpose,
} from "#/features/auth/provider-settings";
import { installSystem } from "#/features/installation/server/install";
import {
	decryptSecret,
	encryptSecret,
	rotateSecretKeyring,
} from "#/lib/secrets";
import {
	createInitialRuntimeConfig,
	type RuntimeConfig,
} from "#/server/runtime-config";
import { runMaintenance } from "#/server/scheduled/maintenance";
import { applyMigrations } from "./migrations";

describe("bounded commerce maintenance", () => {
	let miniflare: Miniflare;
	let database: D1Database;
	let bucket: R2Bucket;
	let runtime: RuntimeConfig;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-commerce-maintenance" },
			r2Buckets: { FILES: "gmshop-edge-commerce-maintenance-files" },
		});
		database = await miniflare.getD1Database("DB");
		bucket = (await miniflare.getR2Bucket("FILES")) as unknown as R2Bucket;
		await applyMigrations(database);
		runtime = createInitialRuntimeConfig("https://shop.example");
		await installSystem(
			drizzle(database, { schema }),
			{
				name: "Root",
				email: "root@example.com",
				password: "root-secure-password",
			},
			runtime,
		);
	});

	afterAll(async () => miniflare.dispose());

	it("removes expired Better Auth verifications without deleting live rows", async () => {
		const now = Date.now();
		await database.batch([
			database
				.prepare(
					`INSERT INTO verifications
					 (id, identifier, value, expires_at, created_at, updated_at)
					 VALUES ('expired-verification', 'telegram-mini-app:expired', 'telegram', ?, ?, ?),
					        ('live-verification', 'telegram-mini-app:live', 'telegram', ?, ?, ?)`,
				)
				.bind(now - 1, now - 10_000, now - 10_000, now + 60_000, now, now),
		]);

		const result = await runMaintenance(
			{ DB: database, FILES: bucket } as Env,
			"manual",
			undefined,
			now,
		);
		expect(result).toMatchObject({
			authVerificationsDeleted: 1,
		});
		const remaining = await database
			.prepare("SELECT group_concat(id) AS ids FROM verifications")
			.first<{ ids: string }>();
		expect(remaining?.ids).toBe("live-verification");
	});

	it("removes expired rate-limit windows without deleting live counters", async () => {
		const now = Date.now();
		await database
			.prepare(
				`INSERT INTO rate_limit_counters
				 (id, bucket_key, window_start, count, expires_at, created_at, updated_at)
				 VALUES ('expired-rate-limit', 'expired', 0, 1, ?, ?, ?),
				        ('live-rate-limit', 'live', ?, 1, ?, ?, ?)`,
			)
			.bind(now - 1, now - 10_000, now - 10_000, now, now + 60_000, now, now)
			.run();

		const result = await runMaintenance(
			{ DB: database, FILES: bucket } as Env,
			"manual",
			undefined,
			now,
		);
		expect(result.rateLimitsDeleted).toBe(1);
		const remaining = await database
			.prepare(
				"SELECT group_concat(id) AS ids FROM rate_limit_counters ORDER BY id",
			)
			.first<{ ids: string }>();
		expect(remaining?.ids).toBe("live-rate-limit");
	});

	it("progressively rewrites old envelopes after a key rotation", async () => {
		const now = Date.now();
		const encrypted = await encryptSecret(
			"provider-client-secret",
			runtime.authProviderSecret,
			authProviderSecretPurpose("github"),
		);
		await database
			.prepare(
				`INSERT INTO system_settings
				 (key, value, is_secret, created_at, updated_at)
				 VALUES (?, ?, 1, ?, ?)`,
			)
			.bind(
				authProviderSecretKey("github"),
				JSON.stringify(encrypted),
				now,
				now,
			)
			.run();
		const rotated = rotateSecretKeyring(runtime.authProviderSecret);
		await database
			.prepare(
				"UPDATE system_settings SET value = ?, updated_at = ? WHERE key = 'runtime.data_encryption_secret'",
			)
			.bind(JSON.stringify(rotated), now)
			.run();

		const result = await runMaintenance(
			{ DB: database, FILES: bucket } as Env,
			"manual",
			undefined,
			now,
		);
		expect(result.secretsReencrypted).toBeGreaterThanOrEqual(1);
		const row = await database
			.prepare("SELECT value FROM system_settings WHERE key = ?")
			.bind(authProviderSecretKey("github"))
			.first<{ value: string }>();
		const envelope = JSON.parse(row?.value ?? '""') as string;
		expect(envelope.startsWith("v1.k2.")).toBe(true);
		await expect(
			decryptSecret(envelope, rotated, authProviderSecretPurpose("github")),
		).resolves.toBe("provider-client-secret");
	});
});
