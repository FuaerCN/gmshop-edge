PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `supplier_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`key_id` text NOT NULL,
	`secret_encrypted` text NOT NULL,
	`secret_revision` integer DEFAULT 1 NOT NULL,
	`allowed_callback_origin` text,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "supplier_api_keys_revision_check" CHECK("supplier_api_keys"."secret_revision" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_api_keys_key_id_uidx` ON `supplier_api_keys` (`key_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_api_keys_user_name_uidx` ON `supplier_api_keys` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `supplier_api_keys_user_active_idx` ON `supplier_api_keys` (`user_id`,`revoked_at`,`id`);--> statement-breakpoint
CREATE TABLE `supplier_api_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_order_id` text NOT NULL,
	`user_id` text NOT NULL,
	`api_key_id` text NOT NULL,
	`downstream_order_no` text NOT NULL,
	`request_digest` text NOT NULL,
	`callback_url` text,
	`state` text DEFAULT 'processing' NOT NULL,
	`callback_attempt_count` integer DEFAULT 0 NOT NULL,
	`next_callback_at` integer,
	`last_callback_error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`shop_order_id`) REFERENCES `shop_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`api_key_id`) REFERENCES `supplier_api_keys`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "supplier_api_orders_callback_attempt_check" CHECK("supplier_api_orders"."callback_attempt_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_api_orders_shop_order_uidx` ON `supplier_api_orders` (`shop_order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_api_orders_user_request_uidx` ON `supplier_api_orders` (`user_id`,`downstream_order_no`);--> statement-breakpoint
CREATE INDEX `supplier_api_orders_callback_idx` ON `supplier_api_orders` (`state`,`next_callback_at`,`id`);--> statement-breakpoint
CREATE TABLE `supplier_export_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`sellable_item_id` text NOT NULL,
	`price_minor` text NOT NULL,
	`currency` text NOT NULL,
	`currency_decimals` integer NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`sellable_item_id`) REFERENCES `product_sellable_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "supplier_export_listings_price_check" CHECK("price_minor" <> '' AND "price_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "supplier_export_listings_decimals_check" CHECK("supplier_export_listings"."currency_decimals" BETWEEN 0 AND 8)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_export_listings_item_uidx` ON `supplier_export_listings` (`sellable_item_id`);--> statement-breakpoint
CREATE INDEX `supplier_export_listings_enabled_updated_idx` ON `supplier_export_listings` (`enabled`,`updated_at`,`id`);--> statement-breakpoint
CREATE TABLE `wallet_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`direction` text NOT NULL,
	`amount_minor` text NOT NULL,
	`balance_before_minor` text NOT NULL,
	`balance_after_minor` text NOT NULL,
	`currency` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`reason` text,
	`actor_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "wallet_entries_amount_check" CHECK("amount_minor" <> '' AND "amount_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "wallet_entries_before_check" CHECK("balance_before_minor" <> '' AND "balance_before_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "wallet_entries_after_check" CHECK("balance_after_minor" <> '' AND "balance_after_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "wallet_entries_direction_check" CHECK("wallet_entries"."direction" IN ('credit', 'debit'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_entries_idempotency_uidx` ON `wallet_entries` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `wallet_entries_user_created_idx` ON `wallet_entries` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `wallet_topups` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount_minor` text NOT NULL,
	`currency` text NOT NULL,
	`currency_decimals` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`idempotency_key` text NOT NULL,
	`paid_at` integer,
	`refunded_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "wallet_topups_amount_check" CHECK("amount_minor" <> '' AND "amount_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "wallet_topups_currency_decimals_check" CHECK("wallet_topups"."currency_decimals" BETWEEN 0 AND 8)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_topups_user_idempotency_uidx` ON `wallet_topups` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `wallet_topups_user_created_idx` ON `wallet_topups` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `__new_supplier_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`base_url` text NOT NULL,
	`normalized_api_origin` text NOT NULL,
	`protocol_version` text NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`currency_decimals` integer DEFAULT 2 NOT NULL,
	`name` text NOT NULL,
	`credentials_encrypted` text NOT NULL,
	`credentials_revision` integer DEFAULT 1 NOT NULL,
	`credential_fingerprint` text NOT NULL,
	`balance_minor` text,
	`balance_synced_at` integer,
	`reserve_balance_minor` text DEFAULT '0' NOT NULL,
	`low_balance_minor` text DEFAULT '0' NOT NULL,
	`max_order_cost_minor` text,
	`health_status` text DEFAULT 'unknown' NOT NULL,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`cooldown_until` integer,
	`last_selected_at` integer,
	`last_error_code` text,
	`last_error_at` integer,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "supplier_accounts_provider_check" CHECK("__new_supplier_accounts"."provider" IN ('acg', 'dujiao_next', 'gmshop_edge')),
	CONSTRAINT "supplier_accounts_currency_decimals_check" CHECK("__new_supplier_accounts"."currency_decimals" BETWEEN 0 AND 8),
	CONSTRAINT "supplier_accounts_credentials_revision_check" CHECK("__new_supplier_accounts"."credentials_revision" > 0),
	CONSTRAINT "supplier_accounts_balance_check" CHECK("__new_supplier_accounts"."balance_minor" IS NULL OR ("balance_minor" <> '' AND "balance_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "supplier_accounts_reserve_balance_check" CHECK("reserve_balance_minor" <> '' AND "reserve_balance_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "supplier_accounts_low_balance_check" CHECK("low_balance_minor" <> '' AND "low_balance_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "supplier_accounts_max_order_cost_check" CHECK("__new_supplier_accounts"."max_order_cost_minor" IS NULL OR ("max_order_cost_minor" <> '' AND "max_order_cost_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "supplier_accounts_failures_check" CHECK("__new_supplier_accounts"."consecutive_failures" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_supplier_accounts`("id", "provider", "base_url", "normalized_api_origin", "protocol_version", "currency", "currency_decimals", "name", "credentials_encrypted", "credentials_revision", "credential_fingerprint", "balance_minor", "balance_synced_at", "reserve_balance_minor", "low_balance_minor", "max_order_cost_minor", "health_status", "consecutive_failures", "cooldown_until", "last_selected_at", "last_error_code", "last_error_at", "enabled", "created_at", "updated_at") SELECT "id", "provider", "base_url", "normalized_api_origin", "protocol_version", "currency", "currency_decimals", "name", "credentials_encrypted", "credentials_revision", "credential_fingerprint", "balance_minor", "balance_synced_at", "reserve_balance_minor", "low_balance_minor", "max_order_cost_minor", "health_status", "consecutive_failures", "cooldown_until", "last_selected_at", "last_error_code", "last_error_at", "enabled", "created_at", "updated_at" FROM `supplier_accounts`;--> statement-breakpoint
DROP TABLE `supplier_accounts`;--> statement-breakpoint
ALTER TABLE `__new_supplier_accounts` RENAME TO `supplier_accounts`;--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_accounts_source_name_uidx` ON `supplier_accounts` (`provider`,`normalized_api_origin`,`protocol_version`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_accounts_source_credential_uidx` ON `supplier_accounts` (`provider`,`normalized_api_origin`,`protocol_version`,`credential_fingerprint`);--> statement-breakpoint
CREATE INDEX `supplier_accounts_source_eligible_idx` ON `supplier_accounts` (`provider`,`normalized_api_origin`,`protocol_version`,`enabled`,`health_status`,`cooldown_until`,`last_selected_at`,`id`);--> statement-breakpoint
CREATE TABLE `__new_supplier_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`sellable_item_id` text NOT NULL,
	`provider` text NOT NULL,
	`normalized_api_origin` text NOT NULL,
	`protocol_version` text NOT NULL,
	`upstream_product_id` text NOT NULL,
	`upstream_sku_id` text NOT NULL,
	`upstream_product_name` text NOT NULL,
	`upstream_sku_name` text NOT NULL,
	`reference_cost_minor` text NOT NULL,
	`max_cost_minor` text NOT NULL,
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`remote_status` text DEFAULT 'unknown' NOT NULL,
	`last_synced_at` integer,
	`last_error_code` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`sellable_item_id`) REFERENCES `product_sellable_items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "supplier_bindings_provider_check" CHECK("__new_supplier_bindings"."provider" IN ('acg', 'dujiao_next', 'gmshop_edge')),
	CONSTRAINT "supplier_bindings_reference_cost_check" CHECK("reference_cost_minor" <> '' AND "reference_cost_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "supplier_bindings_max_cost_check" CHECK("max_cost_minor" <> '' AND "max_cost_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "supplier_bindings_stock_quantity_check" CHECK("__new_supplier_bindings"."stock_quantity" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_supplier_bindings`("id", "sellable_item_id", "provider", "normalized_api_origin", "protocol_version", "upstream_product_id", "upstream_sku_id", "upstream_product_name", "upstream_sku_name", "reference_cost_minor", "max_cost_minor", "stock_quantity", "remote_status", "last_synced_at", "last_error_code", "enabled", "created_at", "updated_at") SELECT "id", "sellable_item_id", "provider", "normalized_api_origin", "protocol_version", "upstream_product_id", "upstream_sku_id", "upstream_product_name", "upstream_sku_name", "reference_cost_minor", "max_cost_minor", "stock_quantity", "remote_status", "last_synced_at", "last_error_code", "enabled", "created_at", "updated_at" FROM `supplier_bindings`;--> statement-breakpoint
DROP TABLE `supplier_bindings`;--> statement-breakpoint
ALTER TABLE `__new_supplier_bindings` RENAME TO `supplier_bindings`;--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_bindings_enabled_item_uidx` ON `supplier_bindings` (`sellable_item_id`) WHERE "supplier_bindings"."enabled" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_bindings_enabled_source_sku_uidx` ON `supplier_bindings` (`provider`,`normalized_api_origin`,`protocol_version`,`upstream_product_id`,`upstream_sku_id`) WHERE "supplier_bindings"."enabled" = 1;--> statement-breakpoint
CREATE INDEX `supplier_bindings_source_status_sync_idx` ON `supplier_bindings` (`provider`,`normalized_api_origin`,`protocol_version`,`enabled`,`remote_status`,`last_synced_at`,`id`);--> statement-breakpoint
CREATE TABLE `__new_payment_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text,
	`wallet_topup_id` text,
	`channel_id` text NOT NULL,
	`provider_payment_id` text,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`amount_minor` text NOT NULL,
	`currency` text NOT NULL,
	`currency_decimals` integer DEFAULT 2 NOT NULL,
	`exchange_rate_id` text,
	`exchange_rate` text DEFAULT '1' NOT NULL,
	`exchange_rate_direction` text DEFAULT 'parity' NOT NULL,
	`exchange_rate_source` text DEFAULT 'parity' NOT NULL,
	`exchange_rate_adjustment_bps` integer DEFAULT 0 NOT NULL,
	`exchange_rate_observed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`checkout_url` text,
	`provider_expires_at` integer,
	`succeeded_at` integer,
	`failure_code` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `shop_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wallet_topup_id`) REFERENCES `wallet_topups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `payment_channels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exchange_rate_id`) REFERENCES `exchange_rates`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "payment_attempts_amount_check" CHECK("amount_minor" <> '' AND "amount_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "payment_attempts_subject_check" CHECK(("__new_payment_attempts"."order_id" IS NOT NULL AND "__new_payment_attempts"."wallet_topup_id" IS NULL) OR
				("__new_payment_attempts"."order_id" IS NULL AND "__new_payment_attempts"."wallet_topup_id" IS NOT NULL)),
	CONSTRAINT "payment_attempts_currency_decimals_check" CHECK("__new_payment_attempts"."currency_decimals" BETWEEN 0 AND 8)
);
--> statement-breakpoint
INSERT INTO `__new_payment_attempts`("id", "order_id", "wallet_topup_id", "channel_id", "provider_payment_id", "idempotency_key", "status", "amount_minor", "currency", "currency_decimals", "exchange_rate_id", "exchange_rate", "exchange_rate_direction", "exchange_rate_source", "exchange_rate_adjustment_bps", "exchange_rate_observed_at", "checkout_url", "provider_expires_at", "succeeded_at", "failure_code", "created_at", "updated_at") SELECT "id", "order_id", NULL, "channel_id", "provider_payment_id", "idempotency_key", "status", "amount_minor", "currency", "currency_decimals", "exchange_rate_id", "exchange_rate", "exchange_rate_direction", "exchange_rate_source", "exchange_rate_adjustment_bps", "exchange_rate_observed_at", "checkout_url", "provider_expires_at", "succeeded_at", "failure_code", "created_at", "updated_at" FROM `payment_attempts`;--> statement-breakpoint
DROP TABLE `payment_attempts`;--> statement-breakpoint
ALTER TABLE `__new_payment_attempts` RENAME TO `payment_attempts`;--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempts_idempotency_uidx` ON `payment_attempts` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempts_channel_provider_uidx` ON `payment_attempts` (`channel_id`,`provider_payment_id`);--> statement-breakpoint
CREATE INDEX `payment_attempts_order_created_idx` ON `payment_attempts` (`order_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `payment_attempts_topup_created_idx` ON `payment_attempts` (`wallet_topup_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `payment_attempts_status_created_idx` ON `payment_attempts` (`status`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`preferred_locale` text DEFAULT 'en-US' NOT NULL,
	`image` text,
	`telegram_id` text,
	`telegram_username` text,
	`telegram_phone_number` text,
	`enabled` integer DEFAULT true NOT NULL,
	`balance_minor` text DEFAULT '0' NOT NULL,
	`balance_version` integer DEFAULT 1 NOT NULL,
	`customer_note` text,
	`last_ordered_at` integer,
	`role_ids` text DEFAULT '[]' NOT NULL,
	`disabled_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "users_role_ids_json_check" CHECK(json_valid("__new_users"."role_ids") AND json_type("__new_users"."role_ids") = 'array' AND json_array_length("__new_users"."role_ids") <= 32),
	CONSTRAINT "users_balance_check" CHECK("__new_users"."balance_minor" <> '' AND "__new_users"."balance_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "users_balance_version_check" CHECK("__new_users"."balance_version" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "email", "email_verified", "preferred_locale", "image", "telegram_id", "telegram_username", "telegram_phone_number", "enabled", "balance_minor", "balance_version", "customer_note", "last_ordered_at", "role_ids", "disabled_at", "created_at", "updated_at") SELECT "id", "name", "email", "email_verified", "preferred_locale", "image", "telegram_id", "telegram_username", "telegram_phone_number", "enabled", '0', 1, "customer_note", "last_ordered_at", "role_ids", "disabled_at", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_created_idx` ON `users` (`created_at`,`id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
