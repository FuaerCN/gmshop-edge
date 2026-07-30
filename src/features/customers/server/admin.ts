import { createServerFn } from "@tanstack/react-start";
import type { z } from "zod";
import {
	hasSystemPermission,
	systemPermission,
} from "#/features/access/system-rbac";
import { isInternalIdentityEmail } from "#/features/auth/identity-email";
import { verifySensitiveAdminAction } from "#/features/auth/server/reauthenticate";
import {
	customerIdSchema,
	customerListSchema,
	customerSensitiveActionSchema,
	customerUpdateSchema,
} from "#/features/customers/schema";
import {
	type ListedUserRow,
	listedUserCommerceProjection,
	listedUsersCte,
	listUsersWithCommerce,
	presentListedUser,
} from "#/features/users/server/list";
import { DomainError } from "#/lib/domain-error";
import { createAuditStatement } from "#/server/audit";
import {
	getAdminServerContext,
	getAdminServerContextAny,
} from "#/server/context";
import { prepareCustomerDataDeletion } from "./privacy";

export const listUsersWithCommerceFn = createServerFn({ method: "GET" })
	.validator((input: z.input<typeof customerListSchema>) =>
		customerListSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const { currentUser, db } = await getAdminServerContextAny([
			systemPermission("customers", "read"),
			systemPermission("users", "read"),
		]);
		const includeCommerce = hasSystemPermission(
			currentUser.permissions,
			systemPermission("customers", "read"),
		);
		return listUsersWithCommerce(db.$client, data, includeCommerce);
	});

export const getCustomerFn = createServerFn({ method: "GET" })
	.validator((input: z.input<typeof customerIdSchema>) =>
		customerIdSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const { db } = await getAdminServerContext(
			systemPermission("customers", "read"),
		);
		const customer = await db.$client
			.prepare(
				`${listedUsersCte} ${listedUserCommerceProjection} WHERE c.id = ? LIMIT 1`,
			)
			.bind(data.id)
			.first<ListedUserRow>();
		if (!customer)
			throw new DomainError("customer_not_found", 404, "Customer not found");
		const scope = customerScope(customer);
		const [orders, entitlements] = await Promise.all([
			db.$client
				.prepare(
					`SELECT id, order_number, status, currency, currency_decimals,
					 total_minor, created_at FROM shop_orders WHERE ${scope.condition}
					 ORDER BY created_at DESC, id DESC LIMIT 10`,
				)
				.bind(...scope.bindings)
				.all(),
			db.$client
				.prepare(
					`SELECT ce.id, ce.entitlement_type, ce.status, ce.usage_limit,
					 ce.usage_count, ce.access_limit, ce.access_count, ce.activated_at,
					 ce.expires_at, p.name AS product_name, s.name AS sellable_item_name
					 FROM customer_entitlements ce
					 JOIN shop_order_items oi ON oi.id = ce.order_item_id
					 JOIN shop_orders o ON o.id = oi.order_id
					 LEFT JOIN products p ON p.id = ce.product_id
					 LEFT JOIN product_sellable_items s ON s.id = ce.sellable_item_id
					 WHERE ${scope.entitlementCondition}
					 ORDER BY ce.created_at DESC, ce.id DESC LIMIT 20`,
				)
				.bind(...scope.bindings)
				.all(),
		]);
		return {
			...presentListedUser(customer),
			orders: orders.results.map((row) => ({
				id: String(row.id),
				orderNumber: String(row.order_number),
				status: String(row.status),
				currency: String(row.currency),
				currencyDecimals: Number(row.currency_decimals),
				totalMinor: String(row.total_minor),
				createdAt: Number(row.created_at),
			})),
			entitlements: entitlements.results.map((row) => ({
				id: String(row.id),
				type: String(row.entitlement_type),
				status: String(row.status),
				productName: row.product_name ? String(row.product_name) : null,
				sellableItemName: row.sellable_item_name
					? String(row.sellable_item_name)
					: null,
				usageLimit: row.usage_limit == null ? null : Number(row.usage_limit),
				usageCount: Number(row.usage_count),
				accessLimit: row.access_limit == null ? null : Number(row.access_limit),
				accessCount: Number(row.access_count),
				activatedAt: row.activated_at == null ? null : Number(row.activated_at),
				expiresAt: row.expires_at == null ? null : Number(row.expires_at),
			})),
		};
	});

