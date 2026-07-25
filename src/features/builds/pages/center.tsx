"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, ExternalLink, MoreHorizontal, RotateCcw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProButton } from "#/components/pro/base/button";
import { ProTable, type ProTableState } from "#/components/pro/table";
import { Badge } from "#/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	cancelBuildJobFn,
	listBuildJobsFn,
	retryBuildJobFn,
} from "#/features/builds/server/center";
import { PageHeader } from "#/layouts/components/page-header";
import { formatDateTime, formatNumber } from "#/lib/format";
import { m } from "#/paraglide/messages";

type Page = Awaited<ReturnType<typeof listBuildJobsFn>>;
type Job = Page["data"][number];

export function AutomationCenterPage() {
	const client = useQueryClient();
	const [refreshKey, setRefreshKey] = useState(0);
	const refresh = useCallback(async () => {
		await client.invalidateQueries({ queryKey: ["admin", "automation-jobs"] });
		setRefreshKey((value) => value + 1);
	}, [client]);
	const request = useCallback(
		(state: ProTableState) => {
			const search = String(
				state.columnFilters.find((filter) => filter.id === "id")?.value ?? "",
			);
			const input = {
				pageIndex: state.pagination.pageIndex,
				pageSize: state.pagination.pageSize,
				search,
			};
			return client.fetchQuery({
				queryKey: ["admin", "automation-jobs", input],
				queryFn: () => listBuildJobsFn({ data: input }),
			});
		},
		[client],
	);
	const retry = useMutation({
		mutationFn: retryBuildJobFn,
		onSuccess: refresh,
		onError: () => toast.error(m.automation_center_operation_failed()),
	});
	const cancel = useMutation({
		mutationFn: cancelBuildJobFn,
		onSuccess: refresh,
		onError: () => toast.error(m.automation_center_operation_failed()),
	});
	const columns = useMemo<ColumnDef<Job>[]>(
		() => [
			{
				accessorKey: "id",
				header: m.automation_center_job(),
				meta: { search: true },
				cell: ({ row }) => (
					<div>
						<strong className="block font-mono text-xs">
							{row.original.id}
						</strong>
						<span className="text-muted-foreground text-xs">
							{row.original.orderNumber} ·{" "}
							{formatDateTime(row.original.createdAt)}
						</span>
					</div>
				),
			},
			{
				accessorKey: "status",
				header: m.common_status(),
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.status === "failed" ? "destructive" : "outline"
						}
					>
						{row.original.status}
					</Badge>
				),
			},
			{
				accessorKey: "productName",
				header: m.nav_products(),
				cell: ({ row }) => (
					<div>
						<span className="block">{row.original.productName}</span>
						<span className="text-muted-foreground text-xs">
							{row.original.sellableItemName}
						</span>
					</div>
				),
			},
			{
				accessorKey: "methodKey",
				header: m.store_automation_method(),
				cell: ({ row }) =>
					`${row.original.methodKey} · ${row.original.runtime}`,
			},
			{
				accessorKey: "attemptCount",
				header: m.automation_center_attempts(),
				cell: ({ row }) => formatNumber(row.original.attemptCount),
			},
			{
				accessorKey: "artifactCount",
				header: m.automation_center_artifacts(),
				cell: ({ row }) => formatNumber(row.original.artifactCount),
			},
			{
				id: "actions",
				header: m.common_actions(),
				cell: ({ row }) => {
					const canRetry =
						row.original.status === "failed" ||
						row.original.status === "expired";
					const canCancel = ["queued", "dispatching", "running"].includes(
						row.original.status,
					);
					if (!row.original.runUrl && !canRetry && !canCancel) return "—";
					return (
						<div className="flex justify-end">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<ProButton
										size="icon-sm"
										tooltip={m.common_actions()}
										variant="ghost"
									>
										<MoreHorizontal />
									</ProButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									{row.original.runUrl ? (
										<DropdownMenuItem asChild>
											<a
												href={row.original.runUrl}
												rel="noreferrer"
												target="_blank"
											>
												<ExternalLink />
												{m.automation_center_open_run()}
											</a>
										</DropdownMenuItem>
									) : null}
									{canRetry ? (
										<DropdownMenuItem
											disabled={retry.isPending}
											onClick={() =>
												retry.mutate({ data: { id: row.original.id } })
											}
										>
											<RotateCcw />
											{m.automation_center_retry()}
										</DropdownMenuItem>
									) : null}
									{canCancel ? (
										<DropdownMenuItem
											disabled={cancel.isPending}
											onClick={() =>
												cancel.mutate({ data: { id: row.original.id } })
											}
										>
											<Ban />
											{m.automation_center_cancel()}
										</DropdownMenuItem>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					);
				},
			},
		],
		[cancel, retry],
	);
	return (
		<div className="flex min-h-0 w-full flex-1 flex-col gap-4">
			<PageHeader
				title={m.automation_center_title()}
				description={m.automation_center_description()}
			/>
			<ProTable
				className="min-h-0 flex-1"
				columns={columns}
				request={request}
				requestKey={refreshKey}
				onRefresh={refresh}
				toolbarSearch={{ columnId: "id", placeholder: m.common_search() }}
				table={{ stickyHeader: true }}
			/>
		</div>
	);
}
