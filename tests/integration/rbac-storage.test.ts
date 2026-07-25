import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	hasGrantedPermission,
	mergeRolePermissions,
} from "#/features/access/permissions";
import {
	normalizeRoleIds,
	permissionsJsonSchema,
	storedRoleIdsSchema,
} from "#/features/access/rbac-json";
import { systemPermission } from "#/features/access/system-rbac";
import { replaceUserRolesAtomically } from "#/features/users/server/role-assignments";
import { applyMigrations } from "./migrations";

const operatorRoleId = "00000000-0000-4000-8000-000000000001";
const reviewerRoleId = "00000000-0000-4000-8000-000000000002";

describe("RBAC JSON storage", () => {
	let miniflare: Miniflare;
	let db: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-rbac-storage" },
		});
		db = await miniflare.getD1Database("DB");
		await applyMigrations(db);
		const now = Date.now();
		await db
			.prepare(
				`INSERT INTO roles
				 (id, name, permissions_json, built_in, enabled, created_at, updated_at)
				 VALUES (?, 'operator', '{"orders":5}', 0, 1, ?, ?),
				        (?, 'reviewer', '{}', 0, 1, ?, ?)`,
			)
			.bind(operatorRoleId, now, now, reviewerRoleId, now, now)
			.run();
	});

	afterAll(async () => miniflare.dispose());

	it("stores one integer action mask for each module in the role JSON object", async () => {
		const row = await db
			.prepare(
				`SELECT json_extract(permissions_json, '$.orders') AS permission_mask,
				 typeof(json_extract(permissions_json, '$.orders')) AS storage_type
				 FROM roles WHERE id = ?`,
			)
			.bind(operatorRoleId)
			.first<{ permission_mask: number; storage_type: string }>();
		expect(row).toEqual({ permission_mask: 5, storage_type: "integer" });

		const permissions = mergeRolePermissions([
			{ module: "orders", permissionMask: row?.permission_mask ?? 0 },
		]);
		expect(
			hasGrantedPermission(
				false,
				permissions,
				systemPermission("orders", "read"),
			),
		).toBe(true);
		expect(
			hasGrantedPermission(
				false,
				permissions,
				systemPermission("orders", "update"),
			),
		).toBe(true);
		expect(
			hasGrantedPermission(
				false,
				permissions,
				systemPermission("orders", "delete"),
			),
		).toBe(false);
	});

	it.each([
		['{"future_module":1}', "unknown modules"],
		['{"orders":"1"}', "non-integer masks"],
		['{"orders":32}', "unregistered action bits"],
	])("rejects %s (%s) at the service boundary", (permissionsJson) => {
		expect(() =>
			permissionsJsonSchema.parse(JSON.parse(permissionsJson)),
		).toThrow();
	});

	it("normalizes role IDs and rejects invalid stored role arrays", async () => {
		const now = Date.now();
		await db
			.prepare(
				`INSERT INTO users
				 (id, name, email, email_verified, enabled, role_ids, created_at, updated_at)
				 VALUES ('member', 'Member', 'member@example.com', 1, 1, ?, ?, ?)`,
			)
			.bind(JSON.stringify([operatorRoleId, reviewerRoleId]), now, now)
			.run();

		expect(
			normalizeRoleIds([reviewerRoleId, operatorRoleId, operatorRoleId]),
		).toEqual([operatorRoleId, reviewerRoleId]);
		expect(() =>
			storedRoleIdsSchema.parse([reviewerRoleId, operatorRoleId]),
		).toThrow();
		await expect(
			replaceUserRolesAtomically(db, {
				userId: "member",
				roleIds: ["00000000-0000-4000-8000-000000000099"],
				currentUserId: "operator",
			}),
		).rejects.toMatchObject({ code: "user_role_ids_invalid", status: 400 });
	});
});
