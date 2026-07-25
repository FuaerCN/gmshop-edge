import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	loadCartSellableItem,
	presentCart,
	removeSellableItemsFromAllCarts,
	replaceCartItems,
} from "#/features/storefront/server/cart";
import { applyMigrations } from "./migrations";

vi.mock("cloudflare:workers", () => ({ env: {} }));

describe("storefront cart sellable item policy", { timeout: 30_000 }, () => {
	let miniflare: Miniflare;
	let db: D1Database;
	const sellableItemId = "00000000-0000-4000-8000-000000000001";

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-cart-sellableItem" },
		});
		db = await miniflare.getD1Database("DB");
		await applyMigrations(db);
		const now = Date.now();
		await db.batch([
			db
				.prepare(
					"INSERT INTO products (id, name, product_type, status, created_at, updated_at) VALUES ('product', 'Product', 'download', 'active', ?, ?)",
				)
				.bind(now, now),
			db
				.prepare(
					`INSERT INTO product_sellable_items
					 (id, product_id, name, access_limit,
					  price_minor, maximum_quantity, enabled, created_at, updated_at)
					 VALUES (?, 'product', 'Plan', 10,
					  '1250', 7, 1, ?, ?)`,
				)
				.bind(sellableItemId, now, now),
			db
				.prepare(
					`INSERT INTO users
					 (id, name, email, email_verified, created_at, updated_at)
					 VALUES ('customer', 'Customer', 'customer@example.com', 1, ?, ?)`,
				)
				.bind(now, now),
			db
				.prepare(
					`INSERT INTO shopping_carts
					 (id, user_id, items_json, version, expires_at, created_at, updated_at)
					 VALUES ('cart', 'customer', ?, 1, ?, ?, ?)`,
				)
				.bind(
					JSON.stringify([{ sellableItemId, quantity: 1 }]),
					now + 86_400_000,
					now,
					now,
				),
		]);
	});

	afterAll(async () => miniflare.dispose());

	it("uses current pricing and clamps merged quantity to the purchase range", async () => {
		await db
			.prepare(
				"UPDATE product_sellable_items SET price_minor = '1500', minimum_quantity = 2 WHERE id = ?",
			)
			.bind(sellableItemId)
			.run();
		await replaceCartItems(
			db,
			{
				id: "cart",
				version: 1,
				items: [{ sellableItemId, quantity: 1 }],
			},
			new Map([[sellableItemId, 1]]),
		);
		const cart = await presentCart(db, "customer");
		expect(cart.items[0]).toMatchObject({
			quantity: 2,
			priceMinorSnapshot: "1500",
			priceMinor: "1500",
			issues: [],
		});
		await db
			.prepare(
				"UPDATE product_sellable_items SET price_minor = '1250', minimum_quantity = 1 WHERE id = ?",
			)
			.bind(sellableItemId)
			.run();
	});

	it("uses the sellable item quantity limit and requires the item to be enabled", async () => {
		await expect(loadCartSellableItem(db, sellableItemId)).resolves.toEqual({
			priceMinor: "1250",
			minimumQuantity: 1,
			maximumQuantity: 7,
		});
		await db
			.prepare("UPDATE product_sellable_items SET enabled = 0 WHERE id = ?")
			.bind(sellableItemId)
			.run();
		await expect(loadCartSellableItem(db, sellableItemId)).resolves.toBeNull();
	});

	it("retains an unavailable item in the customer cart for explicit resolution", async () => {
		const cart = await presentCart(db, "customer");
		expect(cart.items).toHaveLength(1);
		expect(cart.items[0]).toMatchObject({
			sellableItemId,
			issues: ["unavailable"],
		});
	});

	it("does not apply a stale cart replacement after a version conflict", async () => {
		const current = await db
			.prepare("SELECT version FROM shopping_carts WHERE id = 'cart'")
			.first<{ version: number }>();
		if (!current) throw new Error("Cart fixture is required");
		const items = [{ sellableItemId, quantity: 2 }];
		const attempts = await Promise.allSettled([
			replaceCartItems(
				db,
				{ id: "cart", version: current.version, items },
				new Map([[sellableItemId, 3]]),
			),
			replaceCartItems(
				db,
				{ id: "cart", version: current.version, items },
				new Map([[sellableItemId, 4]]),
			),
		]);
		expect(
			attempts.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		const row = await db
			.prepare("SELECT items_json FROM shopping_carts WHERE id = 'cart'")
			.first<{ items_json: string }>();
		const stored = JSON.parse(row?.items_json ?? "[]") as Array<{
			quantity: number;
		}>;
		expect([3, 4]).toContain(stored[0]?.quantity);
	});

	it("rejects a replacement larger than 50 items before writing", async () => {
		const current = await db
			.prepare(
				"SELECT version, items_json FROM shopping_carts WHERE id = 'cart'",
			)
			.first<{ version: number; items_json: string }>();
		if (!current) throw new Error("Cart fixture is required");
		const oversized = new Map(
			Array.from({ length: 51 }, (_, index) => [
				`00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
				1,
			]),
		);
		await expect(
			replaceCartItems(
				db,
				{
					id: "cart",
					version: current.version,
					items: JSON.parse(current.items_json),
				},
				oversized,
			),
		).rejects.toMatchObject({ code: "cart_item_limit_exceeded" });
	});

	it("removes a permanently deleted sellable item from cart JSON with CAS", async () => {
		const before = await db
			.prepare("SELECT version FROM shopping_carts WHERE id = 'cart'")
			.first<{ version: number }>();
		await removeSellableItemsFromAllCarts(db, [sellableItemId]);
		const after = await db
			.prepare(
				"SELECT items_json, version FROM shopping_carts WHERE id = 'cart'",
			)
			.first<{ items_json: string; version: number }>();
		expect(JSON.parse(after?.items_json ?? "null")).toEqual([]);
		expect(after?.version).toBe((before?.version ?? 0) + 1);
	});

	it("clears an expired cart with CAS and uses the expiry index", async () => {
		const before = await db
			.prepare("SELECT version FROM shopping_carts WHERE id = 'cart'")
			.first<{ version: number }>();
		await db
			.prepare("UPDATE shopping_carts SET expires_at = ? WHERE id = 'cart'")
			.bind(Date.now() - 1)
			.run();
		const plan = await db
			.prepare(
				"EXPLAIN QUERY PLAN SELECT id FROM shopping_carts WHERE expires_at <= ? ORDER BY expires_at, id LIMIT 100",
			)
			.bind(Date.now())
			.all<{ detail: string }>();
		expect(plan.results.map((row) => row.detail).join(" ")).toContain(
			"shopping_carts_expiry_idx",
		);
		const cart = await presentCart(db, "customer");
		expect(cart.items).toEqual([]);
		expect(cart.version).toBe((before?.version ?? 0) + 1);
	});

	it("rejects malformed persisted cart JSON at the read boundary", async () => {
		const now = Date.now();
		await db.batch([
			db
				.prepare(
					`INSERT INTO users
					 (id, name, email, email_verified, created_at, updated_at)
					 VALUES ('invalid-customer', 'Invalid customer', 'invalid@example.com', 1, ?, ?)`,
				)
				.bind(now, now),
			db
				.prepare(
					`INSERT INTO shopping_carts
					 (id, user_id, items_json, version, expires_at, created_at, updated_at)
					 VALUES ('invalid-cart', 'invalid-customer', '{"not":"items"}', 1, ?, ?, ?)`,
				)
				.bind(now + 86_400_000, now, now),
		]);
		await expect(presentCart(db, "invalid-customer")).rejects.toMatchObject({
			code: "cart_data_invalid",
		});
	});
});
