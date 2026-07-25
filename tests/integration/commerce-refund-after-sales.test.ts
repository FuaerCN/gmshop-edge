import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	openAfterSaleCase,
	updateAfterSaleCase,
} from "#/features/shop-orders/server/after-sales";
import {
	completeManualShopRefund,
	processShopRefund,
	publishPendingRefunds,
	requestShopRefund,
} from "#/features/shop-payments/server/refunds";
import { encryptSecret } from "#/lib/secrets";
import type { RefundQueueMessage } from "#/server/queue/types";
import { applyMigrations } from "./migrations";

const ids = {
	admin: "00000000-0000-4000-8000-000000000001",
	user: "00000000-0000-4000-8000-000000000002",
	order: "00000000-0000-4000-8000-000000000004",
	item: "00000000-0000-4000-8000-000000000005",
	channel: "00000000-0000-4000-8000-000000000006",
	attempt: "00000000-0000-4000-8000-000000000007",
} as const;

describe("commerce refunds and after-sale cases", { timeout: 30_000 }, () => {
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
		await seed(db);
	});

	afterEach(async () => miniflare.dispose());

	it("reserves refundable balance once under concurrent requests", async () => {
		const results = await Promise.allSettled([
			requestShopRefund(
				db,
				{
					orderId: ids.order,
					amountMinor: "700",
					reason: "First concurrent request",
					idempotencyKey: "refund-concurrent-first",
				},
				{ actorUserId: ids.admin, request: testRequest() },
			),
			requestShopRefund(
				db,
				{
					orderId: ids.order,
					amountMinor: "700",
					reason: "Second concurrent request",
					idempotencyKey: "refund-concurrent-second",
				},
				{ actorUserId: ids.admin, request: testRequest() },
			),
		]);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		const state = await db
			.prepare(
				`SELECT
				 (SELECT COUNT(*) FROM refunds) AS refunds,
				 (SELECT COALESCE(SUM(CAST(amount_minor AS INTEGER)), 0)
				  FROM refunds) AS reserved_minor,
				 (SELECT COUNT(*) FROM outbox_events
				  WHERE event_type = 'refund.requested') AS outbox,
				 (SELECT COUNT(*) FROM audit_logs
				  WHERE action = 'refund.requested') AS audits`,
			)
			.first<Record<string, number>>();
		expect(state).toEqual({
			refunds: 1,
			reserved_minor: 700,
			outbox: 1,
			audits: 1,
		});
	});

	it("processes partial and full refunds through durable idempotent outbox jobs", async () => {
		let refundSequence = 0;
		const refundFetcher = vi.fn(async () =>
			Response.json({
				id: `re_test_${++refundSequence}`,
				status: "succeeded",
				failure_reason: null,
			}),
		);
		const first = await requestShopRefund(
			db,
			{
				orderId: ids.order,
				amountMinor: "400",
				reason: "Customer request",
				idempotencyKey: "refund-first-request",
			},
			{ actorUserId: ids.admin, request: testRequest() },
		);
		await expect(
			requestShopRefund(
				db,
				{
					orderId: ids.order,
					amountMinor: "400",
					reason: "Customer request",
					idempotencyKey: "refund-first-request",
				},
				{ actorUserId: ids.admin, request: testRequest() },
			),
		).resolves.toMatchObject({ id: first.id, duplicate: true });
		const queued: RefundQueueMessage[] = [];
		const queue = {
			sendBatch: vi.fn(
				async (messages: Array<{ body: RefundQueueMessage }>) => {
					queued.push(...messages.map(({ body }) => body));
				},
			),
		} as unknown as Queue<RefundQueueMessage>;
		await expect(publishPendingRefunds(db, queue)).resolves.toEqual({
			published: 1,
		});
		expect(queued[0]).toEqual({
			kind: "commerce.refund",
			version: 1,
			refundId: first.id,
		});
		await expect(
			processShopRefund(db, first.id, refundFetcher),
		).resolves.toMatchObject({
			status: "succeeded",
			duplicate: false,
		});
		let order = await orderState(db);
		expect(order).toMatchObject({ status: "completed", version: 3 });

		const second = await requestShopRefund(
			db,
			{
				orderId: ids.order,
				amountMinor: "600",
				reason: "Refund remaining balance",
				idempotencyKey: "refund-second-request",
			},
			{ actorUserId: ids.admin, request: testRequest() },
		);
		await expect(
			processShopRefund(db, second.id, refundFetcher),
		).resolves.toMatchObject({
			status: "succeeded",
		});
		order = await orderState(db);
		expect(order).toMatchObject({ status: "refunded", version: 5 });
		const state = await db
			.prepare(
				`SELECT
				 (SELECT COUNT(*) FROM refunds WHERE status = 'succeeded') AS refunds,
				 (SELECT COUNT(*) FROM outbox_events WHERE event_type = 'refund.succeeded') AS events,
				 (SELECT COUNT(*) FROM audit_logs WHERE action = 'refund.processed') AS audits,
				 (SELECT status FROM stock_entries WHERE id = 'stock-refund') AS stock_status,
				 (SELECT order_item_id FROM stock_entries
				  WHERE id = 'stock-refund') AS stock_order_item_id`,
			)
			.first<Record<string, unknown>>();
		expect(state).toMatchObject({
			refunds: 2,
			events: 2,
			audits: 2,
			stock_status: "delivered",
			stock_order_item_id: ids.item,
		});
	});

	it("refunds the provider currency with the immutable payment rate snapshot", async () => {
		await db.batch([
			db
				.prepare(
					"UPDATE shop_orders SET currency = 'CNY', currency_decimals = 2 WHERE id = ?",
				)
				.bind(ids.order),
			db
				.prepare(
					`UPDATE payment_attempts SET amount_minor = '140', currency = 'USD',
					 currency_decimals = 2, exchange_rate = '0.14',
					 exchange_rate_direction = 'multiply', exchange_rate_source = 'manual'
					 WHERE id = ?`,
				)
				.bind(ids.attempt),
		]);
		const providerAmounts: string[] = [];
		const fetcher = vi.fn(
			async (_url: RequestInfo | URL, init?: RequestInit) => {
				providerAmounts.push(
					new URLSearchParams(String(init?.body ?? "")).get("amount") ?? "",
				);
				return Response.json({
					id: `re_rate_${providerAmounts.length}`,
					status: "succeeded",
					failure_reason: null,
				});
			},
		);
		const first = await requestShopRefund(
			db,
			{
				orderId: ids.order,
				amountMinor: "400",
				reason: "Partial cross-currency refund",
				idempotencyKey: "refund-rate-snapshot-first",
			},
			{ actorUserId: ids.admin, request: testRequest() },
		);
		await processShopRefund(db, first.id, fetcher);

		// A later rate change must not alter either the remaining provider balance
		// or the amount sent for the final refund.
		await db
			.prepare(
				`INSERT INTO exchange_rates
				 (id, base_currency, quote_currency, raw_rate, rate, source,
				  adjustment_bps, sort_order, observed_at, created_at, updated_at)
				 VALUES (?, 'CNY', 'USD', '9.99', '9.99', 'new-market-rate',
				  0, 100, 2, 2, 2)`,
			)
			.bind(crypto.randomUUID())
			.run();
		const second = await requestShopRefund(
			db,
			{
				orderId: ids.order,
				amountMinor: "600",
				reason: "Remaining cross-currency refund",
				idempotencyKey: "refund-rate-snapshot-second",
			},
			{ actorUserId: ids.admin, request: testRequest() },
		);
		await processShopRefund(db, second.id, fetcher);

		expect(providerAmounts).toEqual(["56", "84"]);
		const refunds = await db
			.prepare(
				`SELECT amount_minor, currency, payment_amount_minor, payment_currency
				 FROM refunds ORDER BY created_at, id`,
			)
			.all<Record<string, unknown>>();
		expect(refunds.results).toEqual([
			expect.objectContaining({
				amount_minor: "400",
				currency: "CNY",
				payment_amount_minor: "56",
				payment_currency: "USD",
			}),
			expect.objectContaining({
				amount_minor: "600",
				currency: "CNY",
				payment_amount_minor: "84",
				payment_currency: "USD",
			}),
		]);
	});

	it("keeps GMPay and EPay refunds manual until an administrator confirms the external transfer", async () => {
		await db
			.prepare("UPDATE payment_channels SET provider = 'gmpay' WHERE id = ?")
			.bind(ids.channel)
			.run();
		const refund = await requestShopRefund(
			db,
			{
				orderId: ids.order,
				amountMinor: "1000",
				reason: "External provider refund",
				idempotencyKey: "manual-refund-request",
			},
			{ actorUserId: ids.admin, request: testRequest() },
		);
		expect(refund).toMatchObject({
			status: "processing",
			manualActionRequired: true,
		});
		const pending = await db
			.prepare(
				`SELECT status, failure_code,
				 (SELECT COUNT(*) FROM outbox_events WHERE event_type = 'refund.requested') AS queued
				 FROM refunds WHERE id = ?`,
			)
			.bind(refund.id)
			.first<Record<string, unknown>>();
		expect(pending).toMatchObject({
			status: "processing",
			failure_code: "manual_action_required",
			queued: 0,
		});
		await expect(
			completeManualShopRefund(db, refund.id, "EPUSDT-REFUND-42", {
				actorUserId: ids.admin,
				request: testRequest(),
			}),
		).resolves.toMatchObject({ status: "succeeded", duplicate: false });
		await expect(
			completeManualShopRefund(db, refund.id, "EPUSDT-REFUND-42", {
				actorUserId: ids.admin,
				request: testRequest(),
			}),
		).resolves.toMatchObject({ status: "succeeded", duplicate: true });
		const completed = await db
			.prepare(
				`SELECT r.status, r.provider_refund_id, o.status AS order_status,
				 (SELECT COUNT(*) FROM audit_logs WHERE action = 'refund.manual_completed') AS audits
				 FROM refunds r JOIN shop_orders o ON o.id = r.order_id WHERE r.id = ?`,
			)
			.bind(refund.id)
			.first<Record<string, unknown>>();
		expect(completed).toMatchObject({
			status: "succeeded",
			provider_refund_id: "manual:EPUSDT-REFUND-42",
			order_status: "refunded",
			audits: 1,
		});
	});

	it("enforces ownership, duplicate protection, and after-sale transitions", async () => {
		const opened = await openAfterSaleCase(
			db,
			{
				orderId: ids.order,
				orderItemId: ids.item,
				type: "redelivery",
				reason: "The delivered credential does not work",
			},
			{
				userId: ids.user,
				actorUserId: ids.user,
				request: testRequest(),
			},
		);
		await expect(
			openAfterSaleCase(
				db,
				{
					orderId: ids.order,
					orderItemId: ids.item,
					type: "redelivery",
					reason: "Duplicate active request",
				},
				{
					userId: ids.user,
					actorUserId: ids.user,
					request: testRequest(),
				},
			),
		).rejects.toMatchObject({ code: "after_sale_case_exists" });
		await expect(
			updateAfterSaleCase(
				db,
				{
					id: opened.id,
					status: "processing",
					resolution: "",
					note: "Reviewing",
				},
				{ actorUserId: ids.admin, request: testRequest() },
			),
		).resolves.toMatchObject({ status: "processing" });
		await expect(
			updateAfterSaleCase(
				db,
				{
					id: opened.id,
					status: "resolved",
					resolution: "A replacement was delivered",
					note: "Verified",
				},
				{ actorUserId: ids.admin, request: testRequest() },
			),
		).resolves.toMatchObject({ status: "resolved" });
		const state = await db
			.prepare(
				`SELECT c.status, c.resolution,
				 (SELECT COUNT(*) FROM shop_order_events
				  WHERE after_sale_case_id = c.id) AS records,
				 (SELECT COUNT(*) FROM outbox_events WHERE aggregate_id = c.id) AS events
				 FROM after_sale_cases c WHERE c.id = ?`,
			)
			.bind(opened.id)
			.first<Record<string, unknown>>();
		expect(state).toMatchObject({
			status: "resolved",
			resolution: "A replacement was delivered",
			records: 3,
			events: 3,
		});
	});
});

