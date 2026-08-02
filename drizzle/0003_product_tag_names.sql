PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `products` ADD `tag_names` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `products` AS product
SET `tag_names` = COALESCE((
 SELECT json_group_array(tag_name.`name`)
 FROM (
  SELECT DISTINCT trim(tag.`name`) AS `name`
  FROM `product_tag_links` link
  JOIN `product_tags` tag ON tag.`id` = link.`tag_id`
  WHERE link.`product_id` = product.`id` AND trim(tag.`name`) <> ''
 ) tag_name
), '[]');--> statement-breakpoint
CREATE TABLE `__new_coupons` (
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
	`scope_json` text DEFAULT '{"productIds":[],"tagNames":[]}' NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "coupons_value_shape_check" CHECK(("__new_coupons"."type" = 'fixed' AND "__new_coupons"."currency" IS NOT NULL AND "__new_coupons"."currency_decimals" IS NOT NULL AND "__new_coupons"."value_minor" IS NOT NULL AND "__new_coupons"."value_bps" IS NULL) OR
				("__new_coupons"."type" = 'percentage' AND "__new_coupons"."value_minor" IS NULL AND
				 "__new_coupons"."value_bps" IS NOT NULL AND "__new_coupons"."value_bps" BETWEEN 1 AND 10000)),
	CONSTRAINT "coupons_currency_shape_check" CHECK(("__new_coupons"."currency" IS NULL AND "__new_coupons"."currency_decimals" IS NULL) OR
				("__new_coupons"."currency" IS NOT NULL AND "__new_coupons"."currency_decimals" BETWEEN 0 AND 8)),
	CONSTRAINT "coupons_monetary_scope_check" CHECK(("__new_coupons"."minimum_order_minor" IS NULL AND "__new_coupons"."maximum_discount_minor" IS NULL) OR
				"__new_coupons"."currency" IS NOT NULL),
	CONSTRAINT "coupons_minimum_order_check" CHECK("__new_coupons"."minimum_order_minor" IS NULL OR ("minimum_order_minor" <> '' AND "minimum_order_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "coupons_maximum_discount_check" CHECK("__new_coupons"."maximum_discount_minor" IS NULL OR ("maximum_discount_minor" <> '' AND "maximum_discount_minor" NOT GLOB '*[^0-9]*')),
	CONSTRAINT "coupons_used_count_check" CHECK("__new_coupons"."used_count" >= 0),
	CONSTRAINT "coupons_usage_limit_check" CHECK("__new_coupons"."usage_limit" IS NULL OR "__new_coupons"."usage_limit" > 0),
	CONSTRAINT "coupons_customer_limit_check" CHECK("__new_coupons"."usage_limit_per_customer" IS NULL OR "__new_coupons"."usage_limit_per_customer" > 0),
	CONSTRAINT "coupons_scope_json_check" CHECK(json_valid("__new_coupons"."scope_json") AND json_type("__new_coupons"."scope_json") = 'object'
				AND json_type("__new_coupons"."scope_json", '$.productIds') = 'array'
				AND json_type("__new_coupons"."scope_json", '$.tagNames') = 'array')
);
--> statement-breakpoint
INSERT INTO `__new_coupons`("id", "code", "name", "type", "currency", "currency_decimals", "value_minor", "value_bps", "minimum_order_minor", "maximum_discount_minor", "usage_limit", "usage_limit_per_customer", "used_count", "scope_json", "starts_at", "ends_at", "enabled", "created_at", "updated_at")
SELECT coupon."id", coupon."code", coupon."name", coupon."type", coupon."currency", coupon."currency_decimals", coupon."value_minor", coupon."value_bps", coupon."minimum_order_minor", coupon."maximum_discount_minor", coupon."usage_limit", coupon."usage_limit_per_customer", coupon."used_count",
 json_set(
  json_remove(coupon."scope_json", '$.tagIds'),
  '$.tagNames',
  json(COALESCE((
   SELECT json_group_array(DISTINCT trim(tag."name"))
   FROM json_each(coupon."scope_json", '$.tagIds') scope_tag
   JOIN `product_tags` tag ON tag."id" = scope_tag.value
   WHERE trim(tag."name") <> ''
  ), '[]'))
 ),
 coupon."starts_at", coupon."ends_at", coupon."enabled", coupon."created_at", coupon."updated_at"
FROM `coupons` coupon;--> statement-breakpoint
DROP TABLE `coupons`;--> statement-breakpoint
ALTER TABLE `__new_coupons` RENAME TO `coupons`;--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_uidx` ON `coupons` (`code`);--> statement-breakpoint
CREATE INDEX `coupons_enabled_ends_idx` ON `coupons` (`enabled`,`ends_at`,`id`);--> statement-breakpoint
DROP TABLE `product_tag_links`;--> statement-breakpoint
DROP TABLE `product_tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
