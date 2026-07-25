import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	hasOperationalRetentionWork,
	runOperationalRetentionCleanup,
} from "#/features/operations/server/operational-retention";
import { applyMigrations } from "./migrations";

describe("commerce operational retention", () => {
	let miniflare: Miniflare;
	let db: D1Database;

	beforeAll(async () => {
		miniflare = new Miniflare({
			modules: true,
			script: "export default { fetch() { return new Response('ok') } }",
			d1Databases: { DB: "gmshop-edge-operational-retention" },
		});
		db = await miniflare.getD1Database("DB");
		await applyMigrations(db);
	});

	afterAll(async () => miniflare.dispose());

	it("removes only terminal commerce runtime rows beyond retention", async () => {
		await db.batch([
			db.prepare(
				`INSERT INTO notification_deliveries
				 (id, event, channel, idempotency_key, message_encrypted,
				  message_key_version, status, created_at, updated_at)
				 VALUES ('old-notification', 'order_paid', 'email', 'old-notification',
				  'ciphertext', 1, 'delivered', 1, 1),
				 ('pending-notification', 'order_paid', 'email', 'pending-notification',
				  'ciphertext', 1, 'pending', 1, 1)`,
			),
			db.prepare(
				`INSERT INTO outbox_events
				 (id, event_type, aggregate_type, aggregate_id, idempotency_key,
				  payload, status, created_at, updated_at)
				 VALUES ('old-outbox', 'delivery.ready', 'delivery', 'delivery-1',
				  'old-outbox', '{}', 'published', 1, 1)`,
			),
			db.prepare(
				`INSERT INTO operation_task_runs
				 (id, task, trigger, status, started_at, completed_at)
				 VALUES ('old-task', 'commerce_maintenance', 'scheduled', 'succeeded', 1, 2)`,
			),
		]);
		await expect(hasOperationalRetentionWork(db, 10_000, 1_000)).resolves.toBe(
			true,
		);
		const result = await runOperationalRetentionCleanup({
			db,
			bucket: { delete: vi.fn() },
			now: 10_000,
			retentionMs: 1_000,
		});
		expect(result).toMatchObject({ commerceRows: 3, auditExports: 0 });
		const rows = await db
			.prepare(
				`SELECT
				 (SELECT COUNT(*) FROM notification_deliveries WHERE id = 'pending-notification') AS pending_rows,
				 (SELECT COUNT(*) FROM notification_deliveries WHERE id = 'old-notification') AS old_rows`,
			)
			.first<{ pending_rows: number; old_rows: number }>();
		expect(rows).toEqual({ pending_rows: 1, old_rows: 0 });
	});

	it("deletes R2 audit exports before recording deletion", async () => {
		await db
			.prepare(
				`INSERT INTO operation_task_runs
				 (id, task, trigger, status, started_at, completed_at,
				  artifact_object_key, record_count, delete_after)
				 VALUES ('export', 'audit_export', 'manual', 'succeeded', 1, 1,
				  'audit/export.ndjson', 1, 5)`,
			)
			.run();
		const remove = vi.fn().mockResolvedValue(undefined);
		const result = await runOperationalRetentionCleanup({
			db,
			bucket: { delete: remove },
			now: 10,
			retentionMs: 1,
		});
		expect(remove).toHaveBeenCalledWith(["audit/export.ndjson"]);
		expect(result.auditExports).toBe(1);
	});
});
