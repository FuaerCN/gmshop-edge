import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	activateEntitlementGrantStatements,
	consumeEntitlementAccess,
	createEntitlementGrantStatements,
	refundEntitlementGrantStatements,
} from "#/features/entitlements/server/ledger";
import { loadRenewableEntitlement } from "#/features/storefront/server/entitlement-renewal";
import { applyMigrations } from "./migrations";

describe("entitlement grant ledger", { timeout: 30_000 }, () => {
	let miniflare: Miniflare;
	let database: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-entitlement-ledger" },
		});
		database = await miniflare.getD1Database("DB");
		await applyMigrations(database);
		await seed(database);
	});

	afterAll(async () => miniflare.dispose());

	it("activates, limits concurrent access, stacks renewal, and rebuilds after refund", async () => {
		const day = 86_400_000;
		const activatedAt = 1_800_000_000_000;
		const first = createEntitlementGrantStatements(
			database,
			"order-ledger-1",
			{
				id: "item-ledger-1",
				sellable_item_id: "sellableItem-ledger",
				product_id: "product-ledger",
				delivery_component_id: "sellableItem-ledger",
				delivery_component_type: "download",
				quantity: 1,
				duration_ms: 30 * day,
				usage_limit: null,
				access_limit: 3,
				renewed_from_entitlement_id: null,
				renewal_mode: "stack",
				definition_version_id: null,
			},
			activatedAt,
		);
		await database.batch([
			...first.statements,
			...activateEntitlementGrantStatements(
				database,
				"item-ledger-1",
				activatedAt,
			),
		]);
		await expect(
			loadRenewableEntitlement(
				database,
				"customer-ledger",
				first.entitlementId,
			),
		).resolves.toMatchObject({
			sellable_item_id: "sellableItem-ledger",
			price_minor: "100",
		});
		await database
			.prepare(
				"UPDATE customer_entitlements SET status = 'revoked' WHERE id = ?",
			)
			.bind(first.entitlementId)
			.run();
		await expect(
			loadRenewableEntitlement(
				database,
				"customer-ledger",
				first.entitlementId,
			),
		).resolves.toBeNull();
		await database
			.prepare(
				"UPDATE customer_entitlements SET status = 'active' WHERE id = ?",
			)
			.bind(first.entitlementId)
			.run();

		const attempts = await Promise.allSettled(
			Array.from({ length: 4 }, (_, index) =>
				consumeEntitlementAccess(database, {
					entitlementId: first.entitlementId,
					assetType: "download_asset",
					assetId: `asset-${index}`,
					eventType: "downloaded",
					actorType: "customer",
				}),
			),
		);
		expect(
			attempts.filter((result) => result.status === "fulfilled"),
		).toHaveLength(3);
		expect(await entitlementState(database, first.entitlementId)).toMatchObject(
			{
				status: "exhausted",
				access_count: 3,
			},
		);

		const renewal = createEntitlementGrantStatements(
			database,
			"order-ledger-2",
			{
				id: "item-ledger-2",
				sellable_item_id: "sellableItem-ledger",
				product_id: "product-ledger",
				delivery_component_id: "sellableItem-ledger",
				delivery_component_type: "download",
				quantity: 1,
				duration_ms: 30 * day,
				usage_limit: null,
				access_limit: 3,
				renewed_from_entitlement_id: first.entitlementId,
				renewal_mode: "stack",
				definition_version_id: null,
			},
			activatedAt + day,
		);
		await database.batch([
			...renewal.statements,
			...activateEntitlementGrantStatements(
				database,
				"item-ledger-2",
				activatedAt + day,
			),
		]);
		expect(await entitlementState(database, first.entitlementId)).toMatchObject(
			{
				usage_limit: null,
				access_limit: 6,
				access_count: 3,
				expires_at: activatedAt + 60 * day,
			},
		);

		await database.batch(
			await refundEntitlementGrantStatements(
				database,
				"order-ledger-2",
				activatedAt + 2 * day,
			),
		);
		expect(await entitlementState(database, first.entitlementId)).toMatchObject(
			{
				status: "exhausted",
				usage_limit: null,
				access_limit: 3,
				access_count: 3,
				expires_at: activatedAt + 30 * day,
			},
		);
	});

	it("keeps unfulfilled grants pending and still counts unlimited access", async () => {
		const activatedAt = 1_900_000_000_000;
		const grant = createEntitlementGrantStatements(
			database,
			"order-ledger-3",
			{
				id: "item-ledger-3",
				sellable_item_id: "sellableItem-ledger",
				product_id: "product-ledger",
				delivery_component_id: "sellableItem-ledger",
				delivery_component_type: "download",
				quantity: 1,
				duration_ms: null,
				usage_limit: null,
				access_limit: null,
				renewed_from_entitlement_id: null,
				renewal_mode: "stack",
				definition_version_id: null,
			},
			activatedAt,
		);
		await database.batch(grant.statements);
		expect(await entitlementState(database, grant.entitlementId)).toMatchObject(
			{
				status: "pending",
				activated_at: null,
				expires_at: null,
			},
		);

		await database.batch(
			activateEntitlementGrantStatements(
				database,
				"item-ledger-3",
				activatedAt,
			),
		);
		await consumeEntitlementAccess(database, {
			entitlementId: grant.entitlementId,
			assetType: "download_asset",
			assetId: "asset-unlimited",
			eventType: "downloaded",
			actorType: "customer",
		});
		await consumeEntitlementAccess(database, {
			entitlementId: grant.entitlementId,
			assetType: "download_asset",
			assetId: "asset-unlimited",
			eventType: "downloaded",
			actorType: "customer",
		});
		expect(await entitlementState(database, grant.entitlementId)).toMatchObject(
			{
				status: "active",
				usage_limit: null,
				access_limit: null,
				access_count: 2,
				activated_at: activatedAt,
				expires_at: null,
			},
		);
		await database
			.prepare(
				"UPDATE customer_entitlements SET status = 'exhausted' WHERE id = ?",
			)
			.bind(grant.entitlementId)
			.run();
		await consumeEntitlementAccess(database, {
			entitlementId: grant.entitlementId,
			assetType: "automation_artifact",
			assetId: "artifact-after-usage-exhaustion",
			eventType: "downloaded",
			actorType: "customer",
		});
		expect(await entitlementState(database, grant.entitlementId)).toMatchObject(
			{
				status: "exhausted",
				access_limit: null,
				access_count: 3,
			},
		);
	});
});

