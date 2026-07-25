import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prepareCustomerDataDeletion } from "#/features/customers/server/privacy";
import { applyMigrations } from "./migrations";

describe("customer privacy deletion", { timeout: 30_000 }, () => {
	let miniflare: Miniflare;
	let db: D1Database;
	const guestIdentityId = "order-privacy";

	beforeEach(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: crypto.randomUUID() },
		});
		db = await miniflare.getD1Database("DB");
		await applyMigrations(db);
		await db
			.prepare(
				`INSERT INTO shop_orders
				 (id, order_number, idempotency_key, user_id, contact_email,
				  normalized_contact_email, locale, status, currency,
				  currency_decimals, subtotal_minor, total_minor, expires_at,
				  created_at, updated_at)
				 VALUES (?, 'GM-PRIVACY-1', 'privacy-1', NULL,
				  'buyer@example.com', 'buyer@example.com', 'en-US',
				  'pending_payment', 'USD', 2, '100', '100', 999999, 1, 1)`,
			)
			.bind(guestIdentityId)
			.run();
	});

	afterEach(async () => miniflare.dispose());

	it("blocks guest deletion while commerce work is active", async () => {
		await expect(
			prepareCustomerDataDeletion(db, guestIdentityId, 10),
		).rejects.toMatchObject({ code: "customer_data_in_use", status: 409 });
	});

	it("atomically anonymizes retained guest order history", async () => {
		await db
			.prepare(
				"UPDATE shop_orders SET status = 'completed', completed_at = 2 WHERE id = ?",
			)
			.bind(guestIdentityId)
			.run();
		const deletion = await prepareCustomerDataDeletion(db, guestIdentityId, 10);
		await db.batch(deletion.statements);
		const order = await db
			.prepare("SELECT * FROM shop_orders WHERE id = ?")
			.bind(guestIdentityId)
			.first<Record<string, unknown>>();
		expect(deletion.customer).toEqual({
			userId: null,
			email: "buyer@example.com",
		});
		expect(order).toMatchObject({
			user_id: null,
			contact_email: `deleted+${guestIdentityId}@invalid.gmshop`,
			normalized_contact_email: `deleted+${guestIdentityId}@invalid.gmshop`,
			customer_note: null,
			status: "completed",
		});
	});
});
