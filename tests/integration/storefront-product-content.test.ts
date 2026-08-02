import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { selectStorefrontProductRow } from "#/features/storefront/server/product-query";
import { applyMigrations } from "./migrations";

describe("storefront product content", { timeout: 30_000 }, () => {
	let miniflare: Miniflare;
	let db: D1Database;

	beforeEach(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: crypto.randomUUID() },
		});
		db = await miniflare.getD1Database("DB");
		await applyMigrations(db);
		await db.batch([
			db.prepare(
				`INSERT INTO products
				 (id, name, description, tag_names, product_type, status, created_at, updated_at)
				 VALUES ('product', 'Base name', 'Base description', '["Software"]', 'stock', 'active', 1, 1)`,
			),
		]);
	});

	afterEach(async () => miniflare.dispose());

	it("returns the single stored product content in every interface locale", async () => {
		const product = await selectStorefrontProductRow(db, "product");
		expect(product).toMatchObject({
			name: "Base name",
			description: "Base description",
		});
		expect(JSON.parse(String(product?.tags_json))).toEqual(["Software"]);
	});
});
