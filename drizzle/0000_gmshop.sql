CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`built_in` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`permissions_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "roles_permissions_json_check" CHECK(json_valid("roles"."permissions_json") AND json_type("roles"."permissions_json") = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_uidx` ON `roles` (`name`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`telegram_id` text,
	`telegram_username` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_provider_account_uidx` ON `accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
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
	`customer_note` text,
	`last_ordered_at` integer,
	`role_ids` text DEFAULT '[]' NOT NULL,
	`disabled_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "users_role_ids_json_check" CHECK(json_valid("users"."role_ids") AND json_type("users"."role_ids") = 'array' AND json_array_length("users"."role_ids") <= 32)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_created_idx` ON `users` (`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);--> statement-breakpoint
CREATE TABLE `after_sale_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`order_item_id` text,
	`case_number` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`reason` text NOT NULL,
	`resolution` text,
	`opened_by_user_id` text,
	`assigned_user_id` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `shop_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_item_id`) REFERENCES `shop_order_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opened_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `after_sale_cases_number_uidx` ON `after_sale_cases` (`case_number`);--> statement-breakpoint
CREATE INDEX `after_sale_cases_status_created_idx` ON `after_sale_cases` (`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `after_sale_cases_order_created_idx` ON `after_sale_cases` (`order_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `automation_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_job_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`checksum_sha256` text NOT NULL,
	`upload_status` text DEFAULT 'ready' NOT NULL,
	`download_enabled` integer DEFAULT true NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`delete_after` integer NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`automation_job_id`) REFERENCES `automation_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "automation_artifacts_size_check" CHECK("automation_artifacts"."size_bytes" > 0),
	CONSTRAINT "automation_artifacts_download_count_check" CHECK("automation_artifacts"."download_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_artifacts_object_key_uidx` ON `automation_artifacts` (`object_key`);--> statement-breakpoint
CREATE INDEX `automation_artifacts_job_created_idx` ON `automation_artifacts` (`automation_job_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `automation_artifacts_retention_idx` ON `automation_artifacts` (`delete_after`,`id`);--> statement-breakpoint
CREATE TABLE `automation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`entitlement_id` text NOT NULL,
	`order_item_id` text NOT NULL,
	`sellable_item_id` text NOT NULL,
	`automation_method_id` text NOT NULL,
	`definition_version_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_base_url` text NOT NULL,
	`repository_owner` text NOT NULL,
	`repository_name` text NOT NULL,
	`branch` text NOT NULL,
	`workflow_file` text NOT NULL,
	`method_key` text NOT NULL,
	`runtime` text NOT NULL,
	`command` text,
	`artifact_policy` text DEFAULT 'required' NOT NULL,
	`output_pattern` text NOT NULL,
	`callback_secret_encrypted` text NOT NULL,
	`callback_secret_key_version` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`notification_channel` text DEFAULT 'none' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`provider_job_id` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`timeout_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`run_url` text,
	`failure_code` text,
	`usage_restored_at` integer,
	`inputs_json` text DEFAULT '{}' NOT NULL,
	`sensitive_inputs_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`entitlement_id`) REFERENCES `customer_entitlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_item_id`) REFERENCES `shop_order_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sellable_item_id`) REFERENCES `product_sellable_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`automation_method_id`) REFERENCES `product_automation_methods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`definition_version_id`) REFERENCES `product_definition_versions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "automation_jobs_attempt_count_check" CHECK("automation_jobs"."attempt_count" >= 0),
	CONSTRAINT "automation_jobs_callback_key_version_check" CHECK("automation_jobs"."callback_secret_key_version" > 0),
	CONSTRAINT "automation_jobs_input_json_check" CHECK(json_valid("automation_jobs"."inputs_json") AND json_type("automation_jobs"."inputs_json") = 'object'
				AND json_valid("automation_jobs"."sensitive_inputs_json")
				AND json_type("automation_jobs"."sensitive_inputs_json") = 'object'),
	CONSTRAINT "automation_jobs_notification_channel_check" CHECK("automation_jobs"."notification_channel" IN ('none', 'email'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_jobs_idempotency_uidx` ON `automation_jobs` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `automation_jobs_item_provider_uidx` ON `automation_jobs` (`sellable_item_id`,`provider_job_id`);--> statement-breakpoint
