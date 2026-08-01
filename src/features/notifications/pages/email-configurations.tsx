"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, MoreHorizontal, Pencil, Plus, Send } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProButton } from "#/components/pro/base/button";
import { ModalForm, type ProSchemaFormItem } from "#/components/pro/form";
import { ProTable } from "#/components/pro/table";
import { EmailProviderLogo } from "#/components/provider-logo";
import { Badge } from "#/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Switch } from "#/components/ui/switch";
import { notificationHealthStatusLabel } from "#/features/notifications/labels";
import {
	getNotificationCenterFn,
	reorderEmailChannelsFn,
	saveEmailChannelFn,
	sendTestEmailFn,
	setEmailChannelEnabledFn,
} from "#/features/notifications/server/admin";
import { PageHeader } from "#/layouts/components/page-header";
import { useCurrentProTableUrlState } from "#/lib/pro-table-url-state";
import { m } from "#/paraglide/messages";
import { showNotificationError } from "./error";

type EmailConfig = Awaited<
	ReturnType<typeof getNotificationCenterFn>
>["configs"][number];
type EmailProvider =
	| "resend"
	| "postmark"
	| "sendgrid"
	| "mailgun"
	| "smtp"
	| "cloudflare_email";

const emailProviderValues: EmailProvider[] = [
	"resend",
	"postmark",
	"sendgrid",
	"mailgun",
	"smtp",
	"cloudflare_email",
];

