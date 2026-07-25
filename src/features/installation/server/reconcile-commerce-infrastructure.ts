import { builtinStorefrontRoles } from "#/features/access/storefront-access";
import {
	authProviderSettingKeys,
	initialStoredAuthProviders,
} from "#/features/auth/provider-settings";
import { initialCommerceSettings } from "#/features/installation/defaults";
import { builtinNotificationTemplateRows } from "#/features/notifications/templates";

export type CommerceInfrastructureReconciliation = {
	settings: number;
	authProviders: number;
	notificationTemplates: number;
	roles: number;
};

export async function reconcileCommerceInfrastructure(
	database: D1Database,
	now = Date.now(),
): Promise<CommerceInfrastructureReconciliation> {
	const statements: Array<{
		kind: keyof CommerceInfrastructureReconciliation;
		statement: D1PreparedStatement;
	}> = initialCommerceSettings.map((entry) => ({
		kind: "settings",
		statement: database
			.prepare(
				`INSERT OR IGNORE INTO system_settings
				 (key, value, is_secret, updated_by, created_at, updated_at)
				 VALUES (?, ?, 0, NULL, ?, ?)`,
			)
			.bind(entry.key, JSON.stringify(entry.value), now, now),
	}));
	for (const role of builtinStorefrontRoles) {
		statements.push({
			kind: "roles",
			statement: database
				.prepare(
					`INSERT OR IGNORE INTO roles
					 (id, name, description, built_in, enabled, permissions_json, created_at, updated_at)
					 VALUES (?, ?, ?, 1, 1, '{}', ?, ?)`,
				)
				.bind(crypto.randomUUID(), role.name, role.description, now, now),
		});
	}
	statements.push({
		kind: "authProviders",
		statement: database
			.prepare(
				`INSERT OR IGNORE INTO system_settings
				 (key, value, is_secret, updated_by, created_at, updated_at)
				 VALUES (?, ?, 0, NULL, ?, ?)`,
			)
			.bind(
				authProviderSettingKeys.providers,
				JSON.stringify(initialStoredAuthProviders),
				now,
				now,
			),
	});
	statements.push({
		kind: "authProviders",
		statement: database
			.prepare(
				`INSERT OR IGNORE INTO system_settings
				 (key, value, is_secret, updated_by, created_at, updated_at)
				 VALUES (?, '1', 0, NULL, ?, ?)`,
			)
			.bind(authProviderSettingKeys.revision, now, now),
	});
	statements.push({
		kind: "authProviders",
		statement: database
			.prepare(
				`INSERT OR IGNORE INTO system_settings
				 (key, value, is_secret, updated_by, created_at, updated_at)
				 VALUES (?, 'false', 0, NULL, ?, ?)`,
			)
			.bind(authProviderSettingKeys.telegramMiniAppEnabled, now, now),
	});
	for (const template of builtinNotificationTemplateRows) {
		statements.push({
			kind: "notificationTemplates",
			statement: database
				.prepare(
					`INSERT OR IGNORE INTO notification_templates
					 (id, event, channel, locale, subject, body, enabled, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
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
		});
	}

	const results = await database.batch(
		statements.map(({ statement }) => statement),
	);
	const added: CommerceInfrastructureReconciliation = {
		settings: 0,
		authProviders: 0,
		notificationTemplates: 0,
		roles: 0,
	};
	for (const [index, result] of results.entries()) {
		const entry = statements[index];
		if (entry) added[entry.kind] += result.meta.changes;
	}
	return added;
}
