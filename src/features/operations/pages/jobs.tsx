"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Play } from "lucide-react";
import { toast } from "sonner";
import { ProButton } from "#/components/pro/base/button";
import { ProTable } from "#/components/pro/table";
import { Badge } from "#/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { operationsErrorMessage } from "#/features/operations/error-message";
import {
	formatScheduleInterval,
	nextTaskExecutionAt,
	type ScheduledTaskName,
	scheduledTaskCatalog,
} from "#/features/operations/schedule";
import {
	getOperationsOverviewFn,
	runOperationsTaskFn,
} from "#/features/operations/server/admin";
import type { OperationsTask } from "#/features/operations/server/run-task";
import { PageHeader } from "#/layouts/components/page-header";
import { formatDateTime } from "#/lib/format";
import { useCurrentProTableUrlState } from "#/lib/pro-table-url-state";
import { m } from "#/paraglide/messages";
import { getLocale } from "#/paraglide/runtime";

type TaskRun = Awaited<
	ReturnType<typeof getOperationsOverviewFn>
>["taskRuns"][number];
type TaskRow = {
	task: ScheduledTaskName;
	schedule: string | null;
	manual: boolean;
	run: TaskRun | null;
	nextExecutionAt: string | null;
};

type TaskName = (typeof scheduledTaskCatalog)[number]["task"];

export function JobsPage() {
	const tableUrlState = useCurrentProTableUrlState({ searchColumnId: "task" });
	const client = useQueryClient();
	const query = useQuery({
		queryKey: ["admin", "operations"],
		queryFn: () => getOperationsOverviewFn(),
		refetchInterval: 30_000,
	});
	const runTask = useMutation({
		mutationFn: runOperationsTaskFn,
		onSuccess: async (result) => {
			await client.invalidateQueries({ queryKey: ["admin", "operations"] });
			toast.success(m.jobs_task_completed({ task: taskLabel(result.task) }));
		},
		onError: (error) =>
			toast.error(operationsErrorMessage(error, m.jobs_task_failed)),
	});
	const latest = new Map(query.data?.taskRuns.map((run) => [run.task, run]));
	const rows: TaskRow[] = scheduledTaskCatalog.map((entry) => {
		const run = latest.get(entry.task) ?? null;
		const exchangeRateSync = query.data?.exchangeRateSync;
		const isExchangeRateSync = entry.task === "exchange_rate_sync";
		const schedule = isExchangeRateSync
			? exchangeRateSync?.enabled
				? taskScheduleLabel(exchangeRateSync.intervalMs)
				: null
			: taskScheduleLabel(60_000);
		const nextExecutionAt = isExchangeRateSync
			? exchangeRateSync?.enabled
				? new Date(
						(exchangeRateSync.lastSyncedAt ?? Date.now()) +
							exchangeRateSync.intervalMs,
					).toISOString()
				: null
			: nextTaskExecutionAt(entry.task, run?.startedAt ?? null, null);
		return {
			...entry,
			schedule,
			run,
			nextExecutionAt,
		};
	});
	const columns: ColumnDef<TaskRow>[] = [
		{
			accessorKey: "task",
			header: m.jobs_task_name(),
			cell: ({ row }) => taskLabel(row.original.task),
			meta: { search: true },
		},
		{
			accessorKey: "schedule",
			header: m.jobs_schedule(),
			cell: ({ row }) => row.original.schedule ?? "—",
		},
		{
			id: "executedAt",
			header: m.jobs_last_execution(),
			cell: ({ row }) =>
				row.original.run ? formatDateTime(row.original.run.startedAt) : "—",
		},
		{
			accessorKey: "nextExecutionAt",
			header: m.jobs_next_execution(),
			cell: ({ row }) =>
				row.original.nextExecutionAt
					? formatDateTime(row.original.nextExecutionAt)
					: "—",
		},
		{
			id: "duration",
			header: m.common_duration(),
			cell: ({ row }) =>
				row.original.run?.durationMs == null
					? "—"
					: `${row.original.run.durationMs} ${m.unit_milliseconds()}`,
		},
		{
			id: "status",
			header: m.common_status(),
			cell: ({ row }) => <TaskStatus status={row.original.run?.status} />,
		},
		{
			id: "error",
			header: m.common_last_error(),
			cell: ({ row }) => taskErrorLabel(row.original.run?.errorCode),
		},
		{
			id: "actions",
			header: m.common_actions(),
			cell: ({ row }) =>
				row.original.manual ? (
					<div className="flex justify-end">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<ProButton
									variant="ghost"
									size="icon-sm"
									tooltip={m.common_actions()}
								>
									<MoreHorizontal />
								</ProButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-44">
								<DropdownMenuItem
									disabled={
										runTask.isPending || row.original.run?.status === "running"
									}
									onClick={() =>
										runTask.mutate({
											data: { task: row.original.task as OperationsTask },
										})
									}
								>
									<Play />
									{m.common_run_now()}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				) : null,
		},
	];
	return (
		<div className="flex min-h-0 w-full flex-1 flex-col gap-4">
			<PageHeader
				title={m.nav_scheduled_tasks()}
				description={m.jobs_description()}
			/>
			<ProTable
				initialState={tableUrlState.initialState}
				onChange={tableUrlState.onChange}
				className="min-h-0 flex-1"
				columns={columns}
				data={rows}
				loading={query.isLoading}
				onRefresh={() => query.refetch()}
				pagination={false}
				toolbarSearch={{ columnId: "task", placeholder: m.common_search() }}
				table={{ stickyHeader: true }}
			/>
		</div>
	);
}

function taskScheduleLabel(intervalMs: number) {
	return m.jobs_schedule_every({
		time: formatScheduleInterval(intervalMs, getLocale()),
	});
}

function taskErrorLabel(code: string | null | undefined) {
	if (!code) return "—";
	if (code === "already_running") return m.jobs_error_already_running();
	if (code === "binding_unavailable") return m.jobs_error_binding_unavailable();
	if (code === "timeout") return m.jobs_error_timeout();
	return m.jobs_error_failed();
}

function TaskStatus({ status }: { status: TaskRun["status"] | undefined }) {
	if (!status) return <span className="text-muted-foreground">—</span>;
	return (
		<Badge
			variant={
				status === "failed"
					? "destructive"
					: status === "running"
						? "secondary"
						: "default"
			}
		>
			{status === "failed"
				? m.status_failed()
				: status === "succeeded"
					? m.status_succeeded()
					: m.status_running()}
		</Badge>
	);
}

function taskLabel(task: TaskName | OperationsTask) {
	if (task === "order_expiration") return m.jobs_task_expire_orders();
	if (task === "delivery_publish") return m.jobs_task_publish_deliveries();
	if (task === "build_publish") return m.jobs_task_publish_automation();
	if (task === "refund_publish") return m.jobs_task_publish_refunds();
	if (task === "notification_publish")
		return m.jobs_task_publish_notifications();
	if (task === "exchange_rate_sync") return m.jobs_task_sync_exchange_rates();
	return m.jobs_task_commerce_maintenance();
}
