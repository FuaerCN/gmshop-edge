import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "./migrations";

describe("customer commerce summaries", { timeout: 30_000 }, () => {
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
		await database
			.prepare(
				`INSERT INTO users
				 (id, name, email, email_verified, created_at, updated_at)
				 VALUES ('customer-1', 'Buyer', 'Buyer@Example.com', 1, 1, 1)`,
			)
			.run();
	});

	afterEach(async () => miniflare.dispose());

	it("derives multi-currency spending directly from authoritative orders", async () => {
		await database.batch([
			orderStatement(database, "order-cny-1", "CNY", "12000"),
			orderStatement(database, "order-cny-2", "CNY", "500"),
			orderStatement(database, "order-usd", "USD", "2999"),
		]);

		const rows = await database
			.prepare(
				`SELECT currency, currency_decimals,
				 CAST(SUM(CAST(paid_minor AS INTEGER)) AS TEXT) AS spent_minor,
				 COUNT(*) AS order_count
				 FROM shop_orders WHERE user_id = 'customer-1'
				 GROUP BY currency, currency_decimals ORDER BY currency`,
			)
			.all<{
				currency: string;
				currency_decimals: number;
				spent_minor: string;
				order_count: number;
			}>();

		expect(rows.results).toEqual([
			{
				currency: "CNY",
				currency_decimals: 2,
				spent_minor: "12500",
				order_count: 2,
			},
			{
				currency: "USD",
				currency_decimals: 2,
				spent_minor: "2999",
				order_count: 1,
			},
		]);
	});

	it("does not maintain a duplicate customer balance table", async () => {
		const table = await database
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'customer_balances'",
			)
			.first();
		expect(table).toBeNull();
	});
});

function orderStatement(
	database: D1Database,
	id: string,
	currency: string,
	paidMinor: string,
) {
	return database
		.prepare(
			`INSERT INTO shop_orders
			 (id, order_number, user_id, contact_email,
			  normalized_contact_email, status, currency, currency_decimals,
			  subtotal_minor, discount_minor, total_minor, paid_minor, version,
			  expires_at, created_at, updated_at)
			 VALUES (?, ?, 'customer-1', 'buyer@example.com', 'buyer@example.com',
			  'completed', ?, 2, ?, '0', ?, ?, 1, 9999999999999, 1, 1)`,
		)
		.bind(id, id.toUpperCase(), currency, paidMinor, paidMinor, paidMinor);
}
