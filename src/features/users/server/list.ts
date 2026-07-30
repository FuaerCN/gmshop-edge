import { z } from "zod";
import type { customerListSchema } from "#/features/customers/schema";

export const listedUsersCte = `WITH listed_users AS (
	SELECT u.id, u.id AS user_id, u.email, lower(u.email) AS normalized_email,
	 u.name, u.customer_note AS note,
	 CASE WHEN u.enabled = 1 THEN 'active' ELSE 'disabled' END AS status,
	 u.last_ordered_at, u.created_at, u.updated_at, u.enabled AS user_enabled,
	 u.email_verified,
	 COALESCE((
	  SELECT json_group_array(role_name) FROM (
	   SELECT r.name AS role_name FROM json_each(u.role_ids) assigned
	   JOIN roles r ON r.id = assigned.value
	   WHERE r.name NOT IN ('customer', 'guest')
	   ORDER BY r.name
	  )
	 ), '[]') AS role_names
	FROM users u
)`;

export type ListedUserRow = {
	id: string;
	user_id: string;
	email: string;
	normalized_email: string;
	name: string | null;
	note: string | null;
	status: "active" | "disabled";
	last_ordered_at: number | null;
	created_at: number;
	updated_at: number;
	user_enabled: number;
	email_verified: number;
	role_names: string;
	order_count: number;
	entitlement_count: number;
	active_entitlement_count: number;
	balances_json: string;
	login_methods_json: string;
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
const roleNamesSchema = z.array(z.string());
const loginMethodsSchema = z.array(
	z.object({
		providerId: z.string(),
		accountId: z.string(),
		telegramId: z.string().nullable(),
		telegramUsername: z.string().nullable(),
		createdAt: z.number(),
	}),
);

const orderIdentityMatch = "customer_order.user_id = c.user_id";
const entitlementIdentityMatch = "ce.user_id = c.user_id";

export const listedUserCommerceProjection = `SELECT c.*,
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
	 WHERE ce.status = 'active' AND ${entitlementIdentityMatch}
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
	) summary), '[]') AS balances_json,
	COALESCE((SELECT json_group_array(json_object(
	 'providerId', method.provider_id,
	 'accountId', method.account_id,
	 'telegramId', method.telegram_id,
	 'telegramUsername', method.telegram_username,
	 'createdAt', method.created_at))
	FROM (
	 SELECT provider_id, account_id, telegram_id, telegram_username, created_at
	 FROM accounts WHERE user_id = c.user_id ORDER BY created_at, id
	) method), '[]') AS login_methods_json
	FROM listed_users c`;

export async function listUsersWithCommerce(
	database: D1Database,
	input: z.output<typeof customerListSchema>,
	includeCommerce = true,
) {
	const search = input.search ? `%${input.search}%` : null;
	const where = search
		? "WHERE c.email LIKE ? OR c.name LIKE ? OR c.note LIKE ?"
		: "";
	const bindings = search ? [search, search, search] : [];
	const [count, rows] = await database.batch([
		database
			.prepare(
				`${listedUsersCte} SELECT COUNT(*) AS total FROM listed_users c ${where}`,
			)
			.bind(...bindings),
		database
			.prepare(
				`${listedUsersCte} ${listedUserCommerceProjection} ${where}
				 ORDER BY c.created_at DESC, c.id DESC LIMIT ? OFFSET ?`,
			)
			.bind(...bindings, input.pageSize, input.pageIndex * input.pageSize),
	]);
	return {
		data: ((rows?.results ?? []) as ListedUserRow[]).map((row) =>
			presentListedUser(row, includeCommerce),
		),
		total: Number(
			(count?.results[0] as { total?: unknown } | undefined)?.total ?? 0,
		),
	};
}

export function presentListedUser(row: ListedUserRow, includeCommerce = true) {
	return {
		id: row.id,
		userId: row.user_id,
		email: row.email,
		name: row.name,
		note: includeCommerce ? row.note : null,
		status: row.status,
		userEnabled: Boolean(row.user_enabled),
		emailVerified: Boolean(row.email_verified),
		roles: roleNamesSchema.parse(JSON.parse(row.role_names)),
		loginMethods: loginMethodsSchema.parse(JSON.parse(row.login_methods_json)),
		orderCount: includeCommerce ? Number(row.order_count) : 0,
		entitlementCount: includeCommerce ? Number(row.entitlement_count) : 0,
		activeEntitlementCount: includeCommerce
			? Number(row.active_entitlement_count)
			: 0,
		balances: includeCommerce
			? balanceSchema.parse(JSON.parse(row.balances_json))
			: [],
		lastOrderedAt: includeCommerce ? row.last_ordered_at : null,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}
