import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./migrations";

describe("GMShop D1 instance invariants", () => {
	let miniflare: Miniflare;
	let db: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-instance-invariants" },
		});
		db = await miniflare.getD1Database("DB");
		await applyMigrations(db);
	});

	afterAll(async () => miniflare.dispose());

	it("contains only the commerce order schema with scoped indexes", async () => {
		const columns = await db
			.prepare("PRAGMA table_info(shop_orders)")
			.all<{ name: string }>();
		expect(columns.results.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				"order_number",
				"idempotency_key",
				"total_minor",
				"expires_at",
			]),
		);
		const indexes = await db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'shop_orders'",
			)
			.all<{ name: string }>();
		expect(indexes.results.map((row) => row.name)).toEqual(
			expect.arrayContaining([
				"shop_orders_number_uidx",
				"shop_orders_idempotency_uidx",
				"shop_orders_status_expires_idx",
			]),
		);
		await expect(
			db.prepare("PRAGMA foreign_key_check").all(),
		).resolves.toMatchObject({
			results: [],
			success: true,
			meta: expect.any(Object),
		});
	});

	it("deduplicates public order numbers and idempotency keys", async () => {
		await insertOrder("order-a", "GM-1001", "idem-a");
		await expect(insertOrder("order-b", "GM-1001", "idem-b")).rejects.toThrow();
		await expect(insertOrder("order-d", "GM-1003", "idem-a")).rejects.toThrow();
	});

	it("deduplicates durable commerce outbox events instance-wide", async () => {
		await insertOutbox("outbox-a", "delivery:order-a");
		await expect(
			insertOutbox("outbox-b", "delivery:order-a"),
		).rejects.toThrow();
	});

	function insertOrder(
		id: string,
		orderNumber: string,
		idempotencyKey: string,
	) {
		return db
			.prepare(
				`INSERT INTO shop_orders
				 (id, order_number, idempotency_key, contact_email,
				  normalized_contact_email, currency, currency_decimals, subtotal_minor,
				  discount_minor, total_minor, paid_minor, expires_at, created_at, updated_at)
				 VALUES (?, ?, ?, 'buyer@example.com', 'buyer@example.com', 'USD', 2,
				  '100', '0', '100', '0', 60000, 1, 1)`,
			)
			.bind(id, orderNumber, idempotencyKey)
			.run();
	}

	function insertOutbox(id: string, idempotencyKey: string) {
		return db
			.prepare(
				`INSERT INTO outbox_events
				 (id, event_type, aggregate_type, aggregate_id, idempotency_key,
				  payload, status, created_at, updated_at)
				 VALUES (?, 'delivery.requested', 'shop_order', 'order-a', ?, '{}',
				  'pending', 1, 1)`,
			)
			.bind(id, idempotencyKey)
			.run();
	}
});
