import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consumeEntitlementAccess } from "#/features/entitlements/server/ledger";
import { applyMigrations } from "./migrations";

describe("unified entitlement event ledger", () => {
	let miniflare: Miniflare;
	let db: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-entitlement-events" },
		});
		db = await miniflare.getD1Database("DB");
		await applyMigrations(db);
		await seedEntitlement(db);
	});

	afterAll(async () => miniflare.dispose());

	it("stores usage and access semantics in one immutable ledger", async () => {
		await db.batch([
			db.prepare(
				`INSERT INTO entitlement_events
				 (id, kind, entitlement_id, event_type, amount, source_type, source_id,
				  idempotency_key, created_at)
				 VALUES ('usage', 'usage', 'entitlement', 'consumed', 1,
				  'automation_job', 'job', 'usage:job', 10)`,
			),
			db.prepare(
				`INSERT INTO entitlement_events
				 (id, kind, entitlement_id, event_type, asset_type, asset_id, consumed,
				  actor_type, request_id, ip_address, created_at)
				 VALUES ('access', 'access', 'entitlement', 'downloaded',
				  'download_asset', 'asset', 1, 'customer', 'request', '192.0.2.1', 20)`,
			),
		]);
		const rows = await db
			.prepare(
				`SELECT kind, event_type, amount, source_type, asset_type, consumed,
				 actor_type, request_id, ip_address
				 FROM entitlement_events ORDER BY created_at, id`,
			)
			.all<Record<string, unknown>>();
		expect(rows.results).toEqual([
			{
				kind: "usage",
				event_type: "consumed",
				amount: 1,
				source_type: "automation_job",
				asset_type: null,
				consumed: null,
				actor_type: null,
				request_id: null,
				ip_address: null,
			},
			{
				kind: "access",
				event_type: "downloaded",
				amount: null,
				source_type: null,
				asset_type: "download_asset",
				consumed: 1,
				actor_type: "customer",
				request_id: "request",
				ip_address: "192.0.2.1",
			},
		]);
	});

	it("keeps access consumption atomic and idempotent under contention", async () => {
		await db
			.prepare(
				`UPDATE customer_entitlements SET status = 'active',
				 access_limit = 3, access_count = 0 WHERE id = 'entitlement'`,
			)
			.run();
		const attempts = await Promise.allSettled(
			Array.from({ length: 4 }, (_, index) =>
				consumeEntitlementAccess(db, {
					entitlementId: "entitlement",
					assetType: "download_asset",
					assetId: `parallel-${index}`,
					eventType: "downloaded",
					actorType: "customer",
					idempotencyKey: `parallel:${index}`,
				}),
			),
		);
		expect(
			attempts.filter((result) => result.status === "fulfilled"),
		).toHaveLength(3);
		await expect(
			consumeEntitlementAccess(db, {
				entitlementId: "entitlement",
				assetType: "download_asset",
				assetId: "parallel-0",
				eventType: "downloaded",
				actorType: "customer",
				idempotencyKey: "parallel:0",
			}),
		).resolves.toBeUndefined();
		const state = await db
			.prepare(
				`SELECT access_count,
				 (SELECT COUNT(*) FROM entitlement_events
				  WHERE kind = 'access' AND asset_id LIKE 'parallel-%') AS events
				 FROM customer_entitlements WHERE id = 'entitlement'`,
			)
			.first<{ access_count: number; events: number }>();
		expect(state).toEqual({ access_count: 3, events: 3 });
	});

	it("rejects cross-kind shapes and duplicate idempotency keys", async () => {
		await expect(
			db
				.prepare(
					`INSERT INTO entitlement_events
					 (id, kind, entitlement_id, event_type, amount, source_type, source_id,
					  asset_type, asset_id, consumed, actor_type, idempotency_key, created_at)
					 VALUES ('mixed', 'usage', 'entitlement', 'consumed', 1, 'job', 'job',
					  'download_asset', 'asset', 1, 'system', 'mixed', 30)`,
				)
				.run(),
		).rejects.toThrow();
		await expect(
			db
				.prepare(
					`INSERT INTO entitlement_events
					 (id, kind, entitlement_id, event_type, amount, source_type, source_id,
					  idempotency_key, created_at)
					 VALUES ('duplicate', 'usage', 'entitlement', 'restored', 1,
					  'automation_job', 'job', 'usage:job', 40)`,
				)
				.run(),
		).rejects.toThrow();
	});

	it("keeps entitlement timelines and kind scans indexed", async () => {
		const [entitlementPlan, kindPlan] = await Promise.all([
			queryPlan(
				db,
				`SELECT id FROM entitlement_events
				 WHERE entitlement_id = ? ORDER BY created_at, id LIMIT 100`,
				"entitlement",
			),
			queryPlan(
				db,
				`SELECT id FROM entitlement_events
				 WHERE kind = ? ORDER BY created_at, id LIMIT 100`,
				"usage",
			),
		]);
		expect(entitlementPlan).toContain(
			"entitlement_events_entitlement_created_idx",
		);
		expect(kindPlan).toContain("entitlement_events_kind_created_idx");
	});
});

async function queryPlan(db: D1Database, sql: string, binding: string) {
	const result = await db
		.prepare(`EXPLAIN QUERY PLAN ${sql}`)
		.bind(binding)
		.all<{ detail: string }>();
	return result.results.map((row) => row.detail).join(" ");
}

async function seedEntitlement(db: D1Database) {
	await db.batch([
		db.prepare(
			`INSERT INTO products
			 (id, name, product_type, status, created_at, updated_at)
			 VALUES ('product', 'Product', 'download', 'active', 1, 1)`,
		),
		db.prepare(
			`INSERT INTO product_sellable_items
			 (id, product_id, name, access_limit, currency, price_minor, created_at, updated_at)
			 VALUES ('sellable', 'product', 'Plan', 10, 'USD', '100', 1, 1)`,
		),
		db.prepare(
			`INSERT INTO users
			 (id, name, email, email_verified, created_at, updated_at)
			 VALUES ('customer', 'Customer', 'customer@example.com', 1, 1, 1)`,
		),
		db.prepare(
			`INSERT INTO shop_orders
			 (id, order_number, user_id, contact_email,
			  normalized_contact_email, status, currency, currency_decimals,
			  subtotal_minor, total_minor, paid_minor, expires_at, created_at, updated_at)
			 VALUES ('order', 'ORDER', 'customer', 'customer@example.com',
			  'customer@example.com', 'paid', 'USD', 2, '100', '100', '100', 999999, 1, 1)`,
		),
		db.prepare(
			`INSERT INTO shop_order_items
			 (id, order_id, product_id, sellable_item_id, product_name,
			  delivery_component_id, delivery_component_type, delivery_component_version,
			  sellable_item_name, quantity, unit_price_minor, subtotal_minor,
			  access_limit, created_at, updated_at)
			 VALUES ('item', 'order', 'product', 'sellable', 'Product', 'sellable',
			  'download', 1, 'Plan', 1, '100', '100', 10, 1, 1)`,
		),
		db.prepare(
			`INSERT INTO customer_entitlements
			 (id, user_id, order_item_id, product_id, sellable_item_id,
			  delivery_component_id, entitlement_type, status, access_limit,
			  created_at, updated_at)
			 VALUES ('entitlement', 'customer', 'item', 'product', 'sellable',
			  'sellable', 'download', 'active', 10, 1, 1)`,
		),
	]);
}
