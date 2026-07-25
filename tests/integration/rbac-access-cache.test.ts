import { Miniflare } from "miniflare";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { hasGrantedPermission } from "#/features/access/permissions";
import { permissionsJsonSchema } from "#/features/access/rbac-json";
import {
	loadEffectiveUserAccess,
	memoizeRequestAccess,
} from "#/features/access/server/access-cache";
import { bumpUserAccessRevisionStatement } from "#/features/access/server/access-revision";
import { bumpRoleMemberRevisionsStatement } from "#/features/access/server/role-enabled";
import { systemPermission } from "#/features/access/system-rbac";
import { replaceUserRolesAtomically } from "#/features/users/server/role-assignments";
import { applyMigrations } from "./migrations";

const operatorRoleId = "00000000-0000-4000-8000-000000000040";
const reviewerRoleId = "00000000-0000-4000-8000-000000000041";

describe("versioned RBAC access cache", () => {
	let miniflare: Miniflare;
	let database: D1Database;
	let updatedAt: number;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-rbac-access-cache" },
		});
		database = await miniflare.getD1Database("DB");
		await applyMigrations(database);
	});

	beforeEach(async () => {
		vi.spyOn(console, "info").mockImplementation(() => undefined);
		await database.batch([
			database.prepare("DELETE FROM users"),
			database.prepare("DELETE FROM roles"),
		]);
		updatedAt = Date.now();
		await database.batch([
			database
				.prepare(
					`INSERT INTO roles
					 (id, name, permissions_json, built_in, enabled, created_at, updated_at)
					 VALUES (?, 'operator', '{"orders":1}', 0, 1, ?, ?),
					        (?, 'reviewer', '{"orders":4}', 0, 1, ?, ?)`,
				)
				.bind(
					operatorRoleId,
					updatedAt,
					updatedAt,
					reviewerRoleId,
					updatedAt,
					updatedAt,
				),
			database
				.prepare(
					"INSERT INTO users (id, name, email, email_verified, enabled, role_ids, created_at, updated_at) VALUES ('user-1', 'Operator', 'operator@example.com', 1, 1, ?, ?, ?)",
				)
				.bind(
					JSON.stringify([operatorRoleId, reviewerRoleId]),
					updatedAt,
					updatedAt,
				),
		]);
	});

	afterEach(() => vi.restoreAllMocks());
	afterAll(async () => miniflare.dispose());

	it("checks authoritative D1 on both cold and warm cache loads", async () => {
		const cache = new MemoryKv();
		const counted = countedDatabase(database);
		const user = sessionUser(updatedAt);

		const cold = await loadEffectiveUserAccess(counted.db, cache.kv, user);
		const warm = await loadEffectiveUserAccess(counted.db, cache.kv, user);

		expect(counted.queryCount()).toBe(2);
		expect(cache.gets).toBe(2);
		expect(cache.puts).toBe(1);
		expect(cold.roles).toEqual(["operator", "reviewer"]);
		expect(warm.permissions.get("orders")).toBe(5);
		expect(
			hasGrantedPermission(
				false,
				warm.permissions,
				systemPermission("orders", "update"),
			),
		).toBe(true);
		const metrics = vi
			.mocked(console.info)
			.mock.calls.map(([metric]) => metric);
		expect(metrics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					cache: "rbac_access",
					operation: "read",
					outcome: "miss",
					sampleRate: 1,
				}),
				expect.objectContaining({
					cache: "rbac_access",
					operation: "write",
					outcome: "success",
					sampleRate: 1,
				}),
			]),
		);
		expect(JSON.stringify(metrics)).not.toContain("user-1");
		expect(JSON.stringify(metrics)).not.toContain("operator@example.com");
		expect(JSON.stringify(metrics)).not.toContain("rbac-access:v2");
		const payload = [...cache.values.values()].join("");
		expect(payload).not.toMatch(
			/operator@example\.com|"name"|session|token|password|secret/i,
		);
	});

	it("does not coalesce the same user revision across D1 bindings", async () => {
		const first = countedDatabase(database);
		const second = countedDatabase(database);
		const user = sessionUser(updatedAt);

		const [firstAccess, secondAccess] = await Promise.all([
			loadEffectiveUserAccess(first.db, new MemoryKv().kv, user),
			loadEffectiveUserAccess(second.db, new MemoryKv().kv, user),
		]);

		expect(first.queryCount()).toBe(1);
		expect(second.queryCount()).toBe(1);
		expect(firstAccess.permissions.get("orders")).toBe(5);
		expect(secondAccess.permissions.get("orders")).toBe(5);
	});

	it("rebuilds malformed cache values without trusting them", async () => {
		const cache = new MemoryKv();
		const counted = countedDatabase(database);
		const user = sessionUser(updatedAt);
		await loadEffectiveUserAccess(counted.db, cache.kv, user);
		cache.corruptOnlyValue();

		const rebuilt = await loadEffectiveUserAccess(counted.db, cache.kv, user);

		expect(counted.queryCount()).toBe(2);
		expect(rebuilt.permissions.get("orders")).toBe(5);
		expect(vi.mocked(console.info)).toHaveBeenCalledWith(
			expect.objectContaining({
				cache: "rbac_access",
				operation: "read",
				outcome: "corrupt",
			}),
		);
	});

	it("rejects version, user, and revision mismatches before rebuilding from D1", async () => {
		const cache = new MemoryKv();
		const counted = countedDatabase(database);
		const user = sessionUser(updatedAt);
		await loadEffectiveUserAccess(counted.db, cache.kv, user);

		for (const snapshot of [
			cachedSnapshot(updatedAt, { version: 1 }),
			cachedSnapshot(updatedAt, { userId: "other-user" }),
			cachedSnapshot(updatedAt, { revision: updatedAt + 1 }),
		]) {
			cache.replaceOnlyValue(JSON.stringify(snapshot));
			await expect(
				loadEffectiveUserAccess(counted.db, cache.kv, user),
			).resolves.toMatchObject({ roles: ["operator", "reviewer"] });
		}

		expect(counted.queryCount()).toBe(4);
	});

	it("does not use corrupt KV access when authoritative D1 is unavailable", async () => {
		const cache = new MemoryKv();
		await loadEffectiveUserAccess(database, cache.kv, sessionUser(updatedAt));
		cache.corruptOnlyValue();
		const unavailable = {
			prepare: () => ({
				bind: () => ({
					all: async () => {
						throw new Error("D1 unavailable");
					},
				}),
			}),
		} as unknown as D1Database;

		await expect(
			loadEffectiveUserAccess(unavailable, cache.kv, sessionUser(updatedAt)),
		).rejects.toThrow("D1 unavailable");
	});

	it("uses the new revision after a permission mutation even while old KV remains", async () => {
		const cache = new MemoryKv();
		const counted = countedDatabase(database);
		await loadEffectiveUserAccess(counted.db, cache.kv, sessionUser(updatedAt));
		await database.batch([
			database
				.prepare(
					`UPDATE roles SET permissions_json = '{"orders":8}', updated_at = ?
					 WHERE id = ?`,
				)
				.bind(updatedAt + 1, operatorRoleId),
			bumpRoleMemberRevisionsStatement(database, operatorRoleId, updatedAt + 1),
		]);
		const row = await database
			.prepare("SELECT updated_at FROM users WHERE id = 'user-1'")
			.first<{ updated_at: number }>();

		const refreshed = await loadEffectiveUserAccess(
			counted.db,
			cache.kv,
			sessionUser(row?.updated_at ?? 0),
		);

		expect(row?.updated_at).toBeGreaterThan(updatedAt);
		expect(cache.size).toBe(2);
		expect(counted.queryCount()).toBe(2);
		expect(refreshed.permissions.get("orders")).toBe(12);
	});

	it("does not let an old session revision preserve revoked access", async () => {
		const cache = new MemoryKv();
		const counted = countedDatabase(database);
		const oldUser = sessionUser(updatedAt);
		await loadEffectiveUserAccess(counted.db, cache.kv, oldUser);
		await database.batch([
			database
				.prepare(
					`UPDATE roles SET permissions_json = '{"orders":0}', updated_at = ?
					 WHERE id = ?`,
				)
				.bind(updatedAt + 1, operatorRoleId),
			bumpRoleMemberRevisionsStatement(database, operatorRoleId, updatedAt + 1),
		]);
		const row = await database
			.prepare("SELECT updated_at FROM users WHERE id = 'user-1'")
			.first<{ updated_at: number }>();

		const [stale, current] = await Promise.all([
			loadEffectiveUserAccess(counted.db, cache.kv, oldUser),
			loadEffectiveUserAccess(
				counted.db,
				cache.kv,
				sessionUser(row?.updated_at ?? 0),
			),
		]);

		expect(stale.permissions.get("orders")).toBe(4);
		expect(current.permissions.get("orders")).toBe(4);
		expect(cache.size).toBe(2);
		expect(counted.queryCount()).toBe(3);
	});

	it("falls back to D1 when KV is unavailable", async () => {
		const cache = new MemoryKv();
		cache.failGet = true;
		const counted = countedDatabase(database);

		await expect(
			loadEffectiveUserAccess(counted.db, cache.kv, sessionUser(updatedAt)),
		).resolves.toMatchObject({ roles: ["operator", "reviewer"] });
		expect(counted.queryCount()).toBe(1);
		expect(vi.mocked(console.info)).toHaveBeenCalledWith(
			expect.objectContaining({
				cache: "rbac_access",
				operation: "read",
				outcome: "fallback",
			}),
		);
	});

	it("returns authoritative access when the KV write fails", async () => {
		const cache = new MemoryKv();
		cache.failPut = true;
		const counted = countedDatabase(database);

		const access = await loadEffectiveUserAccess(
			counted.db,
			cache.kv,
			sessionUser(updatedAt),
		);

		expect(access.permissions.get("orders")).toBe(5);
		expect(counted.queryCount()).toBe(1);
		expect(cache.puts).toBe(1);
		expect(cache.size).toBe(0);
		expect(vi.mocked(console.info)).toHaveBeenCalledWith(
			expect.objectContaining({
				cache: "rbac_access",
				operation: "write",
				outcome: "fallback",
			}),
		);
	});

	it("checks D1 for each concurrent load", async () => {
		const cache = new MemoryKv();
		const counted = countedDatabase(database);
		const user = sessionUser(updatedAt);

		const [first, second] = await Promise.all([
			loadEffectiveUserAccess(counted.db, cache.kv, user),
			loadEffectiveUserAccess(counted.db, cache.kv, user),
		]);

		expect(counted.queryCount()).toBe(2);
		expect(cache.gets).toBe(2);
		expect(cache.puts).toBeGreaterThanOrEqual(1);
		expect(first.permissions.get("orders")).toBe(5);
		expect(second.permissions.get("orders")).toBe(5);
	});

	it("ignores session authorization fields and fails closed for disabled D1 users or no enabled roles", async () => {
		const counted = countedDatabase(database);

		for (const enabled of [undefined, null, false] as const) {
			await expect(
				loadEffectiveUserAccess(counted.db, undefined, {
					...sessionUser(updatedAt),
					enabled,
				}),
			).resolves.toMatchObject({ roles: ["operator", "reviewer"] });
		}
		expect(counted.queryCount()).toBe(3);

		await database
			.prepare("UPDATE users SET enabled = 0 WHERE id = 'user-1'")
			.run();
		await expect(
			loadEffectiveUserAccess(counted.db, undefined, sessionUser(updatedAt)),
		).rejects.toThrow("Forbidden");
		expect(counted.queryCount()).toBe(4);
	});

	it("rejects unknown modules and unregistered permission bits at input", () => {
		for (const permissions of ['{"orders":255}', '{"future_module":1}']) {
			expect(() =>
				permissionsJsonSchema.parse(JSON.parse(permissions)),
			).toThrow();
		}
	});

	it("increments the revision for repeated same-millisecond mutations", async () => {
		await database.batch([
			bumpUserAccessRevisionStatement(database, "user-1", updatedAt),
			bumpUserAccessRevisionStatement(database, "user-1", updatedAt),
		]);

		const row = await database
			.prepare("SELECT updated_at FROM users WHERE id = 'user-1'")
			.first<{ updated_at: number }>();
		expect(row?.updated_at).toBe(updatedAt + 2);
	});

	it("advances the revision in the same batch as role replacement", async () => {
		await replaceUserRolesAtomically(database, {
			userId: "user-1",
			roleIds: [reviewerRoleId],
			currentUserId: "actor",
		});

		const state = await database
			.prepare("SELECT updated_at, role_ids FROM users WHERE id = 'user-1'")
			.first<{ updated_at: number; role_ids: string }>();
		expect(state?.updated_at).toBeGreaterThan(updatedAt);
		expect(state?.role_ids).toBe(JSON.stringify([reviewerRoleId]));
	});

	it("shares one in-flight access load within the same Request", async () => {
		const cache = new WeakMap<
			Request,
			ReturnType<typeof loadEffectiveUserAccess>
		>();
		const request = new Request("https://pay.example/admin");
		let calls = 0;
		const load = async () => {
			calls += 1;
			return loadEffectiveUserAccess(
				database,
				undefined,
				sessionUser(updatedAt),
			);
		};

		const [first, second] = await Promise.all([
			memoizeRequestAccess(cache, request, load),
			memoizeRequestAccess(cache, request, load),
		]);

		expect(calls).toBe(1);
		expect(first).toBe(second);
	});

	it("does not share request memoization across Request objects", async () => {
		const cache = new WeakMap<
			Request,
			ReturnType<typeof loadEffectiveUserAccess>
		>();
		let calls = 0;
		const load = async () => {
			calls += 1;
			return loadEffectiveUserAccess(
				database,
				undefined,
				sessionUser(updatedAt),
			);
		};

		await Promise.all([
			memoizeRequestAccess(
				cache,
				new Request("https://pay.example/admin"),
				load,
			),
			memoizeRequestAccess(
				cache,
				new Request("https://pay.example/admin"),
				load,
			),
		]);

		expect(calls).toBe(2);
	});
});

