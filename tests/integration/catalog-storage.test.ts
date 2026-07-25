import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fingerprintInventorySecret } from "#/features/catalog/server/inventory-secrets";
import { encryptSecret } from "#/lib/secrets";
import { applyMigrations } from "./migrations";

describe("catalog D1 storage contracts", { timeout: 30_000 }, () => {
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
		await seedCatalog(database);
	});

	afterEach(async () => miniflare.dispose());

	it("enforces integer money, scalar limits and protected product deletion", async () => {
		await expect(
			database
				.prepare(
					`INSERT INTO product_sellable_items
					 (id, product_id, name, currency, currency_decimals,
					  price_minor, minimum_quantity,
					  maximum_quantity, sort_order, enabled, created_at, updated_at)
					 VALUES ('bad-money', 'product-card', 'Bad',
					  'CNY', 2, '1.5', 1, 1, 100, 1, 1, 1)`,
				)
				.run(),
		).rejects.toThrow();
		await expect(
			database
				.prepare(
					`INSERT INTO product_sellable_items
					 (id, product_id, name, duration_ms, currency, currency_decimals,
					  price_minor, minimum_quantity, maximum_quantity,
					  sort_order, enabled, created_at, updated_at)
					 VALUES ('bad-duration', 'product-card', 'Bad duration', 0,
					  'CNY', 2, '100', 1, 1, 100, 1, 1, 1)`,
				)
				.run(),
		).rejects.toThrow();
		await expect(
			database.prepare("DELETE FROM products WHERE id = 'product-card'").run(),
		).rejects.toThrow();
	});

	it("stores only encrypted card contents and rejects duplicate sellable item fingerprints", async () => {
		const plaintext = "LICENSE-12345678";
		const encryptionKey = "catalog-storage-test-secret";
		const encrypted = await encryptSecret(plaintext, encryptionKey);
		const fingerprint = await fingerprintInventorySecret(
			plaintext,
			encryptionKey,
		);
		await database
			.prepare(
				`INSERT INTO stock_entries
				 (id, sellable_item_id, content_encrypted, key_version, content_fingerprint,
				  content_mask, status, created_at, updated_at)
				 VALUES (?, 'sellableItem-card', ?, 1, ?, '••••••••5678', 'available', 1, 1)`,
			)
			.bind("card-1", encrypted, fingerprint)
			.run();
		const stored = await database
			.prepare("SELECT * FROM stock_entries WHERE id = 'card-1'")
			.first<Record<string, unknown>>();
		expect(stored?.content_encrypted).not.toContain(plaintext);
		expect(stored?.content_fingerprint).not.toBe(plaintext);
		expect(stored?.content_mask).toBe("••••••••5678");
		await expect(
			database
				.prepare(
					`INSERT INTO stock_entries
					 (id, sellable_item_id, content_encrypted, key_version, content_fingerprint,
					  content_mask, status, created_at, updated_at)
					 VALUES ('card-2', 'sellableItem-card', ?, 1, ?, '••••••••5678', 'available', 2, 2)`,
				)
				.bind(encrypted, fingerprint)
				.run(),
		).rejects.toThrow();
	});
});

async function seedCatalog(database: D1Database) {
	await database.batch([
		database.prepare(
			`INSERT INTO products
			 (id, name, product_type, status, sort_order, created_at, updated_at)
			 VALUES ('product-card', 'Card', 'stock', 'active', 100, 1, 1)`,
		),
		database.prepare(
			`INSERT INTO product_sellable_items
			 (id, product_id, name, currency, currency_decimals,
			  price_minor, minimum_quantity, maximum_quantity,
			  sort_order, enabled, created_at, updated_at)
			 VALUES ('sellableItem-card', 'product-card', 'Default',
			  'CNY', 2, '1000', 1, 1, 100, 1, 1, 1)`,
		),
	]);
}
