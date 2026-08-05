import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import {
	Boxes,
	ReceiptText,
	ShoppingBag,
	TriangleAlert,
	Users,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	AdminTasksSection,
	TasksPending,
} from "#/features/dashboard/pages/tasks";
import { getAdminDashboardFn } from "#/features/dashboard/server/admin";
import { PageHeader } from "#/layouts/components/page-header";
import {
	formatBasisPoints,
	formatMinorAmountWithSymbol,
	formatNumber,
} from "#/lib/format";
import { m } from "#/paraglide/messages";

const OrderTrendChart = lazy(() =>
	import("#/features/dashboard/components/order-trend-chart").then(
		(module) => ({ default: module.OrderTrendChart }),
	),
);

const SalesBreakdownChart = lazy(() =>
	import("#/features/dashboard/components/sales-breakdown-chart").then(
		(module) => ({ default: module.SalesBreakdownChart }),
	),
);

export const dashboardQuery = queryOptions({
	queryKey: ["admin", "dashboard", 30],
	queryFn: () => getAdminDashboardFn({ data: { days: 30 } }),
	staleTime: 30_000,
	refetchInterval: 30_000,
});

export function AdminDashboardPage() {
	const [days, setDays] = useState<1 | 7 | 30 | 90>(30);
	const ranges = [
		[1, m.dashboard_range_today()],
		[7, m.dashboard_range_days({ count: 7 })],
		[30, m.dashboard_range_days({ count: 30 })],
		[90, m.dashboard_range_days({ count: 90 })],
	] as const;
	return (
		<div className="flex flex-col gap-6 pe-1 pb-1">
			<PageHeader
				title={m.shop_dashboard_title()}
				description={m.shop_dashboard_description()}
				actions={
					<div className="flex gap-1 rounded-lg border p-1">
						{ranges.map(([value, label]) => (
							<Button
								key={value}
								onClick={() => setDays(value)}
								size="sm"
								variant={days === value ? "default" : "ghost"}
							>
								{label}
							</Button>
						))}
					</div>
				}
			/>
			<Suspense fallback={<DashboardPending />}>
				<DashboardContent days={days} />
			</Suspense>
		</div>
	);
}

function DashboardContent({ days }: { days: 1 | 7 | 30 | 90 }) {
	const { data } = useSuspenseQuery({
		...dashboardQuery,
		queryKey: ["admin", "dashboard", days],
		queryFn: () => getAdminDashboardFn({ data: { days } }),
	});
	const sales = data.sales[0];
	const salesSummary = sales
		? formatMinorAmountWithSymbol(
				sales.netMinor,
				sales.currency,
				sales.currencyDecimals,
			)
		: "—";
	const averageOrderSummary = sales
		? formatMinorAmountWithSymbol(
				sales.averageOrderMinor,
				sales.currency,
				sales.currencyDecimals,
			)
		: "—";
	const grossProfitSummary = sales
		? formatMinorAmountWithSymbol(
				sales.grossProfitMinor,
				sales.currency,
				sales.currencyDecimals,
			)
		: "—";
	const metrics = [
		[m.dashboard_net_sales(), salesSummary, ShoppingBag],
		[
			m.dashboard_orders_created(),
			formatNumber(data.performance.ordersCreated),
			ReceiptText,
		],
		[
			m.dashboard_new_customers(),
			formatNumber(data.performance.newCustomers),
			Users,
		],
		[
			m.dashboard_payment_success(),
			formatBasisPoints(data.performance.paymentSuccessBps),
			ReceiptText,
		],
		[m.dashboard_average_order(), averageOrderSummary, Users],
		[
			m.dashboard_repeat_rate(),
			formatBasisPoints(data.performance.repeatCustomerBps),
			Users,
		],
		[m.dashboard_gross_profit(), grossProfitSummary, ShoppingBag],
		[
			m.dashboard_cost_coverage(),
			formatBasisPoints(data.performance.costCoverageBps),
			Boxes,
		],
		[
			m.shop_dashboard_inventory(),
			formatNumber(data.summary.availableInventory),
			Boxes,
		],
		[
			m.shop_dashboard_low_stock(),
			formatNumber(data.summary.lowStock),
			TriangleAlert,
		],
		[
			m.dashboard_fulfillment_time(),
			m.dashboard_minutes({
				value: formatNumber(
					Math.round(data.performance.averageFulfillmentMs / 60_000),
				),
			}),
			ReceiptText,
		],
	] as const;
	return (
		<>
			<section aria-label={m.shop_dashboard_title()}>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
					{metrics.map(([label, value, Icon]) => (
						<div
							className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
							key={label}
						>
							<div className="flex items-center gap-2 text-muted-foreground text-sm">
								<Icon className="size-4" />
								<span>{label}</span>
							</div>
							<p className="mt-3 font-semibold text-xl tracking-tight sm:text-2xl">
								{value}
							</p>
						</div>
					))}
					<Suspense fallback={<TasksPending />}>
						<AdminTasksSection />
					</Suspense>
				</div>
			</section>

			<section className="grid min-w-0 gap-4 xl:grid-cols-2">
				<div className="min-w-0 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
					<h2 className="font-semibold text-xl">
						{m.payment_dashboard_order_trend()}
					</h2>
					<p className="text-muted-foreground text-sm">
						{m.payment_dashboard_order_trend_description()}
					</p>
					<div className="mt-5">
						<ClientOnly
							fallback={
								<div className="h-64 animate-pulse bg-muted/50 sm:h-72" />
							}
						>
							<Suspense
								fallback={
									<div className="h-64 animate-pulse bg-muted/50 sm:h-72" />
								}
							>
								<OrderTrendChart data={data.dailyOrders} />
							</Suspense>
						</ClientOnly>
					</div>
				</div>
				<div className="min-w-0 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
					<h2 className="font-semibold text-xl">
						{m.dashboard_sales_breakdown()}
					</h2>
					<p className="text-muted-foreground text-sm">
						{m.dashboard_sales_orders({
							count: formatNumber(sales?.orderCount ?? 0),
						})}
					</p>
					<div className="mt-4">
						{sales ? (
							<ClientOnly
								fallback={
									<div className="h-60 animate-pulse bg-muted/50 sm:h-64" />
								}
							>
								<Suspense
									fallback={
										<div className="h-60 animate-pulse bg-muted/50 sm:h-64" />
									}
								>
									<SalesBreakdownChart sale={sales} />
								</Suspense>
							</ClientOnly>
						) : null}
					</div>
				</div>
			</section>
		</>
	);
}

function DashboardPending() {
	return (
		<div className="grid flex-1 gap-6">
			<span className="sr-only">{m.common_loading()}</span>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
				{[
					"net-sales",
					"orders-created",
					"new-customers",
					"payments",
					"average-order",
					"repeat-rate",
					"gross-profit",
					"cost-coverage",
					"inventory",
					"low-stock",
					"fulfillment",
					"delivery-task",
					"automation-task",
					"refund-task",
					"expiry-task",
				].map((key) => (
					<div
						className="h-28 animate-pulse rounded-xl border bg-muted/40"
						key={key}
					/>
				))}
			</div>
			<div className="h-72 animate-pulse rounded-xl border bg-muted/40" />
		</div>
	);
}
