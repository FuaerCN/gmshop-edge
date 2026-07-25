import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setCustomRoleEnabled } from "#/features/access/server/role-enabled";
import { createAuditStatement } from "#/server/audit";
import { applyMigrations } from "../integration/migrations";

const rootRoleId = "00000000-0000-4000-8000-000000000010";
const customRoleId = "00000000-0000-4000-8000-000000000011";

describe("dynamic role enablement", () => {
	let miniflare: Miniflare;
	let database: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-role-enablement" },
		});
		database = await miniflare.getD1Database("DB");
		await applyMigrations(database);
		const now = Date.now();
		await database.batch([
			database
				.prepare(
					`INSERT INTO roles
					 (id, name, description, permissions_json, built_in, enabled, created_at, updated_at)
					 VALUES (?, 'root', 'Root', '{}', 1, 1, ?, ?),
					        (?, 'operator', 'Operator', '{"dashboard":1}', 0, 1, ?, ?)`,
				)
				.bind(rootRoleId, now, now, customRoleId, now, now),
			database
				.prepare(
					"INSERT INTO users (id, name, email, email_verified, enabled, created_at, updated_at) VALUES ('actor', 'Actor', 'actor@example.com', 1, 1, ?, ?)",
				)
				.bind(now, now),
			database
				.prepare(
					"INSERT INTO users (id, name, email, email_verified, enabled, role_ids, created_at, updated_at) VALUES ('member', 'Member', 'member@example.com', 1, 1, ?, ?, ?)",
				)
				.bind(JSON.stringify([customRoleId]), now, now),
		]);
	});

	afterAll(async () => miniflare.dispose());

	it("atomically disables a custom role and records the actor", async () => {
		const before = await database
			.prepare("SELECT updated_at FROM users WHERE id = 'member'")
			.first<{ updated_at: number }>();
		const request = new Request("https://pay.example/admin/access", {
			headers: { "x-request-id": "role-toggle-request" },
		});
		await expect(
			setCustomRoleEnabled(
				database,
				customRoleId,
				false,
				createAuditStatement(database, request, "actor", {
					action: "role.enabled_changed",
					targetType: "role",
					targetId: customRoleId,
					after: { enabled: false },
				}),
			),
		).resolves.toEqual({ id: customRoleId, enabled: false });
		const state = await database
			.prepare(
				`SELECT r.enabled,
				 (SELECT COUNT(*) FROM audit_logs WHERE action = 'role.enabled_changed' AND actor_user_id = 'actor' AND target_id = ?) AS audits,
				 (SELECT COUNT(*) FROM json_each((SELECT role_ids FROM users WHERE id = 'member')) assigned
				  JOIN roles effective ON effective.id = assigned.value
				  WHERE effective.enabled = 1 AND json_extract(effective.permissions_json, '$.dashboard') > 0) AS effective_permissions,
				 (SELECT updated_at FROM users WHERE id = 'member') AS member_revision
				 FROM roles r WHERE r.id = ?`,
			)
			.bind(customRoleId, customRoleId)
			.first<{
				enabled: number;
				audits: number;
				effective_permissions: number;
				member_revision: number;
			}>();
		expect(state).toMatchObject({
			enabled: 0,
			audits: 1,
			effective_permissions: 0,
		});
		expect(state?.member_revision).toBeGreaterThan(before?.updated_at ?? 0);
	});

	it("never allows the built-in root role to be disabled", async () => {
		await expect(
			setCustomRoleEnabled(database, rootRoleId, false),
		).rejects.toThrow("Built-in roles cannot be disabled");
		const root = await database
			.prepare("SELECT enabled FROM roles WHERE id = ?")
			.bind(rootRoleId)
			.first<{ enabled: number }>();
		expect(root?.enabled).toBe(1);
	});
});
