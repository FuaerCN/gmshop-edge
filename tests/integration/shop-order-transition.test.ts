import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { transitionShopOrder } from "#/features/shop-orders/server/transition";
import { applyMigrations } from "./migrations";

const orderId = "11111111-1111-4111-8111-111111111111";
const actorUserId = "22222222-2222-4222-8222-222222222222";

describe("atomic shop order transitions", { timeout: 30_000 }, () => {
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
		await database.batch([
			database.prepare(
				`INSERT INTO users
				 (id, name, email, email_verified, enabled, created_at, updated_at)
				 VALUES ('${actorUserId}', 'Admin', 'admin@example.com', 1, 1, 1, 1)`,
			),
			database.prepare(
				`INSERT INTO shop_orders
				 (id, order_number, contact_email, normalized_contact_email,
				  status, currency, currency_decimals, subtotal_minor, discount_minor,
				  total_minor, paid_minor, version, expires_at, created_at, updated_at)
				 VALUES ('${orderId}', 'GM10001', 'buyer@example.com',
				  'buyer@example.com', 'pending_payment', 'CNY', 2, '1200', '200',
				  '1000', '0', 1, 9999999999999, 1, 1)`,
			),
		]);
	});

	afterEach(async () => miniflare.dispose());

	it("changes status, money, event and outbox together", async () => {
		await expect(
			transitionShopOrder(database, {
				id: orderId,
				version: 1,
				toStatus: "paid",
				note: "manual confirmation",
				actorType: "admin",
				actorUserId,
			}),
		).resolves.toMatchObject({
			fromStatus: "pending_payment",
			toStatus: "paid",
			version: 2,
		});
		const state = await database
			.prepare(
				`SELECT status, version, paid_minor, paid_at,
				 (SELECT COUNT(*) FROM shop_order_events WHERE order_id = shop_orders.id
				  AND order_version = 2) AS events,
				 (SELECT COUNT(*) FROM outbox_events WHERE aggregate_id = shop_orders.id) AS outbox,
				 (SELECT COUNT(*) FROM audit_logs WHERE target_id = shop_orders.id) AS audits
				 FROM shop_orders WHERE id = ?`,
			)
			.bind(orderId)
			.first<Record<string, unknown>>();
		expect(state).toMatchObject({
			status: "paid",
			version: 2,
			paid_minor: "1000",
			events: 1,
			outbox: 1,
			audits: 1,
		});
		expect(Number(state?.paid_at)).toBeGreaterThan(0);
		await expect(
			transitionShopOrder(database, {
				id: orderId,
				version: 1,
				toStatus: "paid",
				note: null,
				actorType: "admin",
				actorUserId,
			}),
		).rejects.toMatchObject({ code: "order_version_conflict" });
	});

	it("allows only one concurrent transition from the same version", async () => {
		const attempts = await Promise.allSettled([
			transitionShopOrder(database, {
				id: orderId,
				version: 1,
				toStatus: "paid",
				note: null,
				actorType: "admin",
				actorUserId,
			}),
			transitionShopOrder(database, {
				id: orderId,
				version: 1,
				toStatus: "expired",
				note: null,
				actorType: "admin",
				actorUserId,
			}),
		]);
		expect(
			attempts.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			attempts.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		const counts = await database
			.prepare(
				`SELECT (SELECT COUNT(*) FROM shop_order_events) AS events,
				 (SELECT COUNT(*) FROM outbox_events) AS outbox,
				 (SELECT COUNT(*) FROM audit_logs) AS audits,
				 version FROM shop_orders WHERE id = ?`,
			)
			.bind(orderId)
			.first<Record<string, number>>();
		expect(counts).toEqual({ events: 1, outbox: 1, audits: 1, version: 2 });
	});
});
