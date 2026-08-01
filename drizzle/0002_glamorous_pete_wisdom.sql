CREATE TABLE `telegram_web_support_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`support_chat_id` text NOT NULL,
	`visitor_id` text NOT NULL,
	`user_id` text,
	`email_encrypted` text NOT NULL,
	`email_hash` text NOT NULL,
	`session_token_hash` text NOT NULL,
	`fingerprint_hash` text,
	`fingerprint_version` text,
	`fingerprint_key_id` text,
	`public_key_jwk` text NOT NULL,
	`message_thread_id` integer,
	`topic_name` text,
	`status` text NOT NULL,
	`creation_lease_expires_at` integer,
	`next_reply_sequence` integer DEFAULT 1 NOT NULL,
	`opened_at` integer,
	`closed_at` integer,
	`closed_reason` text,
	`last_activity_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "telegram_web_support_conversations_topic_check" CHECK("telegram_web_support_conversations"."message_thread_id" IS NULL OR "telegram_web_support_conversations"."message_thread_id" > 0),
	CONSTRAINT "telegram_web_support_conversations_status_check" CHECK("telegram_web_support_conversations"."status" IN ('creating', 'active', 'closing', 'closed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_web_support_conversations_visitor_uidx` ON `telegram_web_support_conversations` (`support_chat_id`,`visitor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_web_support_conversations_session_uidx` ON `telegram_web_support_conversations` (`session_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_web_support_conversations_topic_uidx` ON `telegram_web_support_conversations` (`support_chat_id`,`message_thread_id`);--> statement-breakpoint
CREATE INDEX `telegram_web_support_conversations_fingerprint_idx` ON `telegram_web_support_conversations` (`fingerprint_hash`);--> statement-breakpoint
CREATE INDEX `telegram_web_support_conversations_idle_idx` ON `telegram_web_support_conversations` (`status`,`last_activity_at`,`id`);--> statement-breakpoint
CREATE TABLE `telegram_web_support_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`algorithm` text NOT NULL,
	`wrapped_key` text NOT NULL,
	`iv` text NOT NULL,
	`ciphertext` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `telegram_web_support_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_web_support_replies_sequence_uidx` ON `telegram_web_support_replies` (`conversation_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `telegram_web_support_replies_expiry_idx` ON `telegram_web_support_replies` (`expires_at`,`id`);--> statement-breakpoint
CREATE TABLE `telegram_web_support_sends` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`client_message_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `telegram_web_support_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_web_support_sends_message_uidx` ON `telegram_web_support_sends` (`conversation_id`,`client_message_id`);--> statement-breakpoint
CREATE INDEX `telegram_web_support_sends_created_idx` ON `telegram_web_support_sends` (`created_at`,`id`);