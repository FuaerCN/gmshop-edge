import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { claimFixedWindowRateLimit } from "#/server/rate-limit";
import { applyMigrations } from "./migrations";

describe("D1 fixed-window rate limits", () => {
	let miniflare: Miniflare;
	let db: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-rate-limits" },
		});
		db = await miniflare.getD1Database("DB");
		await applyMigrations(db);
	});

	afterAll(async () => miniflare.dispose());

	it("atomically caps a bucket and opens a fresh window", async () => {
		const input = {
			bucketKey: "auth:198.51.100.10",
			limit: 2,
			windowMs: 60_000,
		};
		await expect(
			claimFixedWindowRateLimit(db, { ...input, now: 1_000 }),
		).resolves.toMatchObject({ allowed: true, count: 1, windowStart: 0 });
		await expect(
			claimFixedWindowRateLimit(db, { ...input, now: 2_000 }),
		).resolves.toMatchObject({ allowed: true, count: 2, windowStart: 0 });
		await expect(
			claimFixedWindowRateLimit(db, { ...input, now: 3_000 }),
		).resolves.toMatchObject({ allowed: false, count: 2, windowStart: 0 });
		await expect(
			claimFixedWindowRateLimit(db, { ...input, now: 60_000 }),
		).resolves.toMatchObject({
			allowed: true,
			count: 1,
			windowStart: 60_000,
		});
	});

	it("uses the bounded expiry index", async () => {
		const plan = await db
			.prepare(
				`EXPLAIN QUERY PLAN
				 SELECT id FROM rate_limit_counters
				 INDEXED BY rate_limit_counters_expiry_idx
				 WHERE expires_at <= ? ORDER BY expires_at, id LIMIT 500`,
			)
			.bind(120_000)
			.all<{ detail: string }>();
		expect(plan.results.map((row) => row.detail).join(" ")).toContain(
			"rate_limit_counters_expiry_idx",
		);
	});
});
