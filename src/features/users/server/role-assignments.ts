import { normalizeRoleIds } from "#/features/access/rbac-json";
import { DomainError } from "#/lib/domain-error";

export async function replaceUserRolesAtomically(
	db: D1Database,
	input: {
		userId: string;
		roleIds: string[];
		currentUserId: string;
	},
) {
	if (input.userId === input.currentUserId && input.roleIds.length === 0)
		throw new DomainError(
			"own_roles_required",
			409,
			"You cannot remove all of your own roles",
		);
	const roleIds = normalizeRoleIds(input.roleIds);
	if (roleIds.length) {
		const placeholders = roleIds.map(() => "?").join(",");
		const roles = await db
			.prepare(
				`SELECT id, name FROM roles
				 WHERE enabled = 1 AND id IN (${placeholders})`,
			)
			.bind(...roleIds)
			.all<{ id: string; name: string }>();
		if (
			roles.results.length !== roleIds.length ||
			roles.results.some((role) => role.name === "guest")
		)
			throw new DomainError(
				"user_role_ids_invalid",
				400,
				"Roles must exist, be enabled, and cannot include guest",
			);
	}
	const now = Date.now();
	const nextRolesJson = JSON.stringify(roleIds);
	const result = await db
		.prepare(`UPDATE users SET role_ids = ?,
				updated_at = CASE WHEN updated_at >= ? THEN updated_at + 1 ELSE ? END
				WHERE id = ? AND (
				 enabled <> 1 OR NOT EXISTS (
				  SELECT 1 FROM json_each(users.role_ids) assigned
				  JOIN roles current_role ON current_role.id = assigned.value
				  WHERE current_role.name = 'root' AND current_role.enabled = 1
				 ) OR EXISTS (
				  SELECT 1 FROM json_each(?) next_assigned
				  JOIN roles next_role ON next_role.id = next_assigned.value
				  WHERE next_role.name = 'root' AND next_role.enabled = 1
				 ) OR EXISTS (
				  SELECT 1 FROM users other
				  WHERE other.id <> users.id AND other.enabled = 1
				   AND EXISTS (
				    SELECT 1 FROM json_each(other.role_ids) other_assigned
				    JOIN roles other_role ON other_role.id = other_assigned.value
				    WHERE other_role.name = 'root' AND other_role.enabled = 1
				   )
				 )
				)`)
		.bind(nextRolesJson, now, now, input.userId, nextRolesJson)
		.run();
	if ((result.meta.changes ?? 0) !== 1) {
		const existing = await db
			.prepare("SELECT id FROM users WHERE id = ?")
			.bind(input.userId)
			.first<{ id: string }>();
		if (!existing)
			throw new DomainError("user_not_found", 404, "User not found");
		throw new DomainError(
			"last_root_required",
			409,
			"The last enabled root user cannot lose the root role",
		);
	}
	const actual = await db
		.prepare("SELECT role_ids FROM users WHERE id = ?")
		.bind(input.userId)
		.first<{ role_ids: string }>();
	if (!actual) throw new DomainError("user_not_found", 404, "User not found");
	return {
		userId: input.userId,
		roleIds: JSON.parse(actual.role_ids) as string[],
	};
}
