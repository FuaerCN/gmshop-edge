import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "./migrations";

describe("coupon D1 constraints", { timeout: 30_000 }, () => {
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
	});

	afterEach(async () => miniflare.dispose());

	it("rejects ambiguous monetary percentage coupons", async () => {
		await expect(
			database
				.prepare(
					`INSERT INTO coupons
					 (id, code, name, type, value_bps, maximum_discount_minor,
					  enabled, used_count, created_at, updated_at)
					 VALUES ('bad', 'BAD', 'Bad', 'percentage', 1000, '500', 1, 0, 1, 1)`,
				)
				.run(),
		).rejects.toThrow();
		await expect(
			database
				.prepare(
					`INSERT INTO coupons
					 (id, code, name, type, currency, value_minor, enabled, used_count,
					  created_at, updated_at)
					 VALUES ('fixed-bad', 'FIXED_BAD', 'Bad', 'fixed', 'CNY', '500', 1, 0, 1, 1)`,
				)
				.run(),
		).rejects.toThrow();
	});

	it("accepts global percentages and currency-scoped capped percentages", async () => {
		await database.batch([
			database.prepare(
				`INSERT INTO coupons
				 (id, code, name, type, value_bps, enabled, used_count, created_at, updated_at)
				 VALUES ('global', 'GLOBAL10', 'Global', 'percentage', 1000, 1, 0, 1, 1)`,
			),
			database.prepare(
				`INSERT INTO coupons
				 (id, code, name, type, currency, currency_decimals, value_bps,
				  maximum_discount_minor, enabled, used_count, created_at, updated_at)
				 VALUES ('capped', 'CAPPED10', 'Capped', 'percentage', 'USD', 2,
				  1000, '500', 1, 0, 1, 1)`,
			),
		]);
		const rows = await database
			.prepare("SELECT code FROM coupons ORDER BY code")
			.all<{ code: string }>();
		expect(rows.results.map((row) => row.code)).toEqual([
			"CAPPED10",
			"GLOBAL10",
		]);
	});
});
