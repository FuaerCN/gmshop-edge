import { DomainError } from "#/lib/domain-error";

type MutableUserError = {
	notFoundCode?: string;
	notFoundMessage?: string;
};

export async function loadRootUserState(db: D1Database, userId: string) {
	const user = await db
		.prepare(
			`SELECT users.enabled,
			 EXISTS (
			  SELECT 1 FROM json_each(users.role_ids) assigned
			  JOIN roles root_role ON root_role.id = assigned.value
			  WHERE root_role.name = 'root' AND root_role.enabled = 1
			 ) AS is_root
			 FROM users WHERE users.id = ? LIMIT 1`,
		)
		.bind(userId)
		.first<{ enabled: number; is_root: number }>();
	return user
		? {
				exists: true as const,
				enabled: user.enabled === 1,
				isRoot: user.is_root === 1,
			}
		: { exists: false as const, enabled: false, isRoot: false };
}

export async function isEnabledRootUser(db: D1Database, userId: string) {
	const user = await loadRootUserState(db, userId);
	return user.exists && user.enabled && user.isRoot;
}

export async function requireMutableNonRootUser(
	db: D1Database,
	userId: string,
	error: MutableUserError = {},
) {
	const user = await loadRootUserState(db, userId);
	if (!user.exists)
		throw new DomainError(
			error.notFoundCode ?? "user_not_found",
			404,
			error.notFoundMessage ?? "User not found",
		);
	if (user.isRoot)
		throw new DomainError(
			"root_user_immutable",
			409,
			"Root users cannot be edited or deleted",
		);
	return { enabled: user.enabled };
}
