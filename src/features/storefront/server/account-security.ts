import { encryptNotificationDestination } from "#/features/notifications/secrets";
import type { CommerceNotificationEvent } from "#/features/notifications/templates";
import { DomainError } from "#/lib/domain-error";
import type { SupportedLocale } from "#/lib/locales";
import { createAuditStatement } from "#/server/audit";
import { loadRuntimeConfig } from "#/server/runtime-config";

export async function updateStoreProfile(
	db: D1Database,
	input: { name: string; preferredLocale: SupportedLocale },
	context: {
		userId: string;
		currentName: string;
		currentPreferredLocale: SupportedLocale;
		request: Request;
	},
) {
	const now = Date.now();
	await db.batch([
		db
			.prepare(
				"UPDATE users SET name = ?, preferred_locale = ?, updated_at = ? WHERE id = ?",
			)
			.bind(input.name, input.preferredLocale, now, context.userId),
		createAuditStatement(db, context.request, context.userId, {
			action: "account.profile_updated",
			targetType: "user",
			targetId: context.userId,
			before: {
				name: context.currentName,
				preferredLocale: context.currentPreferredLocale,
			},
			after: input,
		}),
	]);
	return { name: input.name };
}

export async function listStoreSessions(
	db: D1Database,
	userId: string,
	currentSessionId: string,
	now = Date.now(),
) {
	const sessions = await db
		.prepare(
			`SELECT id, expires_at, ip_address, user_agent, created_at, updated_at
			 FROM sessions WHERE user_id = ? AND expires_at > ?
			 ORDER BY updated_at DESC, id DESC LIMIT 100`,
		)
		.bind(userId, now)
		.all<SessionRow>();
	return sessions.results.map((session) => ({
		id: session.id,
		expiresAt: session.expires_at,
		ipAddress: session.ip_address,
		userAgent: session.user_agent,
		createdAt: session.created_at,
		updatedAt: session.updated_at,
		current: session.id === currentSessionId,
	}));
}

export async function revokeStoreSession(
	db: D1Database,
	sessionId: string,
	context: { userId: string; currentSessionId: string; request: Request },
) {
	if (sessionId === context.currentSessionId)
		throw new DomainError(
			"current_session_revoke_denied",
			409,
			"The current session cannot be revoked here",
		);
	const owned = await db
		.prepare("SELECT id FROM sessions WHERE id = ? AND user_id = ? LIMIT 1")
		.bind(sessionId, context.userId)
		.first<{ id: string }>();
	if (!owned)
		throw new DomainError("session_not_found", 404, "Session not found");
	const now = Date.now();
	const results = await db.batch([
		db
			.prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?")
			.bind(sessionId, context.userId),
		createAuditStatement(db, context.request, context.userId, {
			action: "account.session_revoked",
			targetType: "session",
			targetId: sessionId,
			after: { revokedAt: now },
		}),
	]);
	if (Number(results[0]?.meta.changes ?? 0) !== 1)
		throw new DomainError("session_not_found", 404, "Session not found");
	return { id: sessionId };
}

export async function listStoreNotificationPreferences(
	db: D1Database,
	userId: string,
) {
	const rows = await db
		.prepare(
			`SELECT event, enabled FROM notification_subscriptions
			 WHERE user_id = ? AND channel = 'email'`,
		)
		.bind(userId)
		.all<{ event: string; enabled: number }>();
	return new Map(
		rows.results.map((row) => [row.event, { enabled: row.enabled === 1 }]),
	);
}

export async function updateStoreNotificationPreference(
	db: D1Database,
	input: {
		event: CommerceNotificationEvent;
		enabled: boolean;
	},
	context: {
		userId: string;
		email: string;
		emailVerified: boolean;
		preferredLocale: SupportedLocale;
		request: Request;
	},
) {
	if (!context.emailVerified)
		throw new DomainError(
			"verified_email_required",
			409,
			"Verify your email before enabling email notifications",
		);
	const runtime = await loadRuntimeConfig(db);
	if (!runtime.commerceSecret)
		throw new DomainError(
			"notification_secret_unavailable",
			503,
			"Notification encryption is unavailable",
		);
	const destination = await encryptNotificationDestination(
		context.email.trim().toLowerCase(),
		runtime.commerceSecret,
	);
	const id = crypto.randomUUID();
	const now = Date.now();
	await db.batch([
		db
			.prepare(
				`INSERT INTO notification_subscriptions
				 (id, user_id, event, channel,
				  destination_encrypted, destination_key_version, enabled, created_at, updated_at)
				 VALUES (?, ?, ?, 'email', ?, 1, ?, ?, ?)
				 ON CONFLICT(user_id, event, channel)
				 DO UPDATE SET destination_encrypted = excluded.destination_encrypted,
				  destination_key_version = excluded.destination_key_version,
				  enabled = excluded.enabled, updated_at = excluded.updated_at`,
			)
			.bind(
				id,
				context.userId,
				input.event,
				destination,
				input.enabled ? 1 : 0,
				now,
				now,
			),
		createAuditStatement(db, context.request, context.userId, {
			action: "account.notification_preference_updated",
			targetType: "notification_subscription",
			targetId: id,
			after: {
				event: input.event,
				channel: "email",
				enabled: input.enabled,
				locale: context.preferredLocale,
			},
		}),
	]);
	return input;
}

type SessionRow = {
	id: string;
	expires_at: number;
	ip_address: string | null;
	user_agent: string | null;
	created_at: number;
	updated_at: number;
};
