"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProButton } from "#/components/pro/base/button";
import { ProEditor } from "#/components/pro/editor/client";
import { ModalForm, type ProSchemaFormItem } from "#/components/pro/form";
import { ProTable } from "#/components/pro/table";
import { notificationEventLabel } from "#/features/notifications/labels";
import {
	getNotificationCenterFn,
	saveNotificationTemplateFn,
} from "#/features/notifications/server/admin";
import { PageHeader } from "#/layouts/components/page-header";
import { formatDateTime } from "#/lib/format";
import { localeLabels } from "#/lib/locales";
import { useCurrentProTableUrlState } from "#/lib/pro-table-url-state";
import { m } from "#/paraglide/messages";

type Template = Awaited<
	ReturnType<typeof getNotificationCenterFn>
>["templates"][number];

export function EmailTemplatesPage() {
	return <NotificationTemplatesPage />;
}

function NotificationTemplatesPage() {
	const tableUrlState = useCurrentProTableUrlState({ searchColumnId: "event" });
	const client = useQueryClient();
	const query = useQuery({
		queryKey: ["admin", "notifications"],
		queryFn: () => getNotificationCenterFn(),
	});
	const [editing, setEditing] = useState<Template>();
	const refresh = useCallback(
		() => client.invalidateQueries({ queryKey: ["admin", "notifications"] }),
		[client],
	);
	const save = useMutation({
		mutationFn: saveNotificationTemplateFn,
		onSuccess: async () => {
			setEditing(undefined);
			await refresh();
			toast.success(m.notifications_template_saved());
		},
		onError: () => toast.error(m.notifications_operation_failed()),
	});
	const columns = useMemo<ColumnDef<Template>[]>(
		() => [
			{
				id: "event",
				accessorFn: (template) => notificationEventLabel(template.event),
				header: m.notifications_event(),
				meta: { search: true },
			},
			{
				accessorKey: "locale",
				header: m.common_language(),
				cell: ({ row }) =>
					localeLabels[row.original.locale as keyof typeof localeLabels] ??
					row.original.locale,
			},
			{
				accessorKey: "updatedAt",
				header: m.catalog_updated_at(),
				cell: ({ row }) => formatDateTime(row.original.updatedAt),
			},
			{
				id: "actions",
				header: m.common_actions(),
				meta: { align: "right" },
				cell: ({ row }) => (
					<div className="flex justify-end">
						<ProButton
							onClick={() => setEditing(row.original)}
							size="icon-sm"
							tooltip={m.common_edit()}
							variant="ghost"
						>
							<Pencil />
						</ProButton>
					</div>
				),
			},
		],
		[],
	);

	return (
		<div className="flex min-h-0 w-full flex-1 flex-col gap-4">
			<PageHeader
				description={m.notifications_email_templates_description()}
				title={m.notifications_email_templates()}
			/>
			<ProTable
				className="min-h-0 flex-1"
				columns={columns}
				data={
					query.data?.templates.filter(
						(template) => template.channel === "email",
					) ?? []
				}
				initialState={tableUrlState.initialState}
				loading={query.isPending}
				onChange={tableUrlState.onChange}
				onRefresh={() => query.refetch()}
				pagination={false}
				table={{ stickyHeader: true }}
				toolbarSearch={{ columnId: "event", placeholder: m.common_search() }}
			/>
			<ModalForm
				key={editing?.id ?? "notification-template"}
				description={
					editing
						? `${notificationEventLabel(editing.event)} · ${
								localeLabels[editing.locale as keyof typeof localeLabels] ??
								editing.locale
							}`
						: ""
				}
				initialValues={templateValues(editing)}
				modalClassName="sm:max-w-4xl"
				onFinish={async (values) => {
					if (!editing) return;
					await save.mutateAsync({
						data: {
							id: editing.id,
							subject: String(values.subject ?? ""),
							body: String(values.body ?? ""),
						},
					});
				}}
				onFinishFailed={() => toast.error(m.notifications_operation_failed())}
				onOpenChange={(open) => !open && setEditing(undefined)}
				open={editing !== undefined}
				schema={templateSchema(editing?.channel)}
				title={m.common_edit()}
			/>
		</div>
	);
}

function templateSchema(channel: string | undefined): ProSchemaFormItem[] {
	return [
		{
			name: "subject",
			label: m.notifications_subject(),
			required: channel === "email",
			hidden: channel !== "email",
		},
		{
			name: "body",
			label: m.notifications_body(),
			required: true,
			tooltip: m.notifications_template_variables(),
			render: (field) => (
				<ProEditor
					height={360}
					language="plaintext"
					onChange={(value) => field.onChange(value)}
					toolbarFormat={false}
					toolbarTitle={m.notifications_body()}
					value={String(field.value ?? "")}
				/>
			),
		},
	];
}

function templateValues(template: Template | undefined) {
	return {
		subject: template?.subject ?? "",
		body: template?.body ?? "",
	};
}
