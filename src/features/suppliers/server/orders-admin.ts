import { createServerFn } from "@tanstack/react-start";
import type { z } from "zod";
import { systemPermission } from "#/features/access/system-rbac";
import { DomainError } from "#/lib/domain-error";
import { createAuditStatement } from "#/server/audit";
import { getAdminRuntimeServerContext } from "#/server/context";
import { supplierOrderActionSchema, supplierOrderListSchema } from "../schema";
import { publishPendingSupplierOrders } from "./outbox";

type SupplierOrderAdminRow = {
	id: string;
	state: string;
	quantity: number;
	currency: string;
	currency_decimals: number;
	quoted_unit_cost_minor: string | null;
	total_cost_minor: string | null;
	provider_request_no: string | null;
	upstream_order_id: string | null;
	attempt_count: number;
	selection_count: number;
	last_error_code: string | null;
	next_retry_at: number | null;
	submitted_at: number | null;
	supplied_at: number | null;
	created_at: number;
	order_id: string;
	order_number: string;
	product_name: string;
	sellable_item_name: string;
	provider: string;
	normalized_api_origin: string;
	upstream_product_name: string;
	upstream_sku_name: string;
	account_id: string | null;
	account_name: string | null;
};

export const listSupplierOrdersFn = createServerFn({ method: "GET" })
	.validator((input: z.input<typeof supplierOrderListSchema>) =>
		supplierOrderListSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const { db } = await getAdminRuntimeServerContext(
			systemPermission("suppliers", "read"),
		);
		const search = data.search ? `%${data.search}%` : null;
		const where = search
			? `WHERE o.order_number LIKE ? OR so.upstream_order_id LIKE ?
			   OR sa.name LIKE ? OR sb.upstream_product_name LIKE ?
			   OR sb.upstream_sku_name LIKE ?`
			: "";
		const bindings = search ? [search, search, search, search, search] : [];
		const from = `FROM supplier_orders so
		 JOIN shop_orders o ON o.id = so.order_id
		 JOIN shop_order_items oi ON oi.id = so.order_item_id
		 JOIN supplier_bindings sb ON sb.id = so.supplier_binding_id
		 JOIN product_sellable_items psi ON psi.id = sb.sellable_item_id
		 LEFT JOIN supplier_accounts sa ON sa.id = so.selected_account_id`;
		const [count, rows] = await db.batch([
			db.prepare(`SELECT COUNT(*) AS total ${from} ${where}`).bind(...bindings),
			db
				.prepare(
					`SELECT so.id, so.state, so.quantity, so.currency,
					        COALESCE(sa.currency_decimals, psi.currency_decimals, 2)
					          AS currency_decimals,
					        so.quoted_unit_cost_minor, so.total_cost_minor,
					        so.provider_request_no, so.upstream_order_id,
					        so.attempt_count, so.selection_count,
					        so.last_error_code, so.next_retry_at,
					        so.submitted_at, so.supplied_at, so.created_at,
					        o.id AS order_id, o.order_number,
					        oi.product_name, oi.sellable_item_name,
					        sb.provider, sb.normalized_api_origin,
					        sb.upstream_product_name, sb.upstream_sku_name,
					        sa.id AS account_id, sa.name AS account_name
					 ${from} ${where}
					 ORDER BY so.created_at DESC, so.id DESC LIMIT ? OFFSET ?`,
				)
				.bind(...bindings, data.pageSize, data.pageIndex * data.pageSize),
		]);
		return {
			data: (rows?.results ?? []) as SupplierOrderAdminRow[],
			total: Number(
				(count?.results[0] as { total?: unknown } | undefined)?.total ?? 0,
			),
		};
	});

export const actSupplierOrderFn = createServerFn({ method: "POST" })
	.validator((input: z.input<typeof supplierOrderActionSchema>) =>
		supplierOrderActionSchema.parse(input),
	)
	.handler(async ({ data }) => {
		const context = await getAdminRuntimeServerContext(
			systemPermission("suppliers", "test"),
		);
		const order = await context.db
			.prepare(
				`SELECT id, state, selected_account_id, account_locked_at
				 FROM supplier_orders WHERE id = ? LIMIT 1`,
			)
			.bind(data.id)
			.first<{
				id: string;
				state: string;
				selected_account_id: string | null;
				account_locked_at: number | null;
			}>();
		if (!order)
			throw new DomainError(
				"supplier_order_not_found",
				404,
				"Supplier order not found",
			);
		if (data.action === "reconcile" && !order.selected_account_id)
			throw new DomainError(
				"supplier_order_account_not_selected",
				409,
				"Supplier order has no selected account",
			);
		if (
			data.action === "reselect" &&
			(order.state === "uncertain" || order.account_locked_at !== null)
		)
			throw new DomainError(
				"supplier_order_account_locked",
				409,
				"An uncertain supplier order must stay on its selected account",
			);
		if (["supplied", "refunded"].includes(order.state))
			throw new DomainError(
				"supplier_order_terminal",
				409,
				"Supplier order is already terminal",
			);
		const now = Date.now();
		const outboxId = crypto.randomUUID();
		await context.db.batch([
			context.db
				.prepare(
					`UPDATE supplier_orders SET state = ?,
					 next_retry_at = ?, last_error_code = NULL, updated_at = ?
					 WHERE id = ?`,
				)
				.bind(
					data.action === "reselect" ? "pending" : order.state,
					now,
					now,
					data.id,
				),
			context.db
				.prepare(
					`INSERT INTO outbox_events
					 (id, event_type, aggregate_type, aggregate_id, idempotency_key,
					  payload, status, attempt_count, created_at, updated_at)
					 VALUES (?, 'supplier.requested', 'supplier_order', ?, ?, ?,
					  'pending', 0, ?, ?)`,
				)
				.bind(
					outboxId,
					data.id,
					`supplier-admin-${data.action}:${data.id}:${now}`,
					JSON.stringify({ supplierOrderId: data.id }),
					now,
					now,
				),
			createAuditStatement(
				context.db,
				context.request,
				context.currentUser.id,
				{
					action: `supplier_order.${data.action}`,
					targetType: "supplier_order",
					targetId: data.id,
					before: order,
					after: { queued: true },
				},
			),
		]);
		if (context.env.COMMERCE_QUEUE)
			await publishPendingSupplierOrders(
				context.db,
				context.env.COMMERCE_QUEUE,
				1,
			);
		return { id: data.id, queued: true };
	});
