import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("catalog tag-name migration", { timeout: 30_000 }, () => {
	let miniflare: Miniflare;
	let database: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: crypto.randomUUID() },
		});
		database = await miniflare.getD1Database("DB");
		await applyMigration(database, "0000_gmshop.sql");
		await applyMigration(database, "0001_telegram_bot_support.sql");
		await applyMigration(database, "0002_glamorous_pete_wisdom.sql");
		await database.batch([
			database.prepare(
				`INSERT INTO products (id, name, product_type, status, created_at, updated_at)
				 VALUES ('product', 'Product', 'stock', 'draft', 1, 1)`,
			),
			database.prepare(
				`INSERT INTO product_tags (id, name, normalized_name, created_at, updated_at)
				 VALUES ('legacy-tag', '  Mixed  Spacing  ', 'mixed spacing', 1, 1)`,
			),
			database.prepare(
				`INSERT INTO product_tag_links (id, product_id, tag_id, created_at)
				 VALUES ('link', 'product', 'legacy-tag', 1)`,
			),
			database.prepare(
				`INSERT INTO coupons
				 (id, code, name, type, value_bps, scope_json, enabled, created_at, updated_at)
				 VALUES ('coupon', 'TAGGED', 'Tagged', 'percentage', 1000,
				 '{"productIds":[],"tagIds":["legacy-tag"]}', 1, 1, 1)`,
			),
		]);
		await applyMigration(database, "0003_product_tag_names.sql");
	});

	afterAll(async () => miniflare.dispose());

	it("moves tag identity to the product's exact stored names", async () => {
		const product = await database
			.prepare("SELECT tag_names FROM products WHERE id = 'product'")
			.first<{ tag_names: string }>();
		expect(JSON.parse(product?.tag_names ?? "[]")).toEqual(["Mixed  Spacing"]);
		expect(
			await database
				.prepare(
					"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'product_tags'",
				)
				.first(),
		).toBeNull();
		expect(
			await database
				.prepare(
					"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'product_tag_links'",
				)
				.first(),
		).toBeNull();
	});

	it("converts coupon tag scopes from ids to names", async () => {
		const coupon = await database
			.prepare("SELECT scope_json FROM coupons WHERE id = 'coupon'")
			.first<{ scope_json: string }>();
		expect(JSON.parse(coupon?.scope_json ?? "{}")).toEqual({
			productIds: [],
			tagNames: ["Mixed  Spacing"],
		});
		expect(
			(await database.prepare("PRAGMA foreign_key_check").all()).results,
		).toEqual([]);
	});
});

async function applyMigration(database: D1Database, name: string) {
	const sql = await readFile(
		new URL(`../../drizzle/${name}`, import.meta.url),
		"utf8",
	);
	for (const statement of sql
		.split("--> statement-breakpoint")
		.map((value) => value.trim())
		.filter(Boolean))
		await database.prepare(statement).run();
}
