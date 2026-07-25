import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { duplicateProduct } from "#/features/catalog/server/editor";
import { applyMigrations } from "./migrations";

const mocked = vi.hoisted(() => ({ db: undefined as D1Database | undefined }));
vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("#/server/context", () => ({
	getAdminServerContext: async () => ({
		db: { $client: mocked.db },
		currentUser: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
	}),
}));

describe("product draft duplication", { timeout: 30_000 }, () => {
	let miniflare: Miniflare;
	let db: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-catalog-duplicate" },
		});
		db = await miniflare.getD1Database("DB");
		mocked.db = db;
		await applyMigrations(db);
		await seed(db);
	});

	afterAll(async () => miniflare.dispose());

	it("copies only bound delivery configuration and does not copy inventory", async () => {
		if (!mocked.db) throw new Error("Test database is unavailable");
		const result = await duplicateProduct(
			{
				db: { $client: mocked.db },
				currentUser: { id: ADMIN_ID },
				request: new Request("https://gmshop.example/admin/products"),
			} as never,
			PRODUCT_ID,
		);
		const state = await db
			.prepare(
				`SELECT product.status,
				 (SELECT COUNT(*) FROM product_sellable_items WHERE product_id = product.id) AS sellableItems,
				 (SELECT COUNT(*) FROM product_sellable_items WHERE product_id = product.id) AS components,
				 (SELECT COUNT(*) FROM product_definition_versions WHERE product_id = product.id) AS definitionVersions,
				 (SELECT COUNT(*) FROM stock_entries secret JOIN product_sellable_items item
				  ON item.id = secret.sellable_item_id WHERE item.product_id = product.id) AS inventory
				 FROM products product WHERE product.id = ?`,
			)
			.bind(result.id)
			.first<Record<string, unknown>>();
		expect(state).toMatchObject({
			status: "draft",
			sellableItems: 1,
			components: 1,
			definitionVersions: 0,
			inventory: 0,
		});
	});
});

const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const SELLABLE_ITEM_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "44444444-4444-4444-8444-444444444444";
async function seed(db: D1Database) {
	const now = Date.now();
	await db.batch([
		db
			.prepare(`INSERT INTO users
		 (id, name, email, email_verified, enabled, created_at, updated_at)
		 VALUES (?, 'Admin', 'admin@example.com', 1, 1, ?, ?)`)
			.bind(ADMIN_ID, now, now),
		db
			.prepare(
				"INSERT INTO products (id, name, product_type, status, created_at, updated_at) VALUES (?, 'Stock', 'stock', 'active', ?, ?)",
			)
			.bind(PRODUCT_ID, now, now),
		db
			.prepare(`INSERT INTO product_sellable_items
		 (id, product_id, name, price_minor, created_at, updated_at)
		 VALUES (?, ?, 'Default', '1000', ?, ?)`)
			.bind(SELLABLE_ITEM_ID, PRODUCT_ID, now, now),
		db
			.prepare(`INSERT INTO product_definition_versions
		 (id, product_id, sellable_item_id, version, schema_json, published_at, created_by, created_at, updated_at)
		 VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)`)
			.bind(
				VERSION_ID,
				PRODUCT_ID,
				SELLABLE_ITEM_ID,
				JSON.stringify([
					{
						key: "project",
						name: "Project",
						description: "",
						inputType: "text",
						scope: "order",
						required: true,
						sensitive: false,
						validationPattern: "",
						minimumValue: null,
						maximumValue: null,
						defaultValue: "",
						sortOrder: 100,
						options: [],
					},
				]),
				now,
				ADMIN_ID,
				now,
				now,
			),
	]);
}
