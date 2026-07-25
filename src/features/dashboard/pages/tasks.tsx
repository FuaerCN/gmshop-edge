import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock3, Hammer, ReceiptText, RotateCcw } from "lucide-react";
import { getAdminTasksFn } from "#/features/dashboard/server/tasks";
import { formatNumber } from "#/lib/format";
import { m } from "#/paraglide/messages";

export const tasksQuery = queryOptions({
	queryKey: ["admin", "tasks"],
	queryFn: () => getAdminTasksFn(),
	staleTime: 30_000,
	refetchInterval: 30_000,
});

export function AdminTasksSection() {
	const { data: tasks } = useSuspenseQuery(tasksQuery);
	const cards = [
		[
			m.tasks_failed_delivery(),
			tasks.failedDelivery,
			"/admin/delivery",
			RotateCcw,
		],
		[
			m.shop_dashboard_failed_automation(),
			tasks.failedBuilds,
			"/admin/automation",
			Hammer,
		],
		[
			m.store_account_notification_refund_failed(),
			tasks.failedRefunds,
			"/admin/orders",
			ReceiptText,
		],
		[m.tasks_expiring_orders(), tasks.expiringOrders, "/admin/orders", Clock3],
	] as const;
	return (
		<>
			{cards.map(([label, count, url, Icon]) => (
				<Link
					className="group flex min-h-28 flex-col justify-between rounded-xl border p-4 outline-none transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
					key={label}
					to={url}
				>
					<div className="flex items-start justify-between gap-3 text-sm">
						<span>{label}</span>
						<Icon className="size-4 shrink-0 text-muted-foreground" />
					</div>
					<strong className="text-3xl tabular-nums">
						{formatNumber(count)}
					</strong>
				</Link>
			))}
		</>
	);
}

export function TasksPending() {
	return (
		<>
			{[0, 1, 2, 3].map((item) => (
				<div
					className="h-28 animate-pulse rounded-xl border bg-muted/50"
					key={item}
				/>
			))}
		</>
	);
}
