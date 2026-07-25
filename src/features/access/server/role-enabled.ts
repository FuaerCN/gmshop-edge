import { DomainError } from "#/lib/domain-error";

export async function setCustomRoleEnabled(
	db: D1Database,
	id: string,
	enabled: boolean,
	audit?: D1PreparedStatement,
) {
	const role = await db
		.prepare("SELECT built_in, enabled FROM roles WHERE id = ? LIMIT 1")
		.bind(id)
		.first<{ built_in: number; enabled: number }>();
	if (!role) throw new DomainError("role_not_found", 404, "Role not found");
	if (role.built_in)
		throw new DomainError(
			"built_in_role",
			409,
			"Built-in roles cannot be disabled",
		);
	if (Boolean(role.enabled) === enabled) return { id, enabled };
	const now = Date.now();
	await db.batch([
		db
			.prepare(
				"UPDATE roles SET enabled = ?, updated_at = ? WHERE id = ? AND built_in = 0",
			)
			.bind(enabled ? 1 : 0, now, id),
		bumpRoleMemberRevisionsStatement(db, id, now),
		...(audit ? [audit] : []),
	]);
	return { id, enabled };
}

export function bumpRoleMemberRevisionsStatement(
	db: D1Database,
	roleId: string,
	now = Date.now(),
) {
	return db
		.prepare(`UPDATE users SET updated_at =
		 CASE WHEN updated_at >= ? THEN updated_at + 1 ELSE ? END
		 WHERE EXISTS (
		  SELECT 1 FROM json_each(users.role_ids) assigned
		  WHERE assigned.value = ?
		 )`)
		.bind(now, now, roleId);
}