export const updateCustomerFn = createServerFn({ method: "POST" })
	.validator((input: z.input<typeof customerUpdateSchema>) =>
		customerUpdateSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const { currentUser, db, request } = await getAdminServerContext(
			systemPermission("customers", "update"),
		);
		const before = await db.$client
			.prepare(
				`SELECT id, name, customer_note AS note,
				 CASE WHEN enabled = 1 THEN 'active' ELSE 'disabled' END AS status
				 FROM users WHERE id = ? LIMIT 1`,
			)
			.bind(data.id)
			.first<Record<string, unknown>>();
		if (!before)
			throw new DomainError("customer_not_found", 404, "User not found");
		const now = Date.now();
		await db.$client.batch([
			db.$client
				.prepare(
					"UPDATE users SET name = ?, customer_note = ?, enabled = ?, updated_at = ? WHERE id = ?",
				)
				.bind(
					data.name,
					data.note,
					data.status === "active" ? 1 : 0,
					now,
					data.id,
				),
			createAuditStatement(db.$client, request, currentUser.id, {
				action: "customer.updated",
				targetType: "user",
				targetId: data.id,
				before,
				after: data,
			}),
		]);
		return { id: data.id };
	});

export const exportCustomerDataFn = createServerFn({ method: "POST" })
	.validator((input: z.input<typeof customerSensitiveActionSchema>) =>
		customerSensitiveActionSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const { currentUser, db, request } = await getAdminServerContext(
			systemPermission("customers", "create"),
		);
		await verifySensitiveAdminAction(request, currentUser.id, data);
		const customer = await db.$client
			.prepare(
				`${listedUsersCte} SELECT * FROM listed_users WHERE id = ? LIMIT 1`,
			)
			.bind(data.id)
			.first<ListedUserRow>();
		if (!customer)
			throw new DomainError("customer_not_found", 404, "Customer not found");
		const scope = customerScope(customer);
		const [orders, entitlements] = await db.$client.batch([
			db.$client
				.prepare(
					`SELECT order_number, status, currency, currency_decimals, subtotal_minor,
					 discount_minor, total_minor, paid_minor, created_at, paid_at,
					 completed_at, cancelled_at, refunded_at
					 FROM shop_orders WHERE ${scope.condition} ORDER BY created_at, id`,
				)
				.bind(...scope.bindings),
			db.$client
				.prepare(
					`SELECT ce.entitlement_type, ce.status, ce.usage_limit, ce.usage_count,
					 ce.access_limit, ce.access_count, ce.activated_at, ce.expires_at, ce.created_at
					 FROM customer_entitlements ce JOIN shop_order_items oi ON oi.id = ce.order_item_id
					 JOIN shop_orders o ON o.id = oi.order_id WHERE ${scope.entitlementCondition}
					 ORDER BY ce.created_at, ce.id`,
				)
				.bind(...scope.bindings),
		]);
		const exportedAt = new Date().toISOString();
		const exportedUser = {
			...customer,
			email: isInternalIdentityEmail(customer.email) ? null : customer.email,
		};
		const content = JSON.stringify(
			{
				exportedAt,
				user: exportedUser,
				orders: orders?.results ?? [],
				entitlements: entitlements?.results ?? [],
			},
			null,
			2,
		);
		await createAuditStatement(db.$client, request, currentUser.id, {
			action: "customer.data_exported",
			targetType: customer.user_id ? "user" : "guest_order_identity",
			targetId: data.id,
		}).run();
		return {
			content,
			fileName: `gmshop-user-${data.id}-${exportedAt.slice(0, 10)}.json`,
		};
	});

export const deleteCustomerDataFn = createServerFn({ method: "POST" })
	.validator((input: z.input<typeof customerIdSchema>) =>
		customerIdSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const { currentUser, db, request } = await getAdminServerContext(
			systemPermission("customers", "delete"),
		);
		const now = Date.now();
		const deletion = await prepareCustomerDataDeletion(
			db.$client,
			data.id,
			now,
		);
		await db.$client.batch([
			...deletion.statements,
			createAuditStatement(db.$client, request, currentUser.id, {
				action: "customer.data_deleted",
				targetType: deletion.customer.userId ? "user" : "guest_order_identity",
				targetId: data.id,
				before: { email: deletion.customer.email },
				after: { anonymized: true },
			}),
		]);
		return { id: data.id };
	});

function customerScope(customer: Pick<ListedUserRow, "user_id">) {
	return {
		condition: "user_id = ?",
		entitlementCondition: "ce.user_id = ?",
		bindings: [customer.user_id],
	};
}