async function seed(db: D1Database) {
	const credential = await encryptSecret(
		JSON.stringify({
			secretKey: "sk_test_refund",
			webhookSecret: "whsec_test_refund",
		}),
		"commerce-test-secret",
		"payment-credential",
	);
	await db.batch([
		db.prepare(
			`INSERT INTO system_settings (key, value, is_secret, created_at, updated_at)
			 VALUES ('runtime.data_encryption_secret', '"commerce-test-secret"', 1, 1, 1)`,
		),
		db
			.prepare(
				`INSERT INTO users
			 (id, name, email, email_verified, enabled, created_at, updated_at)
			 VALUES (?, 'Admin', 'admin@example.com', 1, 1, 1, 1),
			 (?, 'Buyer', 'buyer@example.com', 1, 1, 1, 1)`,
			)
			.bind(ids.admin, ids.user),
		db
			.prepare(
				`INSERT INTO payment_channels
			 (id, provider, name, currency, credential_encrypted, credential_key_version,
			  enabled, created_at, updated_at) VALUES (?, 'stripe', 'Stripe', 'USD', ?, 1, 1, 1, 1)`,
			)
			.bind(ids.channel, credential),
		db.prepare(
			`INSERT INTO products
			 (id, name, description, product_type, status, created_at, updated_at)
			 VALUES ('product-refund', 'Credential', NULL, 'stock', 'active', 1, 1)`,
		),
		db.prepare(
			`INSERT INTO product_sellable_items
			 (id, product_id, name, price_minor, created_at, updated_at)
			 VALUES ('sellable-refund', 'product-refund', 'Default', '1000', 1, 1)`,
		),
		db
			.prepare(
				`INSERT INTO shop_orders
			 (id, order_number, user_id, contact_email,
			  normalized_contact_email, status, currency, currency_decimals,
			  subtotal_minor, discount_minor, total_minor, paid_minor, version,
			  expires_at, paid_at, completed_at, created_at, updated_at)
			 VALUES (?, 'ORDER-REFUND-1', ?, 'buyer@example.com',
			  'buyer@example.com', 'completed', 'USD', 2, '1000', '0', '1000',
			  '1000', 1, 999999, 1, 1, 1, 1)`,
			)
			.bind(ids.order, ids.user),
		db
			.prepare(
				`INSERT INTO shop_order_items
			 (id, order_id, product_id, sellable_item_id, delivery_component_id,
			  product_name, delivery_component_type, delivery_component_version, sellable_item_name,
			  quantity, unit_price_minor, discount_minor, subtotal_minor,
			  created_at, updated_at)
			 VALUES (?, ?, 'product-refund', 'sellable-refund', 'sellable-refund',
			  'Credential', 'stock', 1, 'Default',
			  1, '1000', '0', '1000', 1, 1)`,
			)
			.bind(ids.item, ids.order),
		db
			.prepare(
				`INSERT INTO payment_attempts
			 (id, order_id, channel_id, idempotency_key, provider_payment_id, status,
			  amount_minor, currency, succeeded_at, created_at, updated_at)
				 VALUES (?, ?, ?, 'payment-attempt-1', 'pi_test_1', 'succeeded',
			  '1000', 'USD', 1, 1, 1)`,
			)
			.bind(ids.attempt, ids.order, ids.channel),
		db
			.prepare(
				`INSERT INTO stock_entries
				 (id, sellable_item_id, content_encrypted, key_version,
				  content_fingerprint, content_mask, status, order_item_id,
				  reserved_at, delivered_at, created_at, updated_at)
				 VALUES ('stock-refund', 'sellable-refund', ?, 1,
				  'stock-refund-fingerprint', '••••1234', 'delivered', ?,
				  1, 1, 1, 1)`,
			)
			.bind("encrypted-stock-content", ids.item),
	]);
}

function orderState(db: D1Database) {
	return db
		.prepare(
			"SELECT status, version, refunded_at FROM shop_orders WHERE id = ?",
		)
		.bind(ids.order)
		.first<Record<string, unknown>>();
}

function testRequest() {
	return new Request("https://shop.example/admin/orders", {
		headers: { "x-request-id": crypto.randomUUID() },
	});
}
