"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProButton } from "#/components/pro/base/button";
import { ModalForm } from "#/components/pro/form";
import { ProModal } from "#/components/pro/overlay";
import { ProTable, type ProTableState } from "#/components/pro/table";
import { Badge } from "#/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { customerOperationErrorMessage } from "#/features/customers/error-message";
import { customerStatuses } from "#/features/customers/schema";
import {
	deleteCustomerDataFn,
	exportCustomerDataFn,
	getCustomerFn,
	listCustomersFn,
	updateCustomerFn,
} from "#/features/customers/server/admin";
import {
	entitlementStatusLabel,
	entitlementTypeLabel,
} from "#/features/entitlements/labels";
import { shopOrderStatusLabel } from "#/features/shop-orders/labels";
import { PageHeader } from "#/layouts/components/page-header";
import { formatDateTime, formatMinorAmount, formatNumber } from "#/lib/format";
import { useCurrentProTableUrlState } from "#/lib/pro-table-url-state";
import { m } from "#/paraglide/messages";

type CustomerPageResult = Awaited<ReturnType<typeof listCustomersFn>>;
type Customer = CustomerPageResult["data"][number];
type CustomerDetail = Awaited<ReturnType<typeof getCustomerFn>>;

export function CustomersPage() {
	const tableUrlState = useCurrentProTableUrlState({ searchColumnId: "email" });
	const client = useQueryClient();
	const [refreshKey, setRefreshKey] = useState(0);
	const [editing, setEditing] = useState<Customer | null>(null);
	const [detail, setDetail] = useState<CustomerDetail | null>(null);
	const [sensitiveAction, setSensitiveAction] = useState<{
		customer: Customer;
		kind: "export" | "delete";
	} | null>(null);
	const [sensitiveProof, setSensitiveProof] = useState("");
	const refresh = useCallback(async () => {
		await client.invalidateQueries({ queryKey: ["admin", "customers"] });
		setRefreshKey((value) => value + 1);
	}, [client]);
	const request = useCallback(
		(state: ProTableState) => {
			const search = String(
				state.columnFilters.find((filter) => filter.id === "email")?.value ??
					"",
			);
			const input = {
				pageIndex: state.pagination.pageIndex,
				pageSize: state.pagination.pageSize,
				search,
			};
			return client.fetchQuery({
				queryKey: ["admin", "customers", input],
				queryFn: () => listCustomersFn({ data: input }),
			});
		},
		[client],
	);
	const update = useMutation({
		mutationFn: updateCustomerFn,
		onSuccess: async () => {
			setEditing(null);
			await refresh();
		},
		onError: showError,
	});
	const loadDetail = useMutation({
		mutationFn: getCustomerFn,
		onSuccess: setDetail,
		onError: showError,
	});
	const exportData = useMutation({
		mutationFn: exportCustomerDataFn,
		onSuccess: (result) => {
			const url = URL.createObjectURL(
				new Blob([result.content], { type: "application/json" }),
			);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = result.fileName;
			anchor.click();
			URL.revokeObjectURL(url);
			closeSensitiveAction();
		},
		onError: showError,
	});
	const deleteData = useMutation({
		mutationFn: deleteCustomerDataFn,
		onSuccess: async () => {
			closeSensitiveAction();
			await refresh();
		},
		onError: showError,
	});
	const columns = useMemo<ColumnDef<Customer>[]>(
		() => [
			{
				accessorKey: "email",
				header: m.customers_customer(),
				meta: { search: true },
				cell: ({ row }) => (
					<div>
						<Link
							className="block font-semibold hover:underline"
							params={{ customerId: row.original.id }}
							to="/admin/customers/$customerId"
						>
							{row.original.name || m.customers_guest()}
						</Link>
						<span className="text-muted-foreground text-xs">
							{row.original.email}
						</span>
					</div>
				),
			},
			{
				accessorKey: "status",
				header: m.common_status(),
				cell: ({ row }) => (
					<Badge
						variant={row.original.status === "active" ? "default" : "secondary"}
					>
						{customerStatusLabel(row.original.status)}
					</Badge>
				),
			},
			{
				accessorKey: "userId",
				header: m.customers_account(),
				cell: ({ row }) => {
					if (!row.original.userId) return m.customers_guest();
					return row.original.userEnabled
						? m.customers_registered()
						: m.customers_account_disabled();
				},
			},
			{
				accessorKey: "orderCount",
				header: m.customers_orders(),
				cell: ({ row }) => formatNumber(row.original.orderCount),
			},
			{
				accessorKey: "activeEntitlementCount",
				header: m.customers_entitlements(),
				cell: ({ row }) =>
					`${formatNumber(row.original.activeEntitlementCount)} / ${formatNumber(row.original.entitlementCount)}`,
			},
			{
				id: "spent",
				header: m.customers_spent(),
				cell: ({ row }) =>
					row.original.balances.length ? (
						<div className="grid gap-1">
							{row.original.balances.map((balance) => (
								<span key={balance.currency} className="text-xs">
									{formatMinorAmount(
										balance.spentMinor,
										balance.currency,
										balance.currencyDecimals,
									)}
								</span>
							))}
						</div>
					) : (
						"—"
					),
			},
			{
				id: "actions",
				header: m.common_actions(),
				cell: ({ row }) => (
					<div className="flex justify-end">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<ProButton
									size="icon-sm"
									variant="ghost"
									tooltip={m.common_actions()}
								>
									<MoreHorizontal />
								</ProButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									disabled={loadDetail.isPending}
									onClick={() =>
										loadDetail.mutate({ data: { id: row.original.id } })
									}
								>
									<Eye />
									{m.customers_view()}
								</DropdownMenuItem>
								<DropdownMenuItem
									disabled={!row.original.userId}
									onClick={() => setEditing(row.original)}
								>
									<Pencil />
									{m.common_edit()}
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() =>
										setSensitiveAction({
											customer: row.original,
											kind: "export",
										})
									}
								>
									<Download />
									{m.customers_export_data()}
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() =>
										setSensitiveAction({
											customer: row.original,
											kind: "delete",
										})
									}
									variant="destructive"
								>
									<Trash2 />
									{m.customers_delete_data()}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				),
			},
		],
		[loadDetail],
	);

	return (
		<>
			<div className="flex min-h-0 w-full flex-1 flex-col gap-4">
				<PageHeader
					title={m.nav_customers()}
					description={m.customers_description()}
				/>
				<ProTable
					initialState={tableUrlState.initialState}
					onChange={tableUrlState.onChange}
					className="min-h-0 flex-1"
					columns={columns}
					request={request}
					requestKey={refreshKey}
					onRefresh={refresh}
					toolbarSearch={{ columnId: "email", placeholder: m.common_search() }}
					table={{ stickyHeader: true }}
				/>
			</div>
			{editing ? (
				<ModalForm
					key={editing.id}
					open
					onOpenChange={(open) => !open && setEditing(null)}
					title={m.customers_edit()}
					schema={[
						{ name: "name", label: m.common_name() },
						{
							name: "status",
							label: m.common_status(),
							valueType: "select" as const,
							required: true,
							fieldProps: {
								options: customerStatuses.map((value) => ({
									value,
									label: customerStatusLabel(value),
								})),
							},
						},
						{
							name: "note",
							label: m.customers_note(),
							valueType: "textarea" as const,
						},
					]}
					initialValues={{
						name: editing.name ?? "",
						status: editing.status,
						note: editing.note ?? "",
					}}
					onFinish={async (values) => {
						await update.mutateAsync({
							data: {
								id: editing.id,
								name: String(values.name ?? ""),
								note: String(values.note ?? ""),
								status: String(
									values.status ?? "active",
								) as (typeof customerStatuses)[number],
							},
						});
					}}
					onFinishFailed={showError}
				/>
			) : null}
			<CustomerDetailModal
				detail={detail}
				onOpenChange={(open) => !open && setDetail(null)}
			/>
			<ModalForm
				open={Boolean(sensitiveAction)}
				onOpenChange={(open) => !open && closeSensitiveAction()}
				title={
					sensitiveAction?.kind === "delete"
						? m.customers_delete_data()
						: m.customers_export_data()
				}
				description={
					sensitiveAction?.kind === "delete"
						? m.customers_delete_data_description()
						: m.customers_sensitive_action_description()
				}
				schema={[
					{
						name: "proof",
						label: m.auth_sensitive_proof(),
						required: true,
						fieldProps: { type: "password", autoComplete: "current-password" },
					},
				]}
				initialValues={{ proof: sensitiveProof }}
				onFinish={async (values) => {
					if (!sensitiveAction) return;
					const proof = String(values.proof ?? "");
					setSensitiveProof(proof);
					const data = {
						id: sensitiveAction.customer.id,
						password: proof,
					};
					if (sensitiveAction.kind === "delete")
						await deleteData.mutateAsync({ data });
					else await exportData.mutateAsync({ data });
				}}
				onFinishFailed={showError}
			/>
		</>
	);

	function closeSensitiveAction() {
		setSensitiveAction(null);
		setSensitiveProof("");
	}
}