export function EmailConfigurationsPage() {
	const tableUrlState = useCurrentProTableUrlState({ searchColumnId: "name" });
	const client = useQueryClient();
	const query = useQuery({
		queryKey: ["admin", "notifications"],
		queryFn: () => getNotificationCenterFn(),
	});
	const [editing, setEditing] = useState<EmailConfig | undefined>();
	const [creatingProvider, setCreatingProvider] = useState<
		EmailProvider | undefined
	>();
	const [testing, setTesting] = useState<EmailConfig | null | undefined>();
	const refresh = useCallback(
		() => client.invalidateQueries({ queryKey: ["admin", "notifications"] }),
		[client],
	);
	const save = useMutation({
		mutationFn: saveEmailChannelFn,
		onSuccess: async () => {
			setEditing(undefined);
			setCreatingProvider(undefined);
			await refresh();
			toast.success(m.notifications_channel_saved());
		},
		onError: showNotificationError,
	});
	const test = useMutation({
		mutationFn: sendTestEmailFn,
		onSuccess: async () => {
			setTesting(undefined);
			await refresh();
			toast.success(m.notifications_test_queued());
		},
		onError: showNotificationError,
	});
	const reorder = useMutation({
		mutationFn: reorderEmailChannelsFn,
		onSuccess: refresh,
		onError: showNotificationError,
	});
	const setEnabled = useMutation({
		mutationFn: setEmailChannelEnabledFn,
		onSuccess: refresh,
		onError: showNotificationError,
	});
	const columns = useMemo<ColumnDef<EmailConfig>[]>(
		() => [
			{
				accessorKey: "enabled",
				header: m.common_enabled(),
				meta: { className: "w-20 min-w-20 max-w-20" },
				cell: ({ row }) => (
					<Switch
						aria-label={`${m.common_enabled()} · ${row.original.name}`}
						checked={row.original.enabled}
						disabled={setEnabled.isPending}
						onCheckedChange={(enabled) =>
							setEnabled.mutate({ data: { id: row.original.id, enabled } })
						}
					/>
				),
			},
			{
				accessorKey: "name",
				header: m.notifications_config_name(),
				meta: { search: true },
				cell: ({ row }) => <strong>{row.original.name}</strong>,
			},
			{
				accessorKey: "provider",
				header: m.notifications_email_provider(),
				meta: { className: "w-48 min-w-48 max-w-48" },
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<EmailProviderLogo
							className="size-8"
							providerId={row.original.provider}
						/>
						{emailProviderName(row.original.provider)}
					</div>
				),
			},
			{ accessorKey: "fromAddress", header: m.notifications_from_address() },
			{
				id: "health",
				header: m.common_status(),
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.lastHealthStatus === "unhealthy"
								? "destructive"
								: "outline"
						}
					>
						{notificationHealthStatusLabel(row.original.lastHealthStatus)}
					</Badge>
				),
			},
			{
				id: "actions",
				header: m.common_actions(),
				meta: { align: "right" },
				cell: ({ row }) => (
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
								<DropdownMenuItem onClick={() => setTesting(row.original)}>
									<Send />
									{m.notifications_test_config()}
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => setEditing(row.original)}>
									<Pencil />
									{m.common_edit()}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				),
			},
		],
		[setEnabled],
	);
	return (
		<div className="flex min-h-0 w-full flex-1 flex-col gap-4">
			<PageHeader
				actions={
					<div className="flex flex-wrap gap-2">
						<ProButton
							disabled={!query.data?.configs.some((config) => config.enabled)}
							onClick={() => setTesting(null)}
							variant="outline"
						>
							<Send />
							{m.notifications_overall_test()}
						</ProButton>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<ProButton>
									<Plus />
									{m.notifications_add_config()}
									<ChevronDown />
								</ProButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								className="max-h-80 overflow-y-auto"
							>
								{emailProviderValues.map((provider) => (
									<DropdownMenuItem
										key={provider}
										onClick={() => setCreatingProvider(provider)}
									>
										<EmailProviderLogo
											className="size-4"
											providerId={provider}
										/>
										{emailProviderName(provider)}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				}
				description={m.notifications_email_description()}
				title={m.notifications_email_channel()}
			/>
			<ProTable
				className="min-h-80"
				columns={columns}
				data={query.data?.configs ?? []}
				dragSort={{
					rowKey: "id",
					onDragSortEnd: (rows) =>
						reorder.mutate({ data: { ids: rows.map((row) => row.id) } }),
				}}
				initialState={tableUrlState.initialState}
				loading={query.isPending}
				onChange={tableUrlState.onChange}
				onRefresh={() => query.refetch()}
				pagination={false}
				table={{ stickyHeader: true }}
				toolbarSearch={{ columnId: "name", placeholder: m.common_search() }}
			/>
			<ModalForm
				key={editing?.id ?? creatingProvider ?? "closed-email-config"}
				description={m.notifications_email_description()}
				fieldsClassName="grid gap-4 sm:grid-cols-2"
				initialValues={emailConfigValues(editing, creatingProvider)}
				modalClassName="sm:max-w-2xl"
				onFinish={async (values) => {
					await save.mutateAsync({
						data: {
							id: editing?.id,
							name: String(values.name ?? ""),
							provider: String(values.provider) as EmailProvider,
							apiKey: String(values.apiKey ?? ""),
							domain: String(values.domain ?? ""),
							region: String(values.region ?? "us") as "us" | "eu",
							smtpHost: String(values.smtpHost ?? ""),
							smtpPort: Number(values.smtpPort ?? 587),
							smtpUser: String(values.smtpUser ?? ""),
							fromAddress: String(values.fromAddress ?? ""),
							replyTo: String(values.replyTo ?? ""),
							sortOrder: editing?.sortOrder ?? 100,
							enabled: editing?.enabled ?? true,
						},
					});
				}}
				onOpenChange={(open) => {
					if (!open) {
						setEditing(undefined);
						setCreatingProvider(undefined);
					}
				}}
				open={editing !== undefined || creatingProvider !== undefined}
				schema={emailConfigSchema(Boolean(editing))}
				title={
					editing ? m.notifications_edit_config() : m.notifications_add_config()
				}
			/>
			<ModalForm
				key={testing?.id ?? "fallback-email-test"}
				description={
					testing ? testing.name : m.notifications_overall_test_description()
				}
				initialValues={{ recipient: "" }}
				onFinish={async (values) => {
					await test.mutateAsync({
						data: {
							configId: testing?.id ?? null,
							recipient: String(values.recipient ?? ""),
						},
					});
				}}
				onOpenChange={(open) => !open && setTesting(undefined)}
				open={testing !== undefined}
				schema={[
					{
						name: "recipient",
						label: m.common_email(),
						valueType: "email",
						required: true,
					},
				]}
				title={m.notifications_overall_test()}
			/>
		</div>
	);
}

function emailConfigValues(
	config: EmailConfig | undefined,
	provider: EmailProvider = "resend",
) {
	return {
		name: config?.name ?? "",
		provider: config?.provider ?? provider,
		apiKey: "",
		domain: config?.domain ?? "",
		region: config?.region ?? "us",
		smtpHost: config?.smtpHost ?? "",
		smtpPort: config?.smtpPort ?? 587,
		smtpUser: config?.smtpUser ?? "",
		fromAddress: config?.fromAddress ?? "",
		replyTo: config?.replyTo ?? "",
	};
}

function emailConfigSchema(editing: boolean): ProSchemaFormItem[] {
	const fullWidth = { className: "sm:col-span-2" };
	return [
		{ name: "name", label: m.notifications_config_name(), required: true },
		{
			name: "provider",
			label: m.notifications_email_provider(),
			valueType: "select",
			required: true,
			fieldProps: {
				options: emailProviderValues.map((value) => ({
					value,
					searchText: emailProviderName(value),
					label: (
						<span className="flex items-center gap-2">
							<EmailProviderLogo className="size-4" providerId={value} />
							{emailProviderName(value)}
						</span>
					),
				})),
			},
		},
		{
			name: "apiKey",
			label: m.notifications_api_key(),
			valueType: "password",
			required: !editing,
			hidden: (values) => values.provider === "cloudflare_email",
			description: editing ? m.notifications_secret_preserved() : undefined,
			formItemProps: fullWidth,
		},
		{
			name: "domain",
			label: m.notifications_mailgun_domain(),
			required: true,
			hidden: (values) => values.provider !== "mailgun",
		},
		{
			name: "region",
			label: m.notifications_mailgun_region(),
			valueType: "select",
			required: true,
			hidden: (values) => values.provider !== "mailgun",
			fieldProps: {
				options: [
					{ value: "us", label: "US" },
					{ value: "eu", label: "EU" },
				],
			},
		},
		{
			name: "smtpHost",
			label: m.notifications_smtp_host(),
			required: true,
			hidden: (values) => values.provider !== "smtp",
		},
		{
			name: "smtpPort",
			label: m.notifications_smtp_port(),
			required: true,
			hidden: (values) => values.provider !== "smtp",
			fieldProps: { inputMode: "numeric" },
		},
		{
			name: "smtpUser",
			label: m.notifications_smtp_user(),
			required: true,
			hidden: (values) => values.provider !== "smtp",
			formItemProps: fullWidth,
		},
		{
			name: "fromAddress",
			label: m.notifications_from_address(),
			required: true,
		},
		{
			name: "replyTo",
			label: m.notifications_reply_to(),
			valueType: "email",
		},
	];
}

function emailProviderName(provider: string) {
	if (provider === "cloudflare_email")
		return m.notifications_cloudflare_email_provider();
	if (provider === "smtp") return "SMTP";
	if (provider === "sendgrid") return "SendGrid";
	if (provider === "mailgun") return "Mailgun";
	if (provider === "postmark") return "Postmark";
	if (provider === "resend") return "Resend";
	return provider;
}
