import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { z } from "zod";
import { requireAdmin } from "#/features/access/server/require-admin";
import { systemPermission } from "#/features/access/system-rbac";
import { DomainError } from "#/lib/domain-error";
import { getCloudflareEnv } from "#/server/db.server";
import {
	loadTelegramSettings,
	telegramSettingKeys,
	telegramSettingsInputSchema,
	upsertTelegramSetting,
} from "../settings";
import { synchronizeSupportAdministrators } from "./support-admins";
import { synchronizeTelegramBot, telegramRuntime } from "./sync";

export const getTelegramSettingsFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const { db } = await telegramAdminContext("read");
		const { runtime, settings, provider } = await telegramRuntime(db);
		const counts = await db
			.prepare(
				`SELECT
				 (SELECT count(*) FROM telegram_support_conversations WHERE status = 'active') AS active_count,
				 (SELECT count(*) FROM telegram_support_administrators WHERE support_chat_id = ?) AS administrator_count`,
			)
			.bind(settings.supportChatId)
			.first<{ active_count: number; administrator_count: number }>();
		return {
			...settings,
			botName: settings.syncedBotName ?? provider?.displayName ?? null,
			botUsername: provider?.telegramBotUsername ?? null,
			dependencyAvailable: Boolean(
				provider?.telegramBotToken && provider.telegramMiniAppEnabled,
			),
			webhookUrl: safeWebhookUrl(runtime.betterAuthUrl),
			activeConversationCount: Number(counts?.active_count ?? 0),
			administratorCount: Number(counts?.administrator_count ?? 0),
		};
	},
);

export const saveTelegramSettingsFn = createServerFn({ method: "POST" })
	.validator((input: z.input<typeof telegramSettingsInputSchema>) =>
		telegramSettingsInputSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const context = await telegramAdminContext("update");
		const { db } = context;
		const current = await loadTelegramSettings(db);
		if (data.supportChatId !== current.supportChatId) {
			const active = await db
				.prepare(
					"SELECT count(*) AS count FROM telegram_support_conversations WHERE status = 'active'",
				)
				.first<{ count: number }>();
			if (Number(active?.count ?? 0) > 0)
				throw new DomainError(
					"telegram_active_conversations",
					409,
					"Close active support conversations before changing the chat",
				);
		}
		const now = Date.now();
		if (
			data.supportEnabled &&
			(!current.supportEnabled || data.supportChatId !== current.supportChatId)
		) {
			try {
				const validation = await synchronizeSupportAdministrators(
					db,
					now,
					data.supportChatId,
				);
				if (!validation.available)
					throw new Error("telegram_support_dependency_unavailable");
			} catch (error) {
				throw new DomainError(
					error instanceof Error ? error.message : "telegram_support_invalid",
					409,
					"Telegram support chat validation failed",
				);
			}
		}
		await db.batch([
			upsertTelegramSetting(
				db,
				telegramSettingKeys.autoSync,
				data.autoSyncEnabled,
				now,
			),
			upsertTelegramSetting(
				db,
				telegramSettingKeys.autoSyncIntervalMs,
				data.autoSyncIntervalMs,
				now,
			),
			upsertTelegramSetting(
				db,
				telegramSettingKeys.supportEnabled,
				data.supportEnabled,
				now,
			),
			upsertTelegramSetting(
				db,
				telegramSettingKeys.supportChatId,
				data.supportChatId,
				now,
			),
			upsertTelegramSetting(
				db,
				telegramSettingKeys.idleTimeoutMs,
				data.idleTimeoutMs,
				now,
			),
			...(data.autoSyncEnabled && !current.autoSyncEnabled
				? [
						upsertTelegramSetting(
							db,
							telegramSettingKeys.status,
							"pending_sync",
							now,
						),
					]
				: []),
			...(data.supportChatId !== current.supportChatId && current.supportChatId
				? [
						db
							.prepare(
								"DELETE FROM telegram_support_administrators WHERE support_chat_id = ?",
							)
							.bind(current.supportChatId),
					]
				: []),
			auditStatement(context, "telegram.settings.updated", now, {
				autoSyncEnabled: data.autoSyncEnabled,
				autoSyncIntervalMs: data.autoSyncIntervalMs,
				supportEnabled: data.supportEnabled,
				supportChatConfigured: Boolean(data.supportChatId),
				idleTimeoutMs: data.idleTimeoutMs,
			}),
		]);
		return { saved: true };
	});

export const syncTelegramBotFn = createServerFn({ method: "POST" }).handler(
	async () => {
		const context = await telegramAdminContext("update");
		const { db } = context;
		const result = await synchronizeTelegramBot(db, { manual: true });
		if (!result.synchronized)
			throw new DomainError(
				result.code ?? "telegram_sync_failed",
				409,
				"Telegram bot synchronization failed",
			);
		await auditStatement(context, "telegram.bot.synchronized", Date.now(), {
			botName: result.botName,
			username: result.username,
		}).run();
		return result;
	},
);

async function telegramAdminContext(action: "read" | "update") {
	const request = getRequest();
	const user = await requireAdmin(
		request,
		systemPermission("settings", action),
	);
	const db = getCloudflareEnv(request).DB;
	if (!db) throw new Error("D1 binding DB is unavailable");
	return { db, request, user };
}

function auditStatement(
	context: Awaited<ReturnType<typeof telegramAdminContext>>,
	action: string,
	now: number,
	after: unknown,
) {
	return context.db
		.prepare(
			`INSERT INTO audit_logs
			 (id, actor_user_id, action, target_type, target_id, request_id,
			  ip_address, after, created_at)
			 VALUES (?, ?, ?, 'telegram', NULL, ?, ?, ?, ?)`,
		)
		.bind(
			crypto.randomUUID(),
			context.user.id,
			action,
			context.request.headers.get("x-request-id"),
			context.request.headers.get("cf-connecting-ip"),
			JSON.stringify(after),
			now,
		);
}

function safeWebhookUrl(value: string) {
	try {
		return `${new URL(value).origin}/api/telegram/webhook`;
	} catch {
		return null;
	}
}