function CustomerDetailModal({
	detail,
	onOpenChange,
}: {
	detail: CustomerDetail | null;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<ProModal
			open={Boolean(detail)}
			onOpenChange={onOpenChange}
			title={detail?.name || detail?.email || m.customers_customer()}
			description={detail?.email}
			className="sm:max-w-3xl"
		>
			{detail ? (
				<div className="grid gap-5 overflow-y-auto">
					<div className="grid gap-3 sm:grid-cols-3">
						<Summary
							label={m.customers_orders()}
							value={formatNumber(detail.orderCount)}
						/>
						<Summary
							label={m.customers_entitlements()}
							value={`${formatNumber(detail.activeEntitlementCount)} / ${formatNumber(detail.entitlementCount)}`}
						/>
						<Summary
							label={m.customers_last_order()}
							value={
								detail.lastOrderedAt
									? formatDateTime(detail.lastOrderedAt)
									: "—"
							}
						/>
					</div>
					<section className="grid gap-2">
						<h3 className="font-semibold">{m.customers_balances()}</h3>
						{detail.balances.length ? (
							detail.balances.map((balance) => (
								<div
									key={balance.currency}
									className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-sm"
								>
									<span>{balance.currency}</span>
									<span>
										{m.customers_balance()}:{" "}
										{formatMinorAmount(
											balance.balanceMinor,
											balance.currency,
											balance.currencyDecimals,
										)}
									</span>
									<span>
										{m.customers_spent()}:{" "}
										{formatMinorAmount(
											balance.spentMinor,
											balance.currency,
											balance.currencyDecimals,
										)}
									</span>
								</div>
							))
						) : (
							<p className="text-muted-foreground text-sm">—</p>
						)}
					</section>
					<section className="grid gap-2">
						<h3 className="font-semibold">{m.customers_recent_orders()}</h3>
						{detail.orders.length ? (
							detail.orders.map((order) => (
								<div
									key={order.id}
									className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
								>
									<span className="font-mono">{order.orderNumber}</span>
									<span>{shopOrderStatusLabel(order.status)}</span>
									<span>
										{formatMinorAmount(
											order.totalMinor,
											order.currency,
											order.currencyDecimals,
										)}
									</span>
								</div>
							))
						) : (
							<p className="text-muted-foreground text-sm">—</p>
						)}
					</section>
					<section className="grid gap-2">
						<h3 className="font-semibold">{m.customers_entitlements()}</h3>
						{detail.entitlements.length ? (
							detail.entitlements.map((entitlement) => (
								<div
									key={entitlement.id}
									className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
								>
									<span>
										{entitlement.productName ?? "—"} ·{" "}
										{entitlement.sellableItemName ?? "—"}
									</span>
									<Badge variant="outline">
										{entitlementTypeLabel(entitlement.type)}
									</Badge>
									<span>{entitlementStatusLabel(entitlement.status)}</span>
								</div>
							))
						) : (
							<p className="text-muted-foreground text-sm">—</p>
						)}
					</section>
				</div>
			) : null}
		</ProModal>
	);
}

function Summary({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border p-3">
			<span className="text-muted-foreground text-xs">{label}</span>
			<strong className="mt-1 block">{value}</strong>
		</div>
	);
}

function customerStatusLabel(status: string) {
	if (status === "active") return m.customers_status_active();
	if (status === "deleted") return m.customers_status_deleted();
	return m.customers_status_disabled();
}

function showError(error: unknown) {
	toast.error(customerOperationErrorMessage(error));
}
