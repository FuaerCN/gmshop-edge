import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { systemPermission } from "#/features/access/system-rbac";
import { verifySensitiveAdminAction } from "#/features/auth/server/reauthenticate";
import {
	customerIdSchema,
	customerListSchema,
	customerSensitiveActionSchema,
	customerUpdateSchema,
} from "#/features/customers/schema";
import { DomainError } from "#/lib/domain-error";
import { createAuditStatement } from "#/server/audit";
import { getAdminServerContext } from "#/server/context";
import { prepareCustomerDataDeletion } from "./privacy";

const customerIdentitiesCte = `WITH customer_identities AS (
	SELECT u.id, u.id AS user_id, u.email, lower(u.email) AS normalized_email,
	 u.name, u.customer_note AS note,
	 CASE WHEN u.enabled = 1 THEN 'active' ELSE 'disabled' END AS status,
	 u.last_ordered_at, u.created_at, u.updated_at, u.enabled AS user_enabled
	FROM users u
	WHERE EXISTS (
	 SELECT 1 FROM json_each(u.role_ids) assigned
	 JOIN roles r ON r.id = assigned.value
	 WHERE r.name = 'customer' AND r.enabled = 1
	)
	UNION ALL
	SELECT MIN(o.id) AS id, NULL AS user_id, MIN(o.contact_email) AS email,
	 o.normalized_contact_email AS normalized_email, NULL AS name, NULL AS note,
	 'active' AS status, MAX(o.created_at) AS last_ordered_at,
	 MIN(o.created_at) AS created_at, MAX(o.updated_at) AS updated_at,
	 NULL AS user_enabled
	FROM shop_orders o
	WHERE o.user_id IS NULL AND o.normalized_contact_email IS NOT NULL
	GROUP BY o.normalized_contact_email
)`;

type CustomerRow = {
	id: string;
	user_id: string | null;
	email: string;
	normalized_email: string;
	name: string | null;
	note: string | null;
	status: "active" | "disabled";
	last_ordered_at: number | null;
	created_at: number;
	updated_at: number;
	user_enabled: number | null;
	order_count: number;
	entitlement_count: number;
	active_entitlement_count: number;
	balances_json: string;
};

const balanceSchema = z.array(
	z.object({
		currency: z.string(),
		currencyDecimals: z.number().int(),
		balanceMinor: z.string().regex(/^\d+$/),
		spentMinor: z.string().regex(/^\d+$/),
		orderCount: z.number().int().min(0),
	}),
);

const orderIdentityMatch =
	"((c.user_id IS NOT NULL AND customer_order.user_id = c.user_id) OR (c.user_id IS NULL AND customer_order.user_id IS NULL AND customer_order.normalized_contact_email = c.normalized_email))";
const entitlementIdentityMatch =
	"((c.user_id IS NOT NULL AND ce.user_id = c.user_id) OR (c.user_id IS NULL AND ce.user_id IS NULL AND entitlement_order.normalized_contact_email = c.normalized_email))";

const customerProjection = `SELECT c.*,
	(SELECT COUNT(*) FROM shop_orders customer_order
	 WHERE ${orderIdentityMatch}
	) AS order_count,
	(SELECT COUNT(*) FROM customer_entitlements ce
	 JOIN shop_order_items oi ON oi.id = ce.order_item_id
	 JOIN shop_orders entitlement_order ON entitlement_order.id = oi.order_id
	 WHERE ${entitlementIdentityMatch}
	) AS entitlement_count,
	(SELECT COUNT(*) FROM customer_entitlements ce
	 JOIN shop_order_items oi ON oi.id = ce.order_item_id
	 JOIN shop_orders entitlement_order ON entitlement_order.id = oi.order_id
	 WHERE ce.status = 'active'
	  AND ${entitlementIdentityMatch}
	) AS active_entitlement_count,
	COALESCE((SELECT json_group_array(json_object(
	 'currency', summary.currency,
	 'currencyDecimals', summary.currency_decimals,
	 'balanceMinor', '0',
	 'spentMinor', summary.spent_minor,
	 'orderCount', summary.order_count))
	FROM (
	 SELECT customer_order.currency, customer_order.currency_decimals,
	  CAST(SUM(CAST(customer_order.paid_minor AS INTEGER)) AS TEXT) AS spent_minor,
	  COUNT(*) AS order_count
	 FROM shop_orders customer_order
	 WHERE ${orderIdentityMatch}
	 GROUP BY customer_order.currency, customer_order.currency_decimals
	 ORDER BY customer_order.currency
	) summary), '[]') AS balances_json
	FROM customer_identities c`;

