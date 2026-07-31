CREATE TABLE `telegram_support_administrators` (
	`support_chat_id` text NOT NULL,
	`telegram_user_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_support_administrators_identity_uidx` ON `telegram_support_administrators` (`support_chat_id`,`telegram_user_id`);--> statement-breakpoint
CREATE INDEX `telegram_support_administrators_chat_idx` ON `telegram_support_administrators` (`support_chat_id`);--> statement-breakpoint
CREATE TABLE `telegram_support_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`support_chat_id` text NOT NULL,
	`telegram_user_id` text NOT NULL,
	`customer_chat_id` text NOT NULL,
	`user_id` text NOT NULL,
	`message_thread_id` integer,
	`topic_name` text,
	`status` text NOT NULL,
	`creation_lease_expires_at` integer,
	`opened_at` integer,
	`closed_at` integer,
	`closed_reason` text,
	`last_activity_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "telegram_support_conversations_topic_check" CHECK("telegram_support_conversations"."message_thread_id" IS NULL OR "telegram_support_conversations"."message_thread_id" > 0),
	CONSTRAINT "telegram_support_conversations_status_check" CHECK("telegram_support_conversations"."status" IN ('creating', 'active', 'closing', 'closed')),
	CONSTRAINT "telegram_support_conversations_closed_reason_check" CHECK("telegram_support_conversations"."closed_reason" IS NULL OR "telegram_support_conversations"."closed_reason" IN ('customer', 'administrator', 'idle_timeout'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_support_conversations_user_uidx` ON `telegram_support_conversations` (`support_chat_id`,`telegram_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_support_conversations_topic_uidx` ON `telegram_support_conversations` (`support_chat_id`,`message_thread_id`);--> statement-breakpoint
CREATE INDEX `telegram_support_conversations_idle_idx` ON `telegram_support_conversations` (`status`,`last_activity_at`,`id`);