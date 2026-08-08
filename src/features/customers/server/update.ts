import type { z } from "zod";
import type { customerUpdateSchema } from "#/features/customers/schema";
import { requireMutableNonRootUser } from "#/features/users/server/root-protection";
import { DomainError } from "#/lib/domain-error";
import { createAuditStatement } from "#/server/audit";

export async function updateCustomerRecord(
	db: D1Database,
	request: Request,
	actorUserId: string,
	data: z.infer<typeof customerUpdateSchema>,
) {
	const before = await db
		.prepare(
			`SELECT id, name, customer_note AS note,
			 CASE WHEN enabled = 1 THEN 'active' ELSE 'disabled' END AS status
			 FROM users WHERE id = ? LIMIT 1`,
		)
		.bind(data.id)
		.first<Record<string, unknown>>();
	if (!before)
		throw new DomainError("customer_not_found", 404, "User not found");
	await requireMutableNonRootUser(db, data.id, {
		notFoundCode: "customer_not_found",
		notFoundMessage: "User not found",
	});
	const now = Date.now();
	const results = await db.batch([
		db
			.prepare(
				`UPDATE users SET name = ?, customer_note = ?, enabled = ?, updated_at = ?
				 WHERE id = ? AND NOT EXISTS (
				  SELECT 1 FROM json_each(users.role_ids) assigned
				  JOIN roles root_role ON root_role.id = assigned.value
				  WHERE root_role.name = 'root' AND root_role.enabled = 1
				 )`,
			)
			.bind(
				data.name,
				data.note,
				data.status === "active" ? 1 : 0,
				now,
				data.id,
			),
		createAuditStatement(db, request, actorUserId, {
			action: "customer.updated",
			targetType: "user",
			targetId: data.id,
			before,
			after: data,
		}),
	]);
	if (Number(results[0]?.meta.changes ?? 0) !== 1) {
		await requireMutableNonRootUser(db, data.id, {
			notFoundCode: "customer_not_found",
			notFoundMessage: "User not found",
		});
		throw new DomainError(
			"customer_update_conflict",
			409,
			"Customer changed; retry the update",
		);
	}
	return { id: data.id };
}
