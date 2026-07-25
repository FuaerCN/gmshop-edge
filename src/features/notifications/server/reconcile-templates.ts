import { builtinNotificationTemplateRows } from "../templates";

export async function reconcileNotificationTemplates(db: D1Database) {
	const now = Date.now();
	const ids = builtinNotificationTemplateRows.map((template) => template.id);
	const statements: D1PreparedStatement[] = [
		db
			.prepare(
				`DELETE FROM notification_templates
				 WHERE id NOT IN (${ids.map(() => "?").join(", ")})`,
			)
			.bind(...ids),
	];
	for (const template of builtinNotificationTemplateRows)
		statements.push(
			db
				.prepare(
					`INSERT INTO notification_templates
					 (id, event, channel, locale, subject, body, enabled, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
					 ON CONFLICT(id) DO UPDATE SET
					  event = excluded.event,
					  channel = excluded.channel,
					  locale = excluded.locale,
					  enabled = 1`,
				)
				.bind(
					template.id,
					template.event,
					template.channel,
					template.locale,
					template.subject,
					template.body,
					now,
					now,
				),
		);
	await db.batch(statements);
}