CREATE INDEX `automation_jobs_entitlement_created_idx` ON `automation_jobs` (`entitlement_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `automation_jobs_status_attempt_idx` ON `automation_jobs` (`status`,`next_attempt_at`,`id`);--> statement-breakpoint
CREATE TABLE `commerce_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`session_id` text NOT NULL,
	`product_id` text,
	`sellable_item_id` text,
	`order_id` text,
	`currency` text,
	`amount_minor` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sellable_item_id`) REFERENCES `product_sellable_items`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "commerce_events_amount_check" CHECK("commerce_events"."amount_minor" IS NULL OR ("amount_minor" <> '' AND "amount_minor" NOT GLOB '*[^0-9]*'))
);
--> statement-breakpoint
CREATE INDEX `commerce_events_type_created_idx` ON `commerce_events` (`event_type`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `commerce_events_product_created_idx` ON `commerce_events` (`product_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `coupon_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`coupon_id` text NOT NULL,
	`order_id` text NOT NULL,
	`user_id` text,
	`normalized_email` text NOT NULL,
	`discount_minor` text NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`consumed_at` integer,
	`released_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `shop_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "coupon_redemptions_discount_check" CHECK("discount_minor" <> '' AND "discount_minor" NOT GLOB '*[^0-9]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupon_redemptions_order_uidx` ON `coupon_redemptions` (`order_id`);--> statement-breakpoint
CREATE INDEX `coupon_redemptions_coupon_email_idx` ON `coupon_redemptions` (`coupon_id`,`normalized_email`,`status`,`id`);--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text,
	`currency_decimals` integer,
	`value_minor` text,
	`value_bps` integer,
	`minimum_order_minor` text,
	`maximum_discount_minor` text,
	`usage_limit` integer,
	`usage_limit_per_customer` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`scope_json` text DEFAULT '{"productIds":[],"tagIds":[]}' NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "coupons_value_shape_check" CHECK(("coupons"."type" = 'fixed' AND "coupons"."currency" IS NOT NULL AND "coupons"."currency_decimals" IS NOT NULL AND "coupons"."value_minor" IS NOT NULL AND "coupons"."value_bps" IS NULL) OR
				("coupons"."type" = 'percentage' AND "coupons"."value_minor" IS NULL AND
				 "coupons"."value_bps" IS NOT NULL AND "coupons"."value_bps" BETWEEN 1 AND 10000)),
	CONSTRAINT "coupons_currency_shape_check" CHECK(("coupons"."currency" IS NULL AND "coupons"."currency_decimals" IS NULL) OR
				("coupons"."currency" IS NOT NULL AND "coupons"."currency_decimals" BETWEEN 0 AND 8)),
	CONSTRAINT "coupons_monetary_scope_check" CHECK(("coupons"."minimum_order_minor" IS NULL AND "coupons"."maximum_discount_minor" IS NULL) OR
				"coupons"."currency" IS NOT NULL),
	CONSTRAINT "coupons_minimum_order_check" CHECK("coupons"."minimum_order_minor" IS NULL OR ("minimum_order_minor" <> '' AND "minimum_order_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "coupons_maximum_discount_check" CHECK("coupons"."maximum_discount_minor" IS NULL OR ("maximum_discount_minor" <> '' AND "maximum_discount_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "coupons_used_count_check" CHECK("coupons"."used_count" >= 0),
	CONSTRAINT "coupons_usage_limit_check" CHECK("coupons"."usage_limit" IS NULL OR "coupons"."usage_limit" > 0),
	CONSTRAINT "coupons_customer_limit_check" CHECK("coupons"."usage_limit_per_customer" IS NULL OR "coupons"."usage_limit_per_customer" > 0),
	CONSTRAINT "coupons_scope_json_check" CHECK(json_valid("coupons"."scope_json") AND json_type("coupons"."scope_json") = 'object'
				AND json_type("coupons"."scope_json", '$.productIds') = 'array'
				AND json_type("coupons"."scope_json", '$.tagIds') = 'array')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_uidx` ON `coupons` (`code`);--> statement-breakpoint
CREATE INDEX `coupons_enabled_ends_idx` ON `coupons` (`enabled`,`ends_at`,`id`);--> statement-breakpoint
CREATE TABLE `customer_entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`order_item_id` text NOT NULL,
	`product_id` text NOT NULL,
	`sellable_item_id` text NOT NULL,
	`delivery_component_id` text NOT NULL,
	`entitlement_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`definition_version_id` text,
	`usage_limit` integer,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`access_limit` integer,
	`access_count` integer DEFAULT 0 NOT NULL,
	`activated_at` integer,
	`expires_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_item_id`) REFERENCES `shop_order_items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "customer_entitlements_type_check" CHECK("customer_entitlements"."entitlement_type" IN ('stock', 'download', 'automation')),
	CONSTRAINT "customer_entitlements_usage_count_check" CHECK("customer_entitlements"."usage_count" >= 0),
	CONSTRAINT "customer_entitlements_access_count_check" CHECK("customer_entitlements"."access_count" >= 0),
	CONSTRAINT "customer_entitlements_usage_limit_check" CHECK("customer_entitlements"."usage_limit" IS NULL OR "customer_entitlements"."usage_limit" > 0),
	CONSTRAINT "customer_entitlements_access_limit_check" CHECK("customer_entitlements"."access_limit" IS NULL OR "customer_entitlements"."access_limit" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_entitlements_order_item_uidx` ON `customer_entitlements` (`order_item_id`);--> statement-breakpoint
CREATE INDEX `customer_entitlements_user_status_idx` ON `customer_entitlements` (`user_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `delivery_records` (
	`id` text PRIMARY KEY NOT NULL,
	`order_item_id` text NOT NULL,
	`delivery_type` text NOT NULL,
	`request_key` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`content_encrypted` text,
	`content_key_version` integer,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`delivered_at` integer,
	`error_code` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_item_id`) REFERENCES `shop_order_items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "delivery_records_type_check" CHECK("delivery_records"."delivery_type" IN ('stock', 'download', 'automation')),
	CONSTRAINT "delivery_records_attempt_count_check" CHECK("delivery_records"."attempt_count" >= 0),
	CONSTRAINT "delivery_records_content_shape_check" CHECK(("delivery_records"."content_encrypted" IS NULL AND "delivery_records"."content_key_version" IS NULL) OR
				("delivery_records"."content_encrypted" IS NOT NULL AND "delivery_records"."content_key_version" > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_records_request_key_uidx` ON `delivery_records` (`request_key`);--> statement-breakpoint
CREATE INDEX `delivery_records_order_item_created_idx` ON `delivery_records` (`order_item_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `delivery_records_status_attempt_idx` ON `delivery_records` (`status`,`next_attempt_at`,`id`);--> statement-breakpoint
CREATE TABLE `download_asset_sellable_items` (
	`download_asset_id` text NOT NULL,
	`sellable_item_id` text NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	FOREIGN KEY (`download_asset_id`) REFERENCES `download_assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sellable_item_id`) REFERENCES `product_sellable_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `download_asset_sellable_items_asset_item_uidx` ON `download_asset_sellable_items` (`download_asset_id`,`sellable_item_id`);--> statement-breakpoint
CREATE INDEX `download_asset_sellable_items_item_sort_idx` ON `download_asset_sellable_items` (`sellable_item_id`,`sort_order`,`download_asset_id`);--> statement-breakpoint
CREATE TABLE `download_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`checksum_sha256` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`download_enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "download_assets_size_check" CHECK("download_assets"."size_bytes" > 0),
	CONSTRAINT "download_assets_version_check" CHECK("download_assets"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `download_assets_object_key_uidx` ON `download_assets` (`object_key`);--> statement-breakpoint
CREATE INDEX `download_assets_product_sort_idx` ON `download_assets` (`product_id`,`download_enabled`,`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `entitlement_authorization_values` (
	`id` text PRIMARY KEY NOT NULL,
	`entitlement_id` text NOT NULL,
	`definition_key` text NOT NULL,
	`value_encrypted` text NOT NULL,
	`key_version` integer NOT NULL,
	`masked_value` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`entitlement_id`) REFERENCES `customer_entitlements`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "entitlement_authorization_values_key_version_check" CHECK("entitlement_authorization_values"."key_version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entitlement_authorization_values_entitlement_key_uidx` ON `entitlement_authorization_values` (`entitlement_id`,`definition_key`);--> statement-breakpoint
CREATE TABLE `entitlement_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`entitlement_id` text NOT NULL,
	`event_type` text NOT NULL,
	`amount` integer,
	`source_type` text,
	`source_id` text,
	`asset_type` text,
	`asset_id` text,
	`consumed` integer,
	`actor_type` text,
	`idempotency_key` text,
	`request_id` text,
	`ip_address` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`entitlement_id`) REFERENCES `customer_entitlements`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entitlement_events_shape_check" CHECK((
				"entitlement_events"."kind" = 'usage'
				AND "entitlement_events"."event_type" IN ('consumed', 'restored')
				AND "entitlement_events"."amount" > 0
				AND "entitlement_events"."source_type" IS NOT NULL
				AND "entitlement_events"."source_id" IS NOT NULL
				AND "entitlement_events"."idempotency_key" IS NOT NULL
				AND "entitlement_events"."asset_type" IS NULL
				AND "entitlement_events"."asset_id" IS NULL
				AND "entitlement_events"."consumed" IS NULL
				AND "entitlement_events"."actor_type" IS NULL
				AND "entitlement_events"."request_id" IS NULL
				AND "entitlement_events"."ip_address" IS NULL
			) OR (
				"entitlement_events"."kind" = 'access'
				AND "entitlement_events"."event_type" IN ('revealed', 'downloaded', 'email_content_sent', 'copied', 'link_sent')
				AND "entitlement_events"."amount" IS NULL
				AND "entitlement_events"."source_type" IS NULL
				AND "entitlement_events"."source_id" IS NULL
				AND "entitlement_events"."asset_type" IS NOT NULL
				AND "entitlement_events"."asset_id" IS NOT NULL
				AND "entitlement_events"."consumed" IN (0, 1)
				AND "entitlement_events"."actor_type" IN ('customer', 'admin', 'system')
			))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entitlement_events_idempotency_uidx` ON `entitlement_events` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `entitlement_events_entitlement_created_idx` ON `entitlement_events` (`entitlement_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `entitlement_events_kind_created_idx` ON `entitlement_events` (`kind`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `entitlement_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`entitlement_id` text NOT NULL,
	`source_order_item_id` text NOT NULL,
	`renewed_from_entitlement_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`duration_ms` integer,
	`usage_granted` integer,
	`access_granted` integer,
	`activated_at` integer,
	`applied_at` integer,
	`revoked_at` integer,
	`revocation_reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`entitlement_id`) REFERENCES `customer_entitlements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_order_item_id`) REFERENCES `shop_order_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`renewed_from_entitlement_id`) REFERENCES `customer_entitlements`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entitlement_grants_duration_check" CHECK("entitlement_grants"."duration_ms" IS NULL OR "entitlement_grants"."duration_ms" > 0),
	CONSTRAINT "entitlement_grants_usage_check" CHECK("entitlement_grants"."usage_granted" IS NULL OR "entitlement_grants"."usage_granted" > 0),
	CONSTRAINT "entitlement_grants_access_check" CHECK("entitlement_grants"."access_granted" IS NULL OR "entitlement_grants"."access_granted" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entitlement_grants_source_order_item_uidx` ON `entitlement_grants` (`source_order_item_id`);--> statement-breakpoint
CREATE INDEX `entitlement_grants_entitlement_created_idx` ON `entitlement_grants` (`entitlement_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `exchange_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`base_currency` text NOT NULL,
	`quote_currency` text NOT NULL,
	`raw_rate` text NOT NULL,
	`rate` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`adjustment_bps` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`observed_at` integer NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "exchange_rates_pair_check" CHECK("exchange_rates"."base_currency" <> "exchange_rates"."quote_currency"),
	CONSTRAINT "exchange_rates_adjustment_bps_check" CHECK("exchange_rates"."adjustment_bps" BETWEEN -9999 AND 100000),
	CONSTRAINT "exchange_rates_expiry_check" CHECK("exchange_rates"."expires_at" IS NULL OR "exchange_rates"."expires_at" > "exchange_rates"."observed_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exchange_rates_pair_uidx` ON `exchange_rates` (`base_currency`,`quote_currency`);--> statement-breakpoint
CREATE INDEX `exchange_rates_sort_idx` ON `exchange_rates` (`sort_order`,`quote_currency`);--> statement-breakpoint
CREATE TABLE `notification_channel_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`api_key_encrypted` text,
	`api_key_version` integer,
	`domain` text,
	`region` text DEFAULT 'us' NOT NULL,
	`smtp_host` text,
	`smtp_port` integer,
	`smtp_user` text,
	`from_address` text NOT NULL,
	`reply_to` text,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`last_health_status` text DEFAULT 'unknown' NOT NULL,
	`last_checked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "notification_channel_configs_key_version_check" CHECK(("notification_channel_configs"."api_key_encrypted" IS NULL AND "notification_channel_configs"."api_key_version" IS NULL) OR
				("notification_channel_configs"."api_key_encrypted" IS NOT NULL AND "notification_channel_configs"."api_key_version" > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_channel_configs_channel_name_uidx` ON `notification_channel_configs` (`channel`,`name`);--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text,
	`subscription_id` text,
	`channel_config_id` text,
	`event` text NOT NULL,
	`channel` text NOT NULL,
	`locale` text DEFAULT 'en-US' NOT NULL,
	`idempotency_key` text NOT NULL,
	`message_encrypted` text NOT NULL,
	`message_key_version` integer NOT NULL,
	`provider_message_id` text,
	`entitlement_id` text,
	`asset_type` text,
	`asset_id` text,
	`access_event_type` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`delivered_at` integer,
	`error_code` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `notification_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subscription_id`) REFERENCES `notification_subscriptions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_config_id`) REFERENCES `notification_channel_configs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entitlement_id`) REFERENCES `customer_entitlements`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "notification_deliveries_attempt_count_check" CHECK("notification_deliveries"."attempt_count" >= 0),
	CONSTRAINT "notification_deliveries_message_version_check" CHECK("notification_deliveries"."message_key_version" > 0),
	CONSTRAINT "notification_deliveries_asset_shape_check" CHECK(("notification_deliveries"."entitlement_id" IS NULL AND "notification_deliveries"."asset_type" IS NULL AND
				 "notification_deliveries"."asset_id" IS NULL AND "notification_deliveries"."access_event_type" IS NULL) OR
				("notification_deliveries"."entitlement_id" IS NOT NULL AND "notification_deliveries"."asset_type" IS NOT NULL AND
				 "notification_deliveries"."asset_id" IS NOT NULL AND "notification_deliveries"."access_event_type" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_idempotency_uidx` ON `notification_deliveries` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_status_attempt_idx` ON `notification_deliveries` (`status`,`next_attempt_at`,`id`);--> statement-breakpoint
CREATE TABLE `notification_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event` text NOT NULL,
	`channel` text NOT NULL,
	`destination_encrypted` text,
	`destination_key_version` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notification_subscriptions_destination_check" CHECK(("notification_subscriptions"."destination_encrypted" IS NULL AND "notification_subscriptions"."destination_key_version" IS NULL) OR
				("notification_subscriptions"."destination_encrypted" IS NOT NULL AND "notification_subscriptions"."destination_key_version" > 0)),
	CONSTRAINT "notification_subscriptions_channel_check" CHECK("notification_subscriptions"."channel" = 'email')
);
--> statement-breakpoint
CREATE INDEX `notification_subscriptions_event_enabled_idx` ON `notification_subscriptions` (`event`,`enabled`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `notification_subscriptions_user_event_channel_uidx` ON `notification_subscriptions` (`user_id`,`event`,`channel`);--> statement-breakpoint
CREATE TABLE `notification_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`channel` text NOT NULL,
	`locale` text NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_templates_event_channel_locale_uidx` ON `notification_templates` (`event`,`channel`,`locale`);--> statement-breakpoint
CREATE TABLE `order_item_download_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`order_item_id` text NOT NULL,
	`download_asset_id` text,
	`asset_version` integer DEFAULT 1 NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`checksum_sha256` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_item_id`) REFERENCES `shop_order_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "order_item_download_assets_version_check" CHECK("order_item_download_assets"."asset_version" > 0),
	CONSTRAINT "order_item_download_assets_size_check" CHECK("order_item_download_assets"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_item_download_assets_item_asset_uidx` ON `order_item_download_assets` (`order_item_id`,`download_asset_id`);--> statement-breakpoint
CREATE INDEX `order_item_download_assets_item_created_idx` ON `order_item_download_assets` (`order_item_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `outbox_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`published_at` integer,
	`last_error_code` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "outbox_events_attempt_count_check" CHECK("outbox_events"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_events_idempotency_uidx` ON `outbox_events` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `outbox_events_status_attempt_idx` ON `outbox_events` (`status`,`next_attempt_at`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `outbox_events_aggregate_idx` ON `outbox_events` (`aggregate_type`,`aggregate_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `payment_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
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
	FOREIGN KEY (`channel_id`) REFERENCES `payment_channels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exchange_rate_id`) REFERENCES `exchange_rates`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "payment_attempts_amount_check" CHECK("amount_minor" <> '' AND "amount_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "payment_attempts_currency_decimals_check" CHECK("payment_attempts"."currency_decimals" BETWEEN 0 AND 8)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempts_idempotency_uidx` ON `payment_attempts` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_attempts_channel_provider_uidx` ON `payment_attempts` (`channel_id`,`provider_payment_id`);--> statement-breakpoint
CREATE INDEX `payment_attempts_order_created_idx` ON `payment_attempts` (`order_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `payment_attempts_status_created_idx` ON `payment_attempts` (`status`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `payment_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`default_token` text DEFAULT '' NOT NULL,
	`default_network` text DEFAULT '' NOT NULL,
	`logo_object_key` text,
	`logo_updated_at` integer,
	`credential_encrypted` text,
	`credential_key_version` integer,
	`fee_bps` integer DEFAULT 0 NOT NULL,
	`fixed_fee_minor` text DEFAULT '0' NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`last_health_status` text DEFAULT 'unknown' NOT NULL,
	`last_checked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "payment_channels_fee_bps_check" CHECK("payment_channels"."fee_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "payment_channels_fixed_fee_check" CHECK("fixed_fee_minor" <> '' AND "fixed_fee_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "payment_channels_default_asset_check" CHECK(("payment_channels"."default_token" = '' AND "payment_channels"."default_network" = '') OR
				("payment_channels"."default_token" <> '' AND "payment_channels"."default_network" <> '')),
	CONSTRAINT "payment_channels_credential_shape_check" CHECK(("payment_channels"."credential_encrypted" IS NULL AND "payment_channels"."credential_key_version" IS NULL) OR
				("payment_channels"."credential_encrypted" IS NOT NULL AND "payment_channels"."credential_key_version" > 0))
);
--> statement-breakpoint
CREATE INDEX `payment_channels_enabled_sort_idx` ON `payment_channels` (`enabled`,`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `product_automation_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`sellable_item_id` text NOT NULL,
	`config_version` integer NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`runtime` text NOT NULL,
	`branch` text,
	`command` text,
	`artifact_policy` text DEFAULT 'required' NOT NULL,
	`output_pattern` text NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`sellable_item_id`) REFERENCES `product_sellable_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "product_automation_methods_version_check" CHECK("product_automation_methods"."config_version" > 0),
	CONSTRAINT "product_automation_methods_artifact_shape_check" CHECK(("product_automation_methods"."artifact_policy" = 'none' AND "product_automation_methods"."output_pattern" = '') OR
				("product_automation_methods"."artifact_policy" IN ('optional', 'required') AND TRIM("product_automation_methods"."output_pattern") <> ''))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_automation_methods_config_version_key_uidx` ON `product_automation_methods` (`sellable_item_id`,`config_version`,`key`);--> statement-breakpoint
CREATE INDEX `product_automation_methods_config_version_sort_idx` ON `product_automation_methods` (`sellable_item_id`,`config_version`,`enabled`,`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `product_definition_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`sellable_item_id` text NOT NULL,
	`version` integer NOT NULL,
	`schema_json` text NOT NULL,
	`published_at` integer NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sellable_item_id`) REFERENCES `product_sellable_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "product_definition_versions_version_check" CHECK("product_definition_versions"."version" > 0),
	CONSTRAINT "product_definition_versions_schema_check" CHECK(json_valid("product_definition_versions"."schema_json") AND json_type("product_definition_versions"."schema_json") = 'array')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_definition_versions_item_version_uidx` ON `product_definition_versions` (`sellable_item_id`,`version`);--> statement-breakpoint
CREATE TABLE `product_media` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`object_key` text NOT NULL,
	`alt_text` text,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "product_media_size_bytes_check" CHECK("product_media"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_media_object_key_uidx` ON `product_media` (`object_key`);--> statement-breakpoint
CREATE INDEX `product_media_product_sort_idx` ON `product_media` (`product_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `product_sellable_items` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`duration_ms` integer,
	`usage_limit` integer,
	`access_limit` integer,
	`renewal_mode` text DEFAULT 'stack' NOT NULL,
	`email_mode` text DEFAULT 'none' NOT NULL,
	`show_on_order_page` integer DEFAULT true NOT NULL,
	`allow_resend` integer DEFAULT true NOT NULL,
	`fulfillment_source` text DEFAULT 'local' NOT NULL,
	`supplier_status` text,
	`low_stock_threshold` integer DEFAULT 5 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`automation_provider` text,
	`automation_base_url` text,
	`automation_repository_owner` text,
	`automation_repository_name` text,
	`automation_default_branch` text,
	`automation_workflow_file` text,
	`automation_credential_encrypted` text,
	`automation_credential_key_version` integer,
	`active_definition_version_id` text,
	`currency` text DEFAULT 'USD' NOT NULL,
	`currency_decimals` integer DEFAULT 2 NOT NULL,
	`list_price_minor` text,
	`price_minor` text NOT NULL,
	`cost_minor` text,
	`minimum_quantity` integer DEFAULT 1 NOT NULL,
	`maximum_quantity` integer DEFAULT 1 NOT NULL,
	`maximum_per_customer` integer,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "product_sellable_items_price_minor_check" CHECK("price_minor" <> '' AND "price_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "product_sellable_items_list_price_minor_check" CHECK("product_sellable_items"."list_price_minor" IS NULL OR ("list_price_minor" <> '' AND "list_price_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "product_sellable_items_cost_minor_check" CHECK("product_sellable_items"."cost_minor" IS NULL OR ("cost_minor" <> '' AND "cost_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "product_sellable_items_currency_decimals_check" CHECK("product_sellable_items"."currency_decimals" BETWEEN 0 AND 8),
	CONSTRAINT "product_sellable_items_minimum_quantity_check" CHECK("product_sellable_items"."minimum_quantity" > 0),
	CONSTRAINT "product_sellable_items_maximum_quantity_check" CHECK("product_sellable_items"."maximum_quantity" >= "product_sellable_items"."minimum_quantity"),
	CONSTRAINT "product_sellable_items_maximum_per_customer_check" CHECK("product_sellable_items"."maximum_per_customer" IS NULL OR "product_sellable_items"."maximum_per_customer" > 0),
	CONSTRAINT "product_sellable_items_duration_check" CHECK("product_sellable_items"."duration_ms" IS NULL OR "product_sellable_items"."duration_ms" > 0),
	CONSTRAINT "product_sellable_items_usage_limit_check" CHECK("product_sellable_items"."usage_limit" IS NULL OR "product_sellable_items"."usage_limit" > 0),
	CONSTRAINT "product_sellable_items_access_limit_check" CHECK("product_sellable_items"."access_limit" IS NULL OR "product_sellable_items"."access_limit" > 0),
	CONSTRAINT "product_sellable_items_version_check" CHECK("product_sellable_items"."version" > 0),
	CONSTRAINT "product_sellable_items_fulfillment_source_check" CHECK("product_sellable_items"."fulfillment_source" IN ('local', 'supplier')),
	CONSTRAINT "product_sellable_items_supplier_status_check" CHECK(("product_sellable_items"."fulfillment_source" = 'local' AND "product_sellable_items"."supplier_status" IS NULL) OR
				("product_sellable_items"."fulfillment_source" = 'supplier' AND "product_sellable_items"."supplier_status" IS NOT NULL)),
	CONSTRAINT "product_sellable_items_automation_credential_check" CHECK(("product_sellable_items"."automation_credential_encrypted" IS NULL AND "product_sellable_items"."automation_credential_key_version" IS NULL) OR
				("product_sellable_items"."automation_credential_encrypted" IS NOT NULL AND "product_sellable_items"."automation_credential_key_version" > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_sellable_items_product_name_uidx` ON `product_sellable_items` (`product_id`,`name`);--> statement-breakpoint
CREATE INDEX `product_sellable_items_product_enabled_sort_idx` ON `product_sellable_items` (`product_id`,`enabled`,`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `product_tag_links` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `product_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_tag_links_product_tag_uidx` ON `product_tag_links` (`product_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `product_tag_links_tag_product_idx` ON `product_tag_links` (`tag_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `product_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_tags_normalized_name_uidx` ON `product_tags` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `product_tags_name_idx` ON `product_tags` (`name`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`product_type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`trashed_at` integer,
	`cover_object_key` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`revision_token` text DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`sort_order` integer DEFAULT 100 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "products_revision_check" CHECK("products"."revision" > 0),
	CONSTRAINT "products_status_check" CHECK("products"."status" IN ('draft', 'active', 'trashed')),
	CONSTRAINT "products_trash_shape_check" CHECK(("products"."status" = 'trashed' AND "products"."trashed_at" IS NOT NULL) OR
				("products"."status" <> 'trashed' AND "products"."trashed_at" IS NULL)),
	CONSTRAINT "products_product_type_check" CHECK("products"."product_type" IN ('stock', 'download', 'automation'))
);
--> statement-breakpoint
CREATE TRIGGER `product_sellable_items_supplier_stock_insert_trigger`
BEFORE INSERT ON `product_sellable_items`
WHEN NEW.`fulfillment_source` = 'supplier'
 AND NOT EXISTS (
	SELECT 1 FROM `products`
	WHERE `products`.`id` = NEW.`product_id` AND `products`.`product_type` = 'stock'
 )
BEGIN
	SELECT RAISE(ABORT, 'supplier_fulfillment_requires_stock_product');
END;--> statement-breakpoint
CREATE TRIGGER `product_sellable_items_supplier_stock_update_trigger`
BEFORE UPDATE OF `fulfillment_source`, `product_id` ON `product_sellable_items`
WHEN NEW.`fulfillment_source` = 'supplier'
 AND NOT EXISTS (
	SELECT 1 FROM `products`
	WHERE `products`.`id` = NEW.`product_id` AND `products`.`product_type` = 'stock'
 )
BEGIN
	SELECT RAISE(ABORT, 'supplier_fulfillment_requires_stock_product');
END;--> statement-breakpoint
CREATE TRIGGER `products_supplier_stock_type_trigger`
BEFORE UPDATE OF `product_type` ON `products`
WHEN NEW.`product_type` <> 'stock'
 AND EXISTS (
	SELECT 1 FROM `product_sellable_items`
	WHERE `product_sellable_items`.`product_id` = NEW.`id`
	 AND `product_sellable_items`.`fulfillment_source` = 'supplier'
 )
BEGIN
	SELECT RAISE(ABORT, 'supplier_fulfillment_requires_stock_product');
END;--> statement-breakpoint
CREATE INDEX `products_status_sort_idx` ON `products` (`status`,`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`payment_attempt_id` text,
	`provider_refund_id` text,
	`idempotency_key` text NOT NULL,
	`amount_minor` text NOT NULL,
	`currency` text NOT NULL,
	`payment_amount_minor` text NOT NULL,
	`payment_currency` text NOT NULL,
	`payment_currency_decimals` integer NOT NULL,
	`order_status_before` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text NOT NULL,
	`requested_by` text,
	`completed_at` integer,
	`failure_code` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `shop_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "refunds_amount_check" CHECK("amount_minor" <> '' AND "amount_minor" NOT GLOB '*[^0-9]*' AND "refunds"."amount_minor" <> '0'),
	CONSTRAINT "refunds_payment_amount_check" CHECK("payment_amount_minor" <> '' AND "payment_amount_minor" NOT GLOB '*[^0-9]*' AND "refunds"."payment_amount_minor" <> '0'),
	CONSTRAINT "refunds_payment_currency_decimals_check" CHECK("refunds"."payment_currency_decimals" BETWEEN 0 AND 8),
	CONSTRAINT "refunds_attempt_count_check" CHECK("refunds"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refunds_idempotency_uidx` ON `refunds` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `refunds_attempt_provider_uidx` ON `refunds` (`payment_attempt_id`,`provider_refund_id`);--> statement-breakpoint
CREATE INDEX `refunds_order_created_idx` ON `refunds` (`order_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `replay_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace` text NOT NULL,
	`scope_id` text NOT NULL,
	`payment_attempt_id` text,
	`external_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_digest` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`failure_code` text,
	`processed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `replay_receipts_namespace_scope_external_uidx` ON `replay_receipts` (`namespace`,`scope_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `replay_receipts_status_created_idx` ON `replay_receipts` (`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `replay_receipts_namespace_created_idx` ON `replay_receipts` (`namespace`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `shop_order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`event_type` text NOT NULL,
	`visibility` text DEFAULT 'internal' NOT NULL,
	`from_status` text,
	`to_status` text,
	`order_version` integer,
	`after_sale_case_id` text,
	`case_action` text,
	`note` text,
	`actor_type` text NOT NULL,
	`actor_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `shop_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "shop_order_events_transition_check" CHECK(("shop_order_events"."from_status" IS NULL AND "shop_order_events"."to_status" IS NULL) OR
				("shop_order_events"."from_status" IS NOT NULL AND "shop_order_events"."to_status" IS NOT NULL AND
				 "shop_order_events"."from_status" <> "shop_order_events"."to_status")),
	CONSTRAINT "shop_order_events_version_check" CHECK("shop_order_events"."order_version" IS NULL OR "shop_order_events"."order_version" > 0),
	CONSTRAINT "shop_order_events_case_shape_check" CHECK(("shop_order_events"."after_sale_case_id" IS NULL AND "shop_order_events"."case_action" IS NULL) OR
				("shop_order_events"."after_sale_case_id" IS NOT NULL AND "shop_order_events"."case_action" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `shop_order_events_order_created_idx` ON `shop_order_events` (`order_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `shop_order_events_type_created_idx` ON `shop_order_events` (`event_type`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `shop_order_events_case_created_idx` ON `shop_order_events` (`after_sale_case_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shop_order_events_order_version_uidx` ON `shop_order_events` (`order_id`,`order_version`);--> statement-breakpoint
CREATE TABLE `shop_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`sellable_item_id` text NOT NULL,
	`product_name` text NOT NULL,
	`delivery_component_id` text NOT NULL,
	`delivery_component_type` text NOT NULL,
	`delivery_component_version` integer NOT NULL,
	`sellable_item_name` text NOT NULL,
	`definition_version_id` text,
	`input_values_json` text DEFAULT '{}' NOT NULL,
	`sensitive_input_values_json` text DEFAULT '{}' NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_minor` text NOT NULL,
	`unit_cost_minor` text,
	`discount_minor` text DEFAULT '0' NOT NULL,
	`subtotal_minor` text NOT NULL,
	`renewed_from_entitlement_id` text,
	`duration_ms` integer,
	`usage_limit` integer,
	`access_limit` integer,
	`activation_trigger` text DEFAULT 'delivery_completed' NOT NULL,
	`exhaustion_rule` text DEFAULT 'first_limit_reached' NOT NULL,
	`renewal_mode` text DEFAULT 'stack' NOT NULL,
	`show_on_order_page` integer DEFAULT true NOT NULL,
	`account_library_enabled` integer DEFAULT true NOT NULL,
	`email_mode` text DEFAULT 'none' NOT NULL,
	`allow_resend` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `shop_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "shop_order_items_delivery_component_type_check" CHECK("shop_order_items"."delivery_component_type" IN ('stock', 'download', 'automation')),
	CONSTRAINT "shop_order_items_quantity_check" CHECK("shop_order_items"."quantity" > 0),
	CONSTRAINT "shop_order_items_unit_price_check" CHECK("unit_price_minor" <> '' AND "unit_price_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "shop_order_items_unit_cost_check" CHECK("shop_order_items"."unit_cost_minor" IS NULL OR ("unit_cost_minor" <> '' AND "unit_cost_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "shop_order_items_discount_check" CHECK("discount_minor" <> '' AND "discount_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "shop_order_items_subtotal_check" CHECK("subtotal_minor" <> '' AND "subtotal_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "shop_order_items_duration_check" CHECK("shop_order_items"."duration_ms" IS NULL OR "shop_order_items"."duration_ms" > 0),
	CONSTRAINT "shop_order_items_usage_limit_check" CHECK("shop_order_items"."usage_limit" IS NULL OR "shop_order_items"."usage_limit" > 0),
	CONSTRAINT "shop_order_items_access_limit_check" CHECK("shop_order_items"."access_limit" IS NULL OR "shop_order_items"."access_limit" > 0),
	CONSTRAINT "shop_order_items_email_content_check" CHECK("shop_order_items"."email_mode" <> 'content' OR
				("shop_order_items"."delivery_component_type" = 'stock' AND
				 "shop_order_items"."duration_ms" IS NULL AND "shop_order_items"."usage_limit" IS NULL AND
				 "shop_order_items"."access_limit" IS NULL)),
	CONSTRAINT "shop_order_items_account_library_check" CHECK("shop_order_items"."account_library_enabled" = true),
	CONSTRAINT "shop_order_items_input_json_check" CHECK(json_valid("shop_order_items"."input_values_json") AND json_type("shop_order_items"."input_values_json") = 'object'
				AND json_valid("shop_order_items"."sensitive_input_values_json")
				AND json_type("shop_order_items"."sensitive_input_values_json") = 'object')
);
--> statement-breakpoint
CREATE INDEX `shop_order_items_order_idx` ON `shop_order_items` (`order_id`,`id`);--> statement-breakpoint
CREATE INDEX `shop_order_items_sellable_item_idx` ON `shop_order_items` (`sellable_item_id`,`id`);--> statement-breakpoint
CREATE TABLE `shop_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`idempotency_key` text,
	`user_id` text,
	`contact_email` text,
	`normalized_contact_email` text,
	`locale` text DEFAULT 'en-US' NOT NULL,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`currency` text NOT NULL,
	`currency_decimals` integer NOT NULL,
	`subtotal_minor` text NOT NULL,
	`discount_minor` text DEFAULT '0' NOT NULL,
	`total_minor` text NOT NULL,
	`paid_minor` text DEFAULT '0' NOT NULL,
	`coupon_id` text,
	`customer_note` text,
	`admin_note` text,
	`version` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	`paid_at` integer,
	`completed_at` integer,
	`cancelled_at` integer,
	`refunded_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shop_orders_currency_decimals_check" CHECK("shop_orders"."currency_decimals" BETWEEN 0 AND 8),
	CONSTRAINT "shop_orders_subtotal_minor_check" CHECK("subtotal_minor" <> '' AND "subtotal_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "shop_orders_discount_minor_check" CHECK("discount_minor" <> '' AND "discount_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "shop_orders_total_minor_check" CHECK("total_minor" <> '' AND "total_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "shop_orders_paid_minor_check" CHECK("paid_minor" <> '' AND "paid_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "shop_orders_version_check" CHECK("shop_orders"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shop_orders_number_uidx` ON `shop_orders` (`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `shop_orders_idempotency_uidx` ON `shop_orders` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `shop_orders_status_created_idx` ON `shop_orders` (`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `shop_orders_status_expires_idx` ON `shop_orders` (`status`,`expires_at`,`id`);--> statement-breakpoint
CREATE INDEX `shop_orders_user_created_idx` ON `shop_orders` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `shop_orders_email_created_idx` ON `shop_orders` (`normalized_contact_email`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `shopping_carts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`items_json` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "shopping_carts_version_check" CHECK("shopping_carts"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_carts_user_uidx` ON `shopping_carts` (`user_id`);--> statement-breakpoint
CREATE INDEX `shopping_carts_expiry_idx` ON `shopping_carts` (`expires_at`,`id`);--> statement-breakpoint
CREATE TABLE `stock_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`sellable_item_id` text NOT NULL,
	`content_encrypted` text NOT NULL,
	`key_version` integer NOT NULL,
	`content_fingerprint` text NOT NULL,
	`content_mask` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`order_item_id` text,
	`supplier_order_id` text,
	`note` text,
	`reserved_at` integer,
	`delivered_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`sellable_item_id`) REFERENCES `product_sellable_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_item_id`) REFERENCES `shop_order_items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_entries_key_version_check" CHECK("stock_entries"."key_version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_entries_item_fingerprint_uidx` ON `stock_entries` (`sellable_item_id`,`content_fingerprint`);--> statement-breakpoint
CREATE INDEX `stock_entries_item_status_created_idx` ON `stock_entries` (`sellable_item_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `stock_entries_order_item_idx` ON `stock_entries` (`order_item_id`);--> statement-breakpoint
CREATE INDEX `stock_entries_supplier_order_idx` ON `stock_entries` (`supplier_order_id`);--> statement-breakpoint
CREATE TABLE `supplier_accounts` (
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
	CONSTRAINT "supplier_accounts_provider_check" CHECK("supplier_accounts"."provider" IN ('acg', 'dujiao_next')),
	CONSTRAINT "supplier_accounts_currency_decimals_check" CHECK("supplier_accounts"."currency_decimals" BETWEEN 0 AND 8),
	CONSTRAINT "supplier_accounts_credentials_revision_check" CHECK("supplier_accounts"."credentials_revision" > 0),
	CONSTRAINT "supplier_accounts_balance_check" CHECK("supplier_accounts"."balance_minor" IS NULL OR ("balance_minor" <> '' AND "balance_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "supplier_accounts_reserve_balance_check" CHECK("reserve_balance_minor" <> '' AND "reserve_balance_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "supplier_accounts_low_balance_check" CHECK("low_balance_minor" <> '' AND "low_balance_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "supplier_accounts_max_order_cost_check" CHECK("supplier_accounts"."max_order_cost_minor" IS NULL OR ("max_order_cost_minor" <> '' AND "max_order_cost_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "supplier_accounts_failures_check" CHECK("supplier_accounts"."consecutive_failures" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_accounts_source_name_uidx` ON `supplier_accounts` (`provider`,`normalized_api_origin`,`protocol_version`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_accounts_source_credential_uidx` ON `supplier_accounts` (`provider`,`normalized_api_origin`,`protocol_version`,`credential_fingerprint`);--> statement-breakpoint
CREATE INDEX `supplier_accounts_source_eligible_idx` ON `supplier_accounts` (`provider`,`normalized_api_origin`,`protocol_version`,`enabled`,`health_status`,`cooldown_until`,`last_selected_at`,`id`);--> statement-breakpoint
CREATE TABLE `supplier_bindings` (
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
	CONSTRAINT "supplier_bindings_provider_check" CHECK("supplier_bindings"."provider" IN ('acg', 'dujiao_next')),
	CONSTRAINT "supplier_bindings_reference_cost_check" CHECK("reference_cost_minor" <> '' AND "reference_cost_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "supplier_bindings_max_cost_check" CHECK("max_cost_minor" <> '' AND "max_cost_minor" NOT GLOB '*[^0-9]*'),
	CONSTRAINT "supplier_bindings_stock_quantity_check" CHECK("supplier_bindings"."stock_quantity" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_bindings_enabled_item_uidx` ON `supplier_bindings` (`sellable_item_id`) WHERE "supplier_bindings"."enabled" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_bindings_enabled_source_sku_uidx` ON `supplier_bindings` (`provider`,`normalized_api_origin`,`protocol_version`,`upstream_product_id`,`upstream_sku_id`) WHERE "supplier_bindings"."enabled" = 1;--> statement-breakpoint
CREATE INDEX `supplier_bindings_source_status_sync_idx` ON `supplier_bindings` (`provider`,`normalized_api_origin`,`protocol_version`,`enabled`,`remote_status`,`last_synced_at`,`id`);--> statement-breakpoint
CREATE TABLE `supplier_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`order_item_id` text NOT NULL,
	`delivery_record_id` text NOT NULL,
	`supplier_binding_id` text NOT NULL,
	`selected_account_id` text,
	`selected_credentials_revision` integer,
	`provider_request_no` text,
	`upstream_order_id` text,
	`quantity` integer NOT NULL,
	`quoted_unit_cost_minor` text,
	`total_cost_minor` text,
	`currency` text NOT NULL,
	`binding_snapshot_json` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`selection_count` integer DEFAULT 0 NOT NULL,
	`account_locked_at` integer,
	`next_retry_at` integer,
	`last_error_code` text,
	`last_error_message_redacted` text,
	`submitted_at` integer,
	`supplied_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `shop_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_item_id`) REFERENCES `shop_order_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`delivery_record_id`) REFERENCES `delivery_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_binding_id`) REFERENCES `supplier_bindings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`selected_account_id`) REFERENCES `supplier_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "supplier_orders_quantity_check" CHECK("supplier_orders"."quantity" > 0),
	CONSTRAINT "supplier_orders_quoted_cost_check" CHECK("supplier_orders"."quoted_unit_cost_minor" IS NULL OR ("quoted_unit_cost_minor" <> '' AND "quoted_unit_cost_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "supplier_orders_total_cost_check" CHECK("supplier_orders"."total_cost_minor" IS NULL OR ("total_cost_minor" <> '' AND "total_cost_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "supplier_orders_attempt_count_check" CHECK("supplier_orders"."attempt_count" >= 0),
	CONSTRAINT "supplier_orders_selection_count_check" CHECK("supplier_orders"."selection_count" >= 0),
	CONSTRAINT "supplier_orders_account_shape_check" CHECK(("supplier_orders"."selected_account_id" IS NULL AND
				 "supplier_orders"."selected_credentials_revision" IS NULL AND
				 "supplier_orders"."provider_request_no" IS NULL AND
				 "supplier_orders"."account_locked_at" IS NULL) OR
				("supplier_orders"."selected_account_id" IS NOT NULL AND
				 "supplier_orders"."selected_credentials_revision" > 0 AND
				 "supplier_orders"."provider_request_no" IS NOT NULL)),
	CONSTRAINT "supplier_orders_cost_shape_check" CHECK(("supplier_orders"."quoted_unit_cost_minor" IS NULL AND "supplier_orders"."total_cost_minor" IS NULL) OR
				("supplier_orders"."quoted_unit_cost_minor" IS NOT NULL AND "supplier_orders"."total_cost_minor" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_orders_order_item_uidx` ON `supplier_orders` (`order_item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_orders_account_request_uidx` ON `supplier_orders` (`selected_account_id`,`provider_request_no`);--> statement-breakpoint
CREATE INDEX `supplier_orders_state_retry_idx` ON `supplier_orders` (`state`,`next_retry_at`,`id`);--> statement-breakpoint
CREATE INDEX `supplier_orders_account_state_idx` ON `supplier_orders` (`selected_account_id`,`state`,`id`);--> statement-breakpoint
CREATE INDEX `supplier_orders_upstream_order_idx` ON `supplier_orders` (`selected_account_id`,`upstream_order_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`request_id` text,
	`ip_address` text,
	`before` text,
	`after` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `operation_task_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task` text NOT NULL,
	`trigger` text NOT NULL,
	`schedule` text,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`duration_ms` integer,
	`error_code` text,
	`result` text,
	`artifact_object_key` text,
	`requested_by` text,
	`record_count` integer,
	`delete_after` integer,
	`artifact_deleted_at` integer,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operation_task_runs_artifact_object_uidx` ON `operation_task_runs` (`artifact_object_key`);--> statement-breakpoint
CREATE INDEX `operation_task_runs_task_started_idx` ON `operation_task_runs` (`task`,`started_at`);--> statement-breakpoint
CREATE INDEX `operation_task_runs_retention_idx` ON `operation_task_runs` (`completed_at`,`id`) WHERE "operation_task_runs"."status" IN ('succeeded', 'failed');--> statement-breakpoint
CREATE INDEX `operation_task_runs_artifact_retention_idx` ON `operation_task_runs` (`delete_after`,`id`) WHERE "operation_task_runs"."artifact_object_key" IS NOT NULL AND "operation_task_runs"."artifact_deleted_at" IS NULL;--> statement-breakpoint
CREATE TABLE `rate_limit_counters` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket_key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "rate_limit_counters_count_check" CHECK("rate_limit_counters"."count" > 0),
	CONSTRAINT "rate_limit_counters_expiry_check" CHECK("rate_limit_counters"."expires_at" > "rate_limit_counters"."window_start")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_counters_bucket_window_uidx` ON `rate_limit_counters` (`bucket_key`,`window_start`);--> statement-breakpoint
CREATE INDEX `rate_limit_counters_expiry_idx` ON `rate_limit_counters` (`expires_at`,`id`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`is_secret` integer DEFAULT false NOT NULL,
	`updated_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
