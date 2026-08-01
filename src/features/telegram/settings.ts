import { z } from "zod";

export const telegramSettingKeys = {
	autoSync: "telegram.bot.auto_sync_enabled",
	autoSyncIntervalMs: "telegram.bot.auto_sync_interval_ms",
	supportEnabled: "telegram.support.enabled",
	webSupportEnabled: "telegram.support.web_enabled",
	supportChatId: "telegram.support.chat_id",
	idleTimeoutMs: "telegram.support.idle_timeout_ms",
	status: "telegram.bot.status",
	syncedRevision: "telegram.bot.synced_auth_revision",
	syncedBotUserId: "telegram.bot.synced_bot_user_id",
	syncedBotName: "telegram.bot.synced_bot_name",
	syncedDataKeyId: "telegram.bot.synced_data_key_id",
	syncedOrigin: "telegram.bot.synced_origin",
	syncedCommandVersion: "telegram.bot.synced_command_version",
	lastSyncedAt: "telegram.bot.last_synced_at",
	lastAutoSyncCheckAt: "telegram.bot.last_auto_sync_check_at",
	lastErrorCode: "telegram.bot.last_error_code",
	nextRetryAt: "telegram.bot.next_retry_at",
	syncAttempts: "telegram.bot.sync_attempts",
	lastAdminSyncAt: "telegram.support.last_admin_sync_at",
} as const;

export const telegramSettingsInputSchema = z.object({
	autoSyncEnabled: z.boolean(),
	autoSyncIntervalMs: z
		.number()
		.int()
		.min(60_000)
		.max(86_400_000)
		.multipleOf(60_000),
	supportEnabled: z.boolean(),
	webSupportEnabled: z.boolean(),
	supportChatId: z
		.string()
		.trim()
		.regex(/^-\d{5,20}$/)
		.nullable(),
	idleTimeoutMs: z
		.number()
		.int()
		.min(300_000)
		.max(30 * 86_400_000),
});

export type TelegramBotStatus =
	| "unsynced"
	| "pending_sync"
	| "syncing"
	| "active"
	| "sync_failed"
	| "dependency_unavailable";

export async function loadTelegramSettings(db: D1Database) {
	const rows = await db
		.prepare(
			"SELECT key, value FROM system_settings WHERE key LIKE 'telegram.%'",
		)
		.all<{ key: string; value: string }>();
	const values = new Map(
		rows.results.map((row) => [row.key, parse(row.value)]),
	);
	return {
		autoSyncEnabled: bool(values.get(telegramSettingKeys.autoSync), true),
		autoSyncIntervalMs: integer(
			values.get(telegramSettingKeys.autoSyncIntervalMs),
			60_000,
		),
		supportEnabled: bool(values.get(telegramSettingKeys.supportEnabled), false),
		webSupportEnabled: bool(
			values.get(telegramSettingKeys.webSupportEnabled),
			false,
		),
		supportChatId: nullableString(
			values.get(telegramSettingKeys.supportChatId),
		),
		idleTimeoutMs: integer(
			values.get(telegramSettingKeys.idleTimeoutMs),
			86_400_000,
		),
		status: status(values.get(telegramSettingKeys.status)),
		syncedRevision: integer(values.get(telegramSettingKeys.syncedRevision), 0),
		syncedBotUserId: nullableString(
			values.get(telegramSettingKeys.syncedBotUserId),
		),
		syncedBotName: nullableString(
			values.get(telegramSettingKeys.syncedBotName),
		),
		syncedDataKeyId: nullableString(
			values.get(telegramSettingKeys.syncedDataKeyId),
		),
		syncedOrigin: nullableString(values.get(telegramSettingKeys.syncedOrigin)),
		syncedCommandVersion: nullableString(
			values.get(telegramSettingKeys.syncedCommandVersion),
		),
		lastSyncedAt: nullableInteger(values.get(telegramSettingKeys.lastSyncedAt)),
		lastAutoSyncCheckAt: nullableInteger(
			values.get(telegramSettingKeys.lastAutoSyncCheckAt),
		),
		lastErrorCode: nullableString(
			values.get(telegramSettingKeys.lastErrorCode),
		),
		nextRetryAt: nullableInteger(values.get(telegramSettingKeys.nextRetryAt)),
		syncAttempts: integer(values.get(telegramSettingKeys.syncAttempts), 0),
		lastAdminSyncAt: nullableInteger(
			values.get(telegramSettingKeys.lastAdminSyncAt),
		),
	};
}

export function upsertTelegramSetting(
	db: D1Database,
	key: string,
	value: unknown,
	now: number,
) {
	return db
		.prepare(
			`INSERT INTO system_settings (key, value, created_at, updated_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value,
			 updated_at = excluded.updated_at`,
		)
		.bind(key, JSON.stringify(value), now, now);
}

function parse(value: string) {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return undefined;
	}
}
function bool(value: unknown, fallback: boolean) {
	return typeof value === "boolean" ? value : fallback;
}
function integer(value: unknown, fallback: number) {
	return typeof value === "number" && Number.isInteger(value)
		? value
		: fallback;
}
function nullableInteger(value: unknown) {
	return typeof value === "number" && Number.isInteger(value) ? value : null;
}
function nullableString(value: unknown) {
	return typeof value === "string" && value.length > 0 ? value : null;
}
function status(value: unknown): TelegramBotStatus {
	return [
		"unsynced",
		"pending_sync",
		"syncing",
		"active",
		"sync_failed",
		"dependency_unavailable",
	].includes(String(value))
		? (value as TelegramBotStatus)
		: "unsynced";
}