function entitlementState(database: D1Database, id: string) {
	return database
		.prepare(
			`SELECT status, usage_limit, usage_count, access_limit, access_count,
			 activated_at, expires_at FROM customer_entitlements WHERE id = ?`,
		)
		.bind(id)
		.first<Record<string, number | string | null>>();
}

async function seed(database: D1Database) {
	await database.batch([
		database.prepare(
			`INSERT INTO products
			 (id, name, product_type, status, created_at, updated_at)
			 VALUES ('product-ledger', 'Ledger product', 'download', 'active', 1, 1)`,
		),
		database.prepare(
			`INSERT INTO product_sellable_items
			 (id, product_id, name, duration_ms, access_limit,
			  currency, price_minor, created_at, updated_at)
			 VALUES ('sellableItem-ledger', 'product-ledger', 'Plan', 2592000000, 3,
			  'CNY', '100', 1, 1)`,
		),
		database.prepare(
			`INSERT INTO users
			 (id, name, email, email_verified, created_at, updated_at)
			 VALUES ('customer-ledger', 'Ledger customer', 'ledger@example.com',
			  1, 1, 1)`,
		),
		...orderStatements(database, "1", null),
		...orderStatements(database, "2", "pending-renewal"),
		...unlimitedOrderStatements(database),
	]);
}

function unlimitedOrderStatements(database: D1Database) {
	return [
		database.prepare(
			`INSERT INTO shop_orders
			 (id, order_number, user_id, contact_email,
			  normalized_contact_email, status, currency, currency_decimals,
			  subtotal_minor, discount_minor, total_minor, paid_minor, version,
			  expires_at, paid_at, created_at, updated_at)
			 VALUES ('order-ledger-3', 'LEDGER3', 'customer-ledger',
			  'ledger@example.com', 'ledger@example.com', 'paid', 'CNY', 2,
			  '100', '0', '100', '100', 2, 9999999999999, 1, 1, 1)`,
		),
		database.prepare(
			`INSERT INTO shop_order_items
			 (id, order_id, product_id, sellable_item_id, product_name,
			  delivery_component_id, delivery_component_type, delivery_component_version,
			  sellable_item_name, quantity,
			  unit_price_minor, discount_minor, subtotal_minor, created_at, updated_at)
			 VALUES ('item-ledger-3', 'order-ledger-3', 'product-ledger', 'sellableItem-ledger',
			  'Ledger product', 'sellableItem-ledger', 'download', 1, 'Plan',
			  1, '100', '0', '100', 1, 1)`,
		),
	];
}

function orderStatements(
	database: D1Database,
	suffix: string,
	renewedFromEntitlementId: string | null,
) {
	return [
		database.prepare(
			`INSERT INTO shop_orders
			 (id, order_number, user_id, contact_email,
			  normalized_contact_email, status, currency, currency_decimals,
			  subtotal_minor, discount_minor, total_minor, paid_minor, version,
			  expires_at, paid_at, created_at, updated_at)
			 VALUES ('order-ledger-${suffix}', 'LEDGER${suffix}',
			  'customer-ledger', 'ledger@example.com', 'ledger@example.com', 'paid',
			  'CNY', 2, '100', '0', '100', '100', 2, 9999999999999, 1, 1, 1)`,
		),
		database
			.prepare(
				`INSERT INTO shop_order_items
				 (id, order_id, product_id, sellable_item_id, product_name,
				  delivery_component_id, delivery_component_type, delivery_component_version,
				  sellable_item_name, quantity,
				  unit_price_minor, discount_minor, subtotal_minor,
				  renewed_from_entitlement_id, duration_ms, usage_limit, access_limit,
				  created_at, updated_at)
				 VALUES ('item-ledger-${suffix}', 'order-ledger-${suffix}', 'product-ledger',
				  'sellableItem-ledger', 'Ledger product', 'sellableItem-ledger', 'download', 1, 'Plan',
				  1, '100', '0', '100', ?, 2592000000, NULL, 3, 1, 1)`,
			)
			.bind(renewedFromEntitlementId),
	];
}