export const listCustomersFn = createServerFn({ method: "GET" })
	.validator((input: z.input<typeof customerListSchema>) =>
		customerListSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const { db } = await getAdminServerContext(
			systemPermission("customers", "read"),
		);
		const search = data.search ? `%${data.search}%` : null;
		const where = search
			? "WHERE c.email LIKE ? OR c.name LIKE ? OR c.note LIKE ?"
			: "";
		const bindings = search ? [search, search, search] : [];
		const [count, rows] = await db.$client.batch([
			db.$client
				.prepare(
					`${customerIdentitiesCte} SELECT COUNT(*) AS total FROM customer_identities c ${where}`,
				)
				.bind(...bindings),
			db.$client
				.prepare(
					`${customerIdentitiesCte} ${customerProjection} ${where}
					 ORDER BY c.created_at DESC, c.id DESC LIMIT ? OFFSET ?`,
				)
				.bind(...bindings, data.pageSize, data.pageIndex * data.pageSize),
		]);
		return {
			data: ((rows?.results ?? []) as CustomerRow[]).map(presentCustomer),
			total: Number(
				(count?.results[0] as { total?: unknown } | undefined)?.total ?? 0,
			),
		};
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
				`${customerIdentitiesCte} ${customerProjection} WHERE c.id = ? LIMIT 1`,
			)
			.bind(data.id)
			.first<CustomerRow>();
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
			...presentCustomer(customer),
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
				 FROM users WHERE id = ? AND EXISTS (
				  SELECT 1 FROM json_each(users.role_ids) assigned
				  JOIN roles r ON r.id = assigned.value WHERE r.name = 'customer'
				 ) LIMIT 1`,
			)
			.bind(data.id)
			.first<Record<string, unknown>>();
		if (!before)
			throw new DomainError(
				"customer_account_required",
				409,
				"Guest customer profiles cannot be edited",
			);
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
				`${customerIdentitiesCte} SELECT * FROM customer_identities WHERE id = ? LIMIT 1`,
			)
			.bind(data.id)
			.first<CustomerRow>();
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
		const content = JSON.stringify(
			{
				exportedAt,
				customer,
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
			fileName: `gmshop-customer-${data.id}-${exportedAt.slice(0, 10)}.json`,
		};
	});

export const deleteCustomerDataFn = createServerFn({ method: "POST" })
	.validator((input: z.input<typeof customerSensitiveActionSchema>) =>
		customerSensitiveActionSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const { currentUser, db, request } = await getAdminServerContext(
			systemPermission("customers", "delete"),
		);
		await verifySensitiveAdminAction(request, currentUser.id, data);
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

function customerScope(
	customer: Pick<CustomerRow, "user_id" | "normalized_email">,
) {
	if (customer.user_id)
		return {
			condition: "user_id = ?",
			entitlementCondition: "ce.user_id = ?",
			bindings: [customer.user_id],
		};
	return {
		condition: "user_id IS NULL AND normalized_contact_email = ?",
		entitlementCondition:
			"ce.user_id IS NULL AND o.user_id IS NULL AND o.normalized_contact_email = ?",
		bindings: [customer.normalized_email],
	};
}

function presentCustomer(row: CustomerRow) {
	return {
		id: row.id,
		userId: row.user_id,
		email: row.email,
		name: row.name,
		note: row.note,
		status: row.status,
		userEnabled: row.user_enabled == null ? null : Boolean(row.user_enabled),
		orderCount: Number(row.order_count),
		entitlementCount: Number(row.entitlement_count),
		activeEntitlementCount: Number(row.active_entitlement_count),
		balances: balanceSchema.parse(JSON.parse(row.balances_json)),
		lastOrderedAt: row.last_ordered_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}
