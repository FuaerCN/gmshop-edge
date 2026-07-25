import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { productMediaResponse } from "#/features/storefront/server/product-media";
import { applyMigrations } from "./migrations";

describe("private R2 product media proxy", { timeout: 30_000 }, () => {
	let miniflare: Miniflare;
	let db: D1Database;
	let bucket: R2Bucket;

	beforeEach(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: crypto.randomUUID() },
			r2Buckets: { FILES: crypto.randomUUID() },
		});
		db = await miniflare.getD1Database("DB");
		bucket = (await miniflare.getR2Bucket("FILES")) as unknown as R2Bucket;
		await applyMigrations(db);
		await db.batch([
			db.prepare(
				`INSERT INTO products
				 (id, name, product_type, status, created_at, updated_at)
				 VALUES ('product', 'Card', 'stock', 'active', 1, 1)`,
			),
			db.prepare(
				`INSERT INTO product_media
				 (id, product_id, object_key, content_type, size_bytes, created_at, updated_at)
				 VALUES ('media', 'product', 'products/product/media/media.png',
				  'image/png', 4, 1, 1)`,
			),
		]);
		await bucket.put(
			"products/product/media/media.png",
			new Uint8Array([1, 2, 3, 4]),
			{
				httpMetadata: { contentType: "image/png" },
			},
		);
	});

	afterEach(async () => miniflare.dispose());

	it("serves only owned media for active products with safe headers", async () => {
		const response = await productMediaResponse(
			new Request("https://shop.example/api/shop/products/product/media/media"),
			"product",
			"media",
			db,
			bucket,
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("content-security-policy")).toContain(
			"sandbox",
		);
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(
			new Uint8Array([1, 2, 3, 4]),
		);
		await expect(
			productMediaResponse(
				new Request("https://shop.example"),
				"other-product",
				"media",
				db,
				bucket,
			),
		).resolves.toMatchObject({ status: 404 });
		await db
			.prepare(
				"UPDATE products SET status = 'trashed', trashed_at = ? WHERE id = 'product'",
			)
			.bind(Date.now())
			.run();
		await expect(
			productMediaResponse(
				new Request("https://shop.example"),
				"product",
				"media",
				db,
				bucket,
			),
		).resolves.toMatchObject({ status: 404 });
	});
});
