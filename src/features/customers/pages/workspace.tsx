"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { getCustomerFn } from "#/features/customers/server/admin";
import {
	entitlementStatusLabel,
	entitlementTypeLabel,
} from "#/features/entitlements/labels";
import { PageHeader } from "#/layouts/components/page-header";
import { formatDateTime, formatMinorAmount, formatNumber } from "#/lib/format";
import { m } from "#/paraglide/messages";

export function CustomerWorkspacePage({ customerId }: { customerId: string }) {
	const customer = useQuery({
		queryKey: ["admin", "customers", customerId],
		queryFn: () => getCustomerFn({ data: { id: customerId } }),
	});
	if (!customer.data)
		return <div className="h-96 animate-pulse rounded-2xl bg-muted" />;
	const detail = customer.data;
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-5">
			<PageHeader
				title={detail.name || detail.email}
				description={detail.email}
				actions={
					<Button asChild variant="outline">
						<Link to="/admin/customers">{m.nav_customers()}</Link>
					</Button>
				}
			/>
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<Metric label={m.common_status()} value={detail.status} />
				<Metric
					label={m.customers_orders()}
					value={formatNumber(detail.orderCount)}
				/>
				<Metric
					label={m.customers_entitlements()}
					value={formatNumber(detail.activeEntitlementCount)}
				/>
				<Metric
					label={m.customers_last_order()}
					value={
						detail.lastOrderedAt ? formatDateTime(detail.lastOrderedAt) : "—"
					}
				/>
			</div>
			<div className="grid gap-5 xl:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>{m.customers_orders()}</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-3">
						{detail.orders.map((order) => (
							<Link
								className="flex items-center justify-between gap-4 rounded-lg border p-3 hover:border-primary/40"
								key={order.id}
								params={{ orderId: order.id }}
								to="/admin/orders/$orderId"
							>
								<div>
									<strong className="font-mono text-sm">
										{order.orderNumber}
									</strong>
									<p className="text-muted-foreground text-xs">
										{formatDateTime(order.createdAt)}
									</p>
								</div>
								<div className="text-right">
									<Badge variant="outline">{order.status}</Badge>
									<p className="mt-1 text-sm">
										{formatMinorAmount(
											order.totalMinor,
											order.currency,
											order.currencyDecimals,
										)}
									</p>
								</div>
							</Link>
						))}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{m.customers_entitlements()}</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-3">
						{detail.entitlements.map((entitlement) => (
							<div
								className="flex items-center justify-between gap-3 rounded-lg border p-3"
								key={entitlement.id}
							>
								<div>
									<strong>
										{entitlement.productName ??
											entitlementTypeLabel(entitlement.type)}
									</strong>
									<p className="text-muted-foreground text-xs">
										{entitlement.sellableItemName}
									</p>
								</div>
								<Badge variant="outline">
									{entitlementStatusLabel(entitlement.status)}
								</Badge>
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<Card>
			<CardContent className="p-5">
				<p className="text-muted-foreground text-sm">{label}</p>
				<p className="mt-3 font-semibold text-xl">{value}</p>
			</CardContent>
		</Card>
	);
}
