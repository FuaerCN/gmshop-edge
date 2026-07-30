import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listUsersWithCommerce } from "#/features/users/server/list";
import {
	createDatastoreCounters,
	instrumentD1,
} from "../helpers/datastore-counters";
import { applyMigrations } from "./migrations";

const adminRoleId = "00000000-0000-4000-8000-000000000030";
const operatorRoleId = "00000000-0000-4000-8000-000000000031";

describe("admin users pagination", () => {
	let miniflare: Miniflare;
	let database: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-users-pagination" },
		});
		database = await miniflare.getD1Database("DB");
		await applyMigrations(database);
		await database.batch([
			database
				.prepare(
					"INSERT INTO roles (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
				)
				.bind(adminRoleId, "admin", 1, 1),
			database
				.prepare(
					"INSERT INTO roles (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
				)
				.bind(operatorRoleId, "operator", 1, 1),
			database
				.prepare(
					"INSERT INTO users (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
				)
				.bind("user-1", "Alice", "alice@example.com", 1, 1),
			database
				.prepare(
					"INSERT INTO users (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
				)
				.bind("user-2", "Bob", "bob@example.com", 2, 2),
			database
				.prepare(
					"INSERT INTO users (id, name, email, role_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
				)
				.bind(
					"user-3",
					"Carol",
					"carol@example.com",
					JSON.stringify([adminRoleId, operatorRoleId]),
					3,
					3,
				),
			database.prepare(
				"INSERT INTO users (id, name, email, created_at, updated_at) VALUES ('user-4', 'Buyer', 'buyer@example.com', 4, 4)",
			),
			database.prepare(
				`INSERT INTO accounts
				 (id, user_id, account_id, provider_id, telegram_id,
				  telegram_username, created_at, updated_at)
				 VALUES ('account-4', 'user-4', '777000123', 'telegram',
				  '777000123', 'local_tg_user', 4, 4)`,
			),
		]);
	});

	afterAll(async () => miniflare.dispose());

	it("returns the page, exact total, and roles in one D1 batch", async () => {
		const counters = createDatastoreCounters();
		const result = await listUsersWithCommerce(
			instrumentD1(database, counters),
			{ pageIndex: 0, pageSize: 2, search: "" },
		);

		expect(result.total).toBe(4);
		expect(result.data.map((user) => user.id)).toEqual(["user-4", "user-3"]);
		expect(result.data[0]?.roles).toEqual([]);
		expect(result.data[0]?.loginMethods).toEqual([
			{
				providerId: "telegram",
				accountId: "777000123",
				telegramId: "777000123",
				telegramUsername: "local_tg_user",
				createdAt: 4,
			},
		]);
		expect(result.data[1]?.roles).toEqual(["admin", "operator"]);
		expect(counters.d1Prepare).toBe(2);
		expect(counters.d1Batch).toBe(1);
		expect(counters.d1StatementAll).toBe(0);
		expect(counters.d1StatementFirst).toBe(0);
	});

	it("keeps the exact total for an empty page without another round trip", async () => {
		const counters = createDatastoreCounters();
		const result = await listUsersWithCommerce(
			instrumentD1(database, counters),
			{ pageIndex: 9, pageSize: 2, search: "" },
		);

		expect(result).toEqual({ data: [], total: 4 });
		expect(counters.d1Prepare).toBe(2);
		expect(counters.d1Batch).toBe(1);
		expect(counters.d1StatementAll).toBe(0);
		expect(counters.d1StatementFirst).toBe(0);
	});

	it("applies search to the exact count", async () => {
		const result = await listUsersWithCommerce(database, {
			pageIndex: 0,
			pageSize: 10,
			search: "alice",
		});

		expect(result.total).toBe(1);
		expect(result.data.map((user) => user.email)).toEqual([
			"alice@example.com",
		]);
	});

	it("uses the created-at index for the production page order", async () => {
		const plan = await database
			.prepare(`EXPLAIN QUERY PLAN WITH page AS (
			 SELECT u.id, u.name, u.email, u.enabled, u.email_verified,
			  u.created_at, u.updated_at
			 FROM users u ORDER BY u.created_at DESC, u.id DESC LIMIT 10 OFFSET 0
			)
			SELECT page.* FROM page ORDER BY page.created_at DESC, page.id DESC`)
			.all<{ detail: string }>();
		const details = plan.results.map((row) => row.detail).join("\n");

		expect(details).toContain("SCAN u USING INDEX users_created_idx");
		expect(details).not.toContain("USE TEMP B-TREE FOR ORDER BY");
	});
});
