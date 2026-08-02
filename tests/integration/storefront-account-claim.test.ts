import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveStoreAccount } from "#/features/storefront/server/account";
import { applyMigrations } from "./migrations";

const sessionState = vi.hoisted(() => ({
	emailVerified: true,
}));

vi.mock("#/features/auth/server/auth", () => ({
	getAuth: async () => ({
		api: {
			getSession: async () => ({
				session: { id: "session", userId: "buyer-user" },
				user: {
					id: "buyer-user",
					name: "Buyer",
					email: "Buyer@Example.com",
					emailVerified: sessionState.emailVerified,
					enabled: true,
					preferredLocale: "en-US",
				},
			}),
		},
	}),
}));

describe("storefront account commerce history claim", {
	timeout: 30_000,
}, () => {
	let miniflare: Miniflare;
	let db: D1Database;

	beforeEach(async () => {
		sessionState.emailVerified = true;
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

	it("allows any authenticated role and claims matching guest commerce history", async () => {
		await expect(
			resolveStoreAccount(db, new Request("https://shop.example/account"), {
				required: true,
			}),
		).resolves.toMatchObject({ user: { id: "buyer-user" } });

		const claimed = await ownership(db);
		expect(claimed).toEqual({
			order_user_id: "buyer-user",
			entitlement_user_id: "buyer-user",
			redemption_user_id: "buyer-user",
		});
	});

	it("does not claim guest commerce history before email verification", async () => {
		sessionState.emailVerified = false;
		await resolveStoreAccount(db, new Request("https://shop.example/account"), {
			required: true,
		});

		const claimed = await ownership(db);
		expect(claimed).toEqual({
			order_user_id: null,
			entitlement_user_id: null,
			redemption_user_id: null,
		});
	});
});

async function ownership(db: D1Database) {
	return db
		.prepare(
			`SELECT o.user_id AS order_user_id,
			 e.user_id AS entitlement_user_id,
			 r.user_id AS redemption_user_id
			 FROM shop_orders o
			 JOIN shop_order_items i ON i.order_id = o.id
			 JOIN customer_entitlements e ON e.order_item_id = i.id
			 JOIN coupon_redemptions r ON r.order_id = o.id
			 WHERE o.id = 'guest-order'`,
		)
		.first<{
			order_user_id: string | null;
			entitlement_user_id: string | null;
			redemption_user_id: string | null;
		}>();
}

async function seed(db: D1Database) {
	await db.batch([
		db.prepare(
			`INSERT INTO roles
			 (id, name, built_in, enabled, permissions_json, created_at, updated_at)
			 VALUES ('root-role', 'root', 1, 1, '{}', 1, 1)`,
		),
		db.prepare(
			`INSERT INTO users
			 (id, name, email, email_verified, role_ids, created_at, updated_at)
			 VALUES ('buyer-user', 'Buyer', 'Buyer@Example.com', 1,
			  '["root-role"]', 1, 1)`,
		),
		db.prepare(
			`INSERT INTO products
			 (id, name, product_type, status, created_at, updated_at)
			 VALUES ('product', 'Product', 'download', 'active', 1, 1)`,
		),
		db.prepare(
			`INSERT INTO product_sellable_items
			 (id, product_id, name, price_minor, created_at, updated_at)
			 VALUES ('sellable', 'product', 'Plan', '100', 1, 1)`,
		),
		db.prepare(
			`INSERT INTO coupons
			 (id, code, name, type, value_bps, scope_json, created_at, updated_at)
			 VALUES ('coupon', 'CLAIM', 'Claim fixture', 'percentage', 1000,
			  '{"productIds":[],"tagNames":[]}', 1, 1)`,
		),
		db.prepare(
			`INSERT INTO shop_orders
			 (id, order_number, user_id, contact_email, normalized_contact_email,
			  status, currency, currency_decimals, subtotal_minor, discount_minor,
			  total_minor, expires_at, created_at, updated_at)
			 VALUES ('guest-order', 'GMCLAIM', NULL, 'Buyer@Example.com',
			  'buyer@example.com', 'pending_payment', 'USD', 2, '100', '10',
			  '90', 9999999999999, 1, 1)`,
		),
		db.prepare(
			`INSERT INTO shop_order_items
			 (id, order_id, product_id, sellable_item_id, product_name,
			  delivery_component_id, delivery_component_type,
			  delivery_component_version, sellable_item_name, quantity,
			  unit_price_minor, discount_minor, subtotal_minor, created_at, updated_at)
			 VALUES ('order-item', 'guest-order', 'product', 'sellable', 'Product',
			  'sellable', 'download', 1, 'Plan', 1, '100', '10', '90', 1, 1)`,
		),
		db.prepare(
			`INSERT INTO customer_entitlements
			 (id, user_id, order_item_id, product_id, sellable_item_id,
			  delivery_component_id, entitlement_type, status, created_at, updated_at)
			 VALUES ('entitlement', NULL, 'order-item', 'product', 'sellable',
			  'sellable', 'download', 'active', 1, 1)`,
		),
		db.prepare(
			`INSERT INTO coupon_redemptions
			 (id, coupon_id, order_id, user_id, normalized_email,
			  discount_minor, status, created_at, updated_at)
			 VALUES ('redemption', 'coupon', 'guest-order', NULL,
			  'buyer@example.com', '10', 'reserved', 1, 1)`,
		),
	]);
}