function sessionUser(revision: number) {
	return {
		id: "user-1",
		name: "Operator",
		email: "operator@example.com",
		enabled: true,
		updatedAt: new Date(revision),
	};
}

function countedDatabase(database: D1Database) {
	let queries = 0;
	return {
		db: {
			prepare(query: string) {
				queries += 1;
				return database.prepare(query);
			},
		} as D1Database,
		queryCount: () => queries,
	};
}

class MemoryKv {
	readonly values = new Map<string, string>();
	gets = 0;
	puts = 0;
	failGet = false;
	failPut = false;

	readonly kv = {
		get: async (key: string) => {
			this.gets += 1;
			if (this.failGet) throw new Error("KV unavailable");
			return this.values.get(key) ?? null;
		},
		put: async (key: string, value: string) => {
			this.puts += 1;
			if (this.failPut) throw new Error("KV unavailable");
			this.values.set(key, value);
		},
	} as unknown as KVNamespace;

	get size() {
		return this.values.size;
	}

	corruptOnlyValue() {
		const key = this.values.keys().next().value;
		if (key) this.values.set(key, "{invalid");
	}

	replaceOnlyValue(value: string) {
		const key = this.values.keys().next().value;
		if (key) this.values.set(key, value);
	}
}

function cachedSnapshot(
	revision: number,
	overrides: Partial<{ version: number; userId: string; revision: number }>,
) {
	return {
		version: 2,
		userId: "user-1",
		revision,
		roles: ["operator", "reviewer"],
		root: false,
		permissions: [{ module: "orders", permissionMask: 5 }],
		...overrides,
	};
}
