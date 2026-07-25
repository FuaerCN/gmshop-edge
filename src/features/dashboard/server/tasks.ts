import { createServerFn } from "@tanstack/react-start";
import { systemPermission } from "#/features/access/system-rbac";
import { getAdminServerContext } from "#/server/context";

export const getAdminTasksFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const { db } = await getAdminServerContext(
			systemPermission("dashboard", "read"),
		);
		const result = await db.$client
			.prepare(
				`SELECT
				 (SELECT COUNT(*) FROM delivery_records WHERE status = 'failed') AS failed_delivery,
				 (SELECT COUNT(*) FROM automation_jobs WHERE status = 'failed') AS failed_builds,
				 (SELECT COUNT(*) FROM refunds WHERE status = 'failed'
				  OR (status = 'processing' AND failure_code = 'manual_action_required')) AS failed_refunds,
				 (SELECT COUNT(*) FROM shop_orders WHERE status = 'pending_payment'
				  AND expires_at <= ?) AS expiring_orders`,
			)
			.bind(Date.now() + 5 * 60_000)
			.first<Record<string, unknown>>();
		return {
			failedDelivery: Number(result?.failed_delivery ?? 0),
			failedBuilds: Number(result?.failed_builds ?? 0),
			failedRefunds: Number(result?.failed_refunds ?? 0),
			expiringOrders: Number(result?.expiring_orders ?? 0),
		};
	},
);
