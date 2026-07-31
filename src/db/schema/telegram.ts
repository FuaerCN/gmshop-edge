import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { timestamps } from "./common";

export const telegramSupportConversations = sqliteTable(
	"telegram_support_conversations",
	{
		id: text("id").primaryKey(),
		supportChatId: text("support_chat_id").notNull(),
		telegramUserId: text("telegram_user_id").notNull(),
		customerChatId: text("customer_chat_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		messageThreadId: integer("message_thread_id"),
		topicName: text("topic_name"),
		status: text("status", {
			enum: ["creating", "active", "closing", "closed"],
		}).notNull(),
		creationLeaseExpiresAt: integer("creation_lease_expires_at", {
			mode: "timestamp_ms",
		}),
		openedAt: integer("opened_at", { mode: "timestamp_ms" }),
		closedAt: integer("closed_at", { mode: "timestamp_ms" }),
		closedReason: text("closed_reason", {
			enum: ["customer", "administrator", "idle_timeout"],
		}),
		lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }),
		...timestamps,
	},
	(table) => [
		uniqueIndex("telegram_support_conversations_user_uidx").on(
			table.supportChatId,
			table.telegramUserId,
		),
		uniqueIndex("telegram_support_conversations_topic_uidx").on(
			table.supportChatId,
			table.messageThreadId,
		),
		index("telegram_support_conversations_idle_idx").on(
			table.status,
			table.lastActivityAt,
			table.id,
		),
		check(
			"telegram_support_conversations_topic_check",
			sql`${table.messageThreadId} IS NULL OR ${table.messageThreadId} > 0`,
		),
		check(
			"telegram_support_conversations_status_check",
			sql`${table.status} IN ('creating', 'active', 'closing', 'closed')`,
		),
		check(
			"telegram_support_conversations_closed_reason_check",
			sql`${table.closedReason} IS NULL OR ${table.closedReason} IN ('customer', 'administrator', 'idle_timeout')`,
		),
	],
);

export const telegramSupportAdministrators = sqliteTable(
	"telegram_support_administrators",
	{
		supportChatId: text("support_chat_id").notNull(),
		telegramUserId: text("telegram_user_id").notNull(),
		status: text("status", { enum: ["creator", "administrator"] }).notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex("telegram_support_administrators_identity_uidx").on(
			table.supportChatId,
			table.telegramUserId,
		),
		index("telegram_support_administrators_chat_idx").on(table.supportChatId),
	],
);
