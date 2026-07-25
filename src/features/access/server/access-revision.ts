export function bumpUserAccessRevisionStatement(
	db: D1Database,
	userId: string,
	now = Date.now(),
) {
	return db
		.prepare(`UPDATE users SET updated_at =
			CASE WHEN updated_at >= ? THEN updated_at + 1 ELSE ? END
			WHERE id = ?`)
		.bind(now, now, userId);
}
