import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listVisibleStoreEntitlements } from "#/features/storefront/server/account-entitlements";
import { applyMigrations } from "./migrations";

const DAY_MS = 86_400_000;
const NOW = 1_800_000_000_000;

describe("storefront account entitlement visibility", {
	timeout: 30_000,
}, () => {
	let miniflare: Miniflare;
	let database: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: crypto.randomUUID() },
		});
		database = await miniflare.getD1Database("DB");
		await applyMigrations(database);
		await seed(database);
	});

	afterAll(async () => miniflare.dispose());

	it("keeps expired entitlements for seven days and always hides exhausted ones", async () => {
		const entitlements = await listVisibleStoreEntitlements(
			database,
			"account-user",
			NOW,
		);

		expect(
			entitlements.results.map((entitlement) => entitlement.id).sort(),
		).toEqual(["active", "expired-boundary", "expired-recent"]);
	});
});

async function seed(database: D1Database) {
	await database.batch([
		database.prepare(
			`INSERT INTO users
			 (id, name, email, email_verified, role_ids, created_at, updated_at)
			 VALUES ('account-user', 'Buyer', 'buyer@example.com', 1, '[]', 1, 1)`,
		),
		database.prepare(
			`INSERT INTO products
			 (id, name, product_type, status, created_at, updated_at)
			 VALUES ('product', 'Product', 'download', 'active', 1, 1)`,
		),
		database.prepare(
			`INSERT INTO product_sellable_items
			 (id, product_id, name, price_minor, created_at, updated_at)
			 VALUES ('sellable', 'product', 'Plan', '100', 1, 1)`,
		),
		database
			.prepare(
				`INSERT INTO shop_orders
			 (id, order_number, user_id, status, currency, currency_decimals,
			  subtotal_minor, total_minor, expires_at, created_at, updated_at)
			 VALUES ('order', 'GMENTITLEMENTS', 'account-user', 'completed',
			  'USD', 2, '500', '500', ?, 1, 1)`,
			)
			.bind(NOW + DAY_MS),
		database.prepare(
			`INSERT INTO shop_order_items
			 (id, order_id, product_id, sellable_item_id, product_name,
			  delivery_component_id, delivery_component_type,
			  delivery_component_version, sellable_item_name, quantity,
			  unit_price_minor, subtotal_minor, created_at, updated_at)
			 VALUES
			  ('item-active', 'order', 'product', 'sellable', 'Product',
			   'sellable', 'download', 1, 'Plan', 1, '100', '100', 1, 1),
			  ('item-recent', 'order', 'product', 'sellable', 'Product',
			   'sellable', 'download', 1, 'Plan', 1, '100', '100', 2, 2),
			  ('item-boundary', 'order', 'product', 'sellable', 'Product',
			   'sellable', 'download', 1, 'Plan', 1, '100', '100', 3, 3),
			  ('item-stale', 'order', 'product', 'sellable', 'Product',
			   'sellable', 'download', 1, 'Plan', 1, '100', '100', 4, 4),
			  ('item-exhausted', 'order', 'product', 'sellable', 'Product',
			   'sellable', 'download', 1, 'Plan', 1, '100', '100', 5, 5)`,
		),
		database
			.prepare(
				`INSERT INTO customer_entitlements
				 (id, user_id, order_item_id, product_id, sellable_item_id,
				  delivery_component_id, entitlement_type, status, expires_at,
				  created_at, updated_at)
				 VALUES
				  ('active', 'account-user', 'item-active', 'product', 'sellable',
				   'sellable', 'download', 'active', NULL, 1, 1),
				  ('expired-recent', 'account-user', 'item-recent', 'product', 'sellable',
				   'sellable', 'download', 'expired', ?, 2, 2),
				  ('expired-boundary', 'account-user', 'item-boundary', 'product', 'sellable',
				   'sellable', 'download', 'expired', ?, 3, 3),
				  ('expired-stale', 'account-user', 'item-stale', 'product', 'sellable',
				   'sellable', 'download', 'expired', ?, 4, 4),
				  ('exhausted', 'account-user', 'item-exhausted', 'product', 'sellable',
				   'sellable', 'download', 'exhausted', NULL, 5, 5)`,
			)
			.bind(NOW - 6 * DAY_MS, NOW - 7 * DAY_MS, NOW - 7 * DAY_MS - 1),
	]);
}
