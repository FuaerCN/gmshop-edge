import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadOperationalSettings } from "#/server/operational-settings";
import { applyMigrations } from "./migrations";

describe("authoritative commerce operational settings", () => {
	let miniflare: Miniflare;
	let db: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-operational-settings" },
		});
		db = await miniflare.getD1Database("DB");
		await applyMigrations(db);
	});

	beforeEach(async () => {
		await db
			.prepare("DELETE FROM system_settings WHERE key = 'retention.audit_ms'")
			.run();
	});

	afterAll(async () => miniflare.dispose());

	it("reads every committed retention update from authoritative D1", async () => {
		await put(5_184_000_000);
		await expect(loadOperationalSettings(db)).resolves.toEqual({
			retentionAuditMs: 5_184_000_000,
		});
		await put(7_776_000_000);
		await expect(loadOperationalSettings(db)).resolves.toEqual({
			retentionAuditMs: 7_776_000_000,
		});
	});

	it("falls back for missing, malformed, or unsafe values", async () => {
		await expect(loadOperationalSettings(db)).resolves.toEqual({
			retentionAuditMs: 31_536_000_000,
		});
		await put("invalid");
		await expect(loadOperationalSettings(db)).resolves.toEqual({
			retentionAuditMs: 31_536_000_000,
		});
	});

	it("fails closed when D1 is unavailable", async () => {
		const unavailable = {
			prepare: () => ({
				first: async () => {
					throw new Error("D1 unavailable");
				},
			}),
		} as unknown as D1Database;
		await expect(loadOperationalSettings(unavailable)).rejects.toThrow(
			"D1 unavailable",
		);
	});

	async function put(value: unknown) {
		await db
			.prepare(
				`INSERT INTO system_settings (key, value, is_secret, created_at, updated_at)
				 VALUES ('retention.audit_ms', ?, 0, 1, 1)
				 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
			)
			.bind(JSON.stringify(value))
			.run();
	}
});
