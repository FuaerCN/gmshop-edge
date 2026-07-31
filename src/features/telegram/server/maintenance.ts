import { Api } from "grammy";
import type { SupportedLocale } from "#/lib/locales";
import { m } from "#/paraglide/messages";
import { telegramSettingKeys, upsertTelegramSetting } from "../settings";
import { telegramDataKeyId } from "./secret";
import { synchronizeSupportAdministrators } from "./support-admins";
import {
	synchronizeTelegramBot,
	telegramCommandVersion,
	telegramRuntime,
} from "./sync";

export async function runTelegramMaintenance(db: D1Database, now = Date.now()) {
	const sync = await reconcileBot(db, now);
	const { settings, provider } = await telegramRuntime(db);
	let administratorSync: unknown = { skipped: true };
	if (
		settings.supportChatId &&
		(settings.supportEnabled || (await activeConversationCount(db)) > 0)
	) {
		try {
			administratorSync = await synchronizeSupportAdministrators(db, now);
		} catch (error) {
			administratorSync = {
				failed: true,
				code:
					error instanceof Error ? error.message : "administrator_sync_failed",
			};
		}
	}
	let idleClosed = 0;
	if (provider?.telegramBotToken && settings.supportChatId)
		idleClosed = await closeIdleConversations(
			db,
			new Api(provider.telegramBotToken),
			settings.idleTimeoutMs,
			now,
		);
	return { sync, administratorSync, idleClosed };
}

async function reconcileBot(db: D1Database, now: number) {
	const { runtime, settings, provider } = await telegramRuntime(db);
	if (!settings.autoSyncEnabled) return { skipped: true };
	if (
		settings.status === "active" &&
		settings.lastAutoSyncCheckAt &&
		settings.lastAutoSyncCheckAt > now - settings.autoSyncIntervalMs
	)
		return { skipped: true };
	const dataKeyId = runtime.dataEncryptionSecret
		? await telegramDataKeyId(runtime.dataEncryptionSecret)
		: null;
	const origin = safeOrigin(runtime.betterAuthUrl);
	const pending =
		settings.status !== "active" ||
		settings.syncedRevision !== provider?.revision ||
		settings.syncedBotUserId !== provider?.telegramBotUserId ||
		settings.syncedDataKeyId !== dataKeyId ||
		settings.syncedOrigin !== origin ||
		settings.syncedCommandVersion !== telegramCommandVersion;
	if (!pending) {
		await upsertTelegramSetting(
			db,
			telegramSettingKeys.lastAutoSyncCheckAt,
			now,
			now,
		).run();
		return { skipped: true };
	}
	if (settings.status === "active")
		await upsertTelegramSetting(
			db,
			telegramSettingKeys.status,
			"pending_sync",
			now,
		).run();
	return synchronizeTelegramBot(db, { now });
}

async function closeIdleConversations(
	db: D1Database,
	api: Api,
	idleTimeoutMs: number,
	now: number,
) {
	const cutoff = now - idleTimeoutMs;
	const rows = await db
		.prepare(
			`SELECT c.id, c.support_chat_id, c.customer_chat_id, c.message_thread_id,
			 u.preferred_locale
			 FROM telegram_support_conversations c
			 JOIN users u ON u.id = c.user_id
			 WHERE c.status = 'active' AND c.last_activity_at <= ?
			 ORDER BY c.last_activity_at, c.id LIMIT 50`,
		)
		.bind(cutoff)
		.all<{
			id: string;
			support_chat_id: string;
			customer_chat_id: string;
			message_thread_id: number | null;
			preferred_locale: SupportedLocale;
		}>();
	let closed = 0;
	for (const conversation of rows.results) {
		if (!conversation.message_thread_id) continue;
		const claimed = await db
			.prepare(
				`UPDATE telegram_support_conversations SET status = 'closing', updated_at = ?
				 WHERE id = ? AND status = 'active' AND last_activity_at <= ?`,
			)
			.bind(now, conversation.id, cutoff)
			.run();
		if (Number(claimed.meta.changes ?? 0) !== 1) continue;
		const locale = normalizeLocale(conversation.preferred_locale);
		try {
			await api.sendMessage(
				conversation.support_chat_id,
				m.telegram_support_topic_closed({}, { locale }),
				{ message_thread_id: conversation.message_thread_id },
			);
			await api.closeForumTopic(
				conversation.support_chat_id,
				conversation.message_thread_id,
			);
			const completed = await db
				.prepare(
					`UPDATE telegram_support_conversations SET status = 'closed',
					 closed_at = ?, closed_reason = 'idle_timeout', updated_at = ?
					 WHERE id = ? AND status = 'closing'`,
				)
				.bind(now, now, conversation.id)
				.run();
			if (Number(completed.meta.changes ?? 0) === 1) {
				await api.sendMessage(
					conversation.customer_chat_id,
					m.telegram_support_idle_closed({}, { locale }),
				);
				closed += 1;
			} else {
				await api
					.reopenForumTopic(
						conversation.support_chat_id,
						conversation.message_thread_id,
					)
					.catch(() => undefined);
			}
		} catch {
			await db
				.prepare(
					`UPDATE telegram_support_conversations SET status = 'active', updated_at = ?
					 WHERE id = ? AND status = 'closing'`,
				)
				.bind(now, conversation.id)
				.run();
		}
	}
	return closed;
}

async function activeConversationCount(db: D1Database) {
	const row = await db
		.prepare(
			"SELECT count(*) AS count FROM telegram_support_conversations WHERE status = 'active'",
		)
		.first<{ count: number }>();
	return Number(row?.count ?? 0);
}

function safeOrigin(value: string) {
	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

function normalizeLocale(value: string): SupportedLocale {
	return value === "zh-CN" ? "zh-CN" : "en-US";
}
