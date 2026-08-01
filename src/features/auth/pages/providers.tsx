"use client";

import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	ChevronDown,
	MoreHorizontal,
	Pencil,
	Plus,
	Settings2,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfigurationLogoField } from "#/components/configuration-logo-field";
import { ProButton } from "#/components/pro/base/button";
import { formBooleanValue, ModalForm } from "#/components/pro/form";
import { ProTable } from "#/components/pro/table";
import { AuthProviderLogo } from "#/components/provider-logo";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";
import { authProviderErrorMessage } from "#/features/auth/error-message";
import { authProviderPresets } from "#/features/auth/provider-presets";
import type { authProviderTypes } from "#/features/auth/provider-schema";
import {
	deleteAuthProviderFn,
	listAuthProvidersFn,
	removeAuthProviderLogoFn,
	reorderAuthProvidersFn,
	saveAuthProviderFn,
	setAuthProviderEnabledFn,
	uploadAuthProviderLogoFn,
} from "#/features/auth/server/provider-admin";
import {
	listSystemSettingsFn,
	updateSystemSettingsFn,
} from "#/features/settings/server/admin";
import { ConfirmDialog } from "#/layouts/components/confirm-dialog";
import { PageHeader } from "#/layouts/components/page-header";
import { useCurrentProTableUrlState } from "#/lib/pro-table-url-state";
import { m } from "#/paraglide/messages";

const authProvidersQueryKey = ["admin", "auth-providers"] as const;
const authProvidersQueryOptions = queryOptions({
	queryKey: authProvidersQueryKey,
	queryFn: () => listAuthProvidersFn(),
});

type ProviderResult = Awaited<ReturnType<typeof listAuthProvidersFn>>;
type Provider = ProviderResult["providers"][number];
type ProviderPreset = (typeof authProviderPresets)[number];

export function AuthProvidersPage() {
	const tableUrlState = useCurrentProTableUrlState({
		searchColumnId: "displayName",
	});
	const queryClient = useQueryClient();
	const query = useQuery(authProvidersQueryOptions);
	const [creating, setCreating] = useState<ProviderPreset | null>(null);
	const [editing, setEditing] = useState<Provider | null>(null);
	const [deleting, setDeleting] = useState<Provider | null>(null);
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: authProvidersQueryKey });
	const save = useMutation({
		mutationFn: saveAuthProviderFn,
		onSuccess: async () => {
			setEditing(null);
			toast.success(m.auth_provider_saved());
			await refresh();
		},
		onError: showAuthProviderError,
	});
	const remove = useMutation({
		mutationFn: deleteAuthProviderFn,
		onSuccess: async () => {
			setDeleting(null);
			await refresh();
		},
		onError: showAuthProviderError,
	});
	const toggle = useMutation({
		mutationFn: setAuthProviderEnabledFn,
		onSuccess: refresh,
		onError: showAuthProviderError,
	});
	const reorder = useMutation({
		mutationFn: reorderAuthProvidersFn,
		onSuccess: refresh,
		onError: showAuthProviderError,
	});
	const columns = useMemo<ColumnDef<Provider>[]>(
		() => [
			{
				accessorKey: "enabled",
				header: m.common_enabled(),
				cell: ({ row }) => (
					<Switch
						aria-label={`${m.common_enabled()} · ${row.original.displayName}`}
						checked={row.original.enabled}
						disabled={toggle.isPending}
						onCheckedChange={(enabled) =>
							toggle.mutate({ data: { id: row.original.id, enabled } })
						}
					/>
				),
			},
			{
				accessorKey: "displayName",
				header: m.common_name(),
				meta: { search: true },
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<AuthProviderLogo
							className="size-9 rounded-lg"
							logoUrl={row.original.icon}
							providerId={row.original.providerId}
						/>
						<div>
							<strong className="block">{row.original.displayName}</strong>
							{row.original.callbackUrl ? (
								<code className="mt-1 block max-w-80 truncate text-muted-foreground text-xs">
									{row.original.callbackUrl}
								</code>
							) : null}
						</div>
					</div>
				),
			},
			{
				accessorKey: "hasClientSecret",
				header: m.auth_provider_client_secret(),
				cell: ({ row }) => (row.original.hasClientSecret ? "••••••••" : "—"),
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
								<DropdownMenuItem onClick={() => setEditing(row.original)}>
									<Pencil />
									{m.common_edit()}
								</DropdownMenuItem>
								<DropdownMenuItem
									variant="destructive"
									disabled={row.original.providerId === "credential"}
									onClick={() => setDeleting(row.original)}
								>
									<Trash2 />
									{m.common_delete()}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				),
			},
		],
		[toggle.isPending, toggle.mutate],
	);

	async function submit(
		values: Record<string, unknown>,
		provider?: Provider,
		preset?: ProviderPreset,
	) {
		const source = provider ?? preset;
		await save.mutateAsync({
			data: {
				id: provider?.id,
				providerId: source?.providerId ?? "",
				providerType: source?.providerType ?? "social",
				displayName: String(values.displayName ?? ""),
				clientId: optionalString(values.clientId),
				clientSecret: optionalString(values.clientSecret) ?? undefined,
				clearClientSecret: formBooleanValue(values.clearClientSecret),
				telegramMiniAppEnabled: formBooleanValue(values.telegramMiniAppEnabled),
				telegramBotToken: optionalString(values.telegramBotToken) ?? undefined,
				scopes: Array.isArray(values.scopes) ? values.scopes.map(String) : [],
				allowSignup: formBooleanValue(values.allowSignup),
				passwordLoginEnabled: formBooleanValue(values.passwordLoginEnabled),
				emailOtpEnabled: formBooleanValue(values.emailOtpEnabled),
				enabled: formBooleanValue(values.enabled),
				sortOrder: provider?.sortOrder ?? 100,
			},
		});
	}

	return (
		<>
			<div className="flex min-h-0 w-full flex-1 flex-col gap-4">
				<PageHeader
					title={m.auth_providers_title()}
					description={m.auth_providers_description()}
					actions={
						<div className="flex items-center gap-2">
							<AuthPolicyModal />
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<ProButton>
										<Plus />
										{m.auth_provider_new()}
										<ChevronDown />
									</ProButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="max-h-80 overflow-y-auto"
								>
									{authProviderPresets.map((preset) => (
										<DropdownMenuItem
											key={`${preset.providerType}:${preset.providerId}`}
											disabled={query.data?.providers.some(
												(provider) => provider.providerId === preset.providerId,
											)}
											onClick={() => setCreating(preset)}
										>
											<AuthProviderLogo
												className="size-4"
												providerId={preset.providerId}
											/>
											{preset.displayName}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					}
				/>
				<ProTable
					initialState={tableUrlState.initialState}
					onChange={tableUrlState.onChange}
					className="min-h-0 flex-1"
					columns={columns}
					data={query.data?.providers ?? []}
					dragSort={{
						rowKey: "id",
						onDragSortEnd: (rows) =>
							reorder.mutate({ data: { ids: rows.map((row) => row.id) } }),
					}}
					loading={query.isPending}
					onRefresh={() => query.refetch()}
					toolbarSearch={{
						columnId: "displayName",
						placeholder: m.common_search(),
					}}
					table={{ stickyHeader: true }}
				/>
			</div>
			{creating ? (
				<ModalForm
					key={`${creating.providerType}:${creating.providerId}`}
					open
					onOpenChange={(open) => !open && setCreating(null)}
					title={`${m.auth_provider_new()} · ${creating.displayName}`}
					schema={providerFormSchema({ preset: creating })}
					initialValues={providerPresetValues(creating)}
					onFinish={(values) => submit(values, undefined, creating)}
					modalClassName="sm:max-w-2xl"
					fieldsClassName="grid gap-4 space-y-0 sm:grid-cols-2"
				/>
			) : null}
			{editing ? (
				<ModalForm
					key={editing.id}
					open
					onOpenChange={(open) => !open && setEditing(null)}
					title={m.common_edit()}
					schema={providerFormSchema({
						callbackUrl: editing.callbackUrl,
						providerId: editing.providerId,
						providerType: editing.providerType,
					})}
					initialValues={providerValues(editing)}
					onFinish={(values) => submit(values, editing)}
					modalClassName="sm:max-w-2xl"
					fieldsClassName="grid gap-4 space-y-0 sm:grid-cols-2"
				>
					<ConfigurationLogoField
						id={editing.id}
						onChanged={refresh}
						remove={removeAuthProviderLogoFn}
						upload={uploadAuthProviderLogoFn}
						url={editing.icon?.startsWith("/") ? editing.icon : null}
					/>
				</ModalForm>
			) : null}
			<ConfirmDialog
				open={Boolean(deleting)}
				onOpenChange={(open) => !open && setDeleting(null)}
				title={m.auth_provider_delete_title()}
				desc={m.auth_provider_delete_description({
					name: deleting?.displayName ?? "",
				})}
				confirmText={m.common_delete()}
				destructive
				isLoading={remove.isPending}
				handleConfirm={() =>
					deleting && remove.mutate({ data: { id: deleting.id } })
				}
			/>
		</>
	);
}

function AuthPolicyModal() {
	const settings = useQuery({
		queryKey: ["admin", "settings", "auth-policy"],
		queryFn: () => listSystemSettingsFn(),
	});
	const [requireVerification, setRequireVerification] = useState(false);
	const [sessionMaxAge, setSessionMaxAge] = useState(2_592_000);
	const save = useMutation({
		mutationFn: updateSystemSettingsFn,
		onSuccess: () => toast.success(m.settings_saved()),
		onError: () => toast.error(m.settings_save_failed()),
	});
	const verificationSetting = settings.data?.find(
		(setting) => setting.key === "auth.require_email_verification",
	);
	const sessionSetting = settings.data?.find(
		(setting) => setting.key === "auth.session_max_age_seconds",
	);
	useEffect(() => {
		if (typeof verificationSetting?.value === "boolean")
			setRequireVerification(verificationSetting.value);
		if (typeof sessionSetting?.value === "number")
			setSessionMaxAge(sessionSetting.value);
	}, [sessionSetting?.value, verificationSetting?.value]);
	return (
		<ModalForm
			title={m.auth_policy_title()}
			trigger={
				<ProButton variant="outline">
					<Settings2 />
					{m.auth_policy_title()}
				</ProButton>
			}
			submitter={false}
		>
			<div className="grid gap-4">
				<div className="flex items-center justify-between gap-4 rounded-lg border p-3">
					<div>
						<Label htmlFor="require-email-verification">
							{m.auth_require_email_verification()}
						</Label>
						<p className="mt-1 text-muted-foreground text-xs">
							{m.auth_require_email_verification_description()}
						</p>
					</div>
					<Switch
						checked={requireVerification}
						id="require-email-verification"
						onCheckedChange={setRequireVerification}
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="session-max-age">{m.auth_session_max_age()}</Label>
					<Input
						id="session-max-age"
						inputMode="numeric"
						max={31_536_000}
						min={3_600}
						onChange={(event) => setSessionMaxAge(Number(event.target.value))}
						type="number"
						value={sessionMaxAge}
					/>
				</div>
				<Button
					type="button"
					disabled={save.isPending}
					onClick={() =>
						save.mutate({
							data: {
								items: [
									{
										key: "auth.require_email_verification",
										value: requireVerification,
									},
									{
										key: "auth.session_max_age_seconds",
										value: sessionMaxAge,
									},
								],
							},
						})
					}
				>
					{m.settings_save_changes()}
				</Button>
			</div>
		</ModalForm>
	);
}

function providerFormSchema({
	callbackUrl,
	providerId,
	providerType,
	preset,
}: {
	callbackUrl?: string | null;
	providerId?: string;
	providerType?: (typeof authProviderTypes)[number];
	preset?: ProviderPreset;
}) {
	const type = preset?.providerType ?? providerType;
	const resolvedProviderId = preset?.providerId ?? providerId;
	const usesClientCredentials = type === "social";
	const usesSeparateClientSecret =
		usesClientCredentials && resolvedProviderId !== "telegram";
	const scopeOptions = providerScopeOptions(resolvedProviderId);
	const usesScopes = type === "social" && scopeOptions.length > 0;
	return [
		{
			name: "displayName",
			label: m.common_name(),
			required: true,
			formItemProps: { className: "sm:col-span-2" },
		},
		...(callbackUrl
			? [
					{
						name: "callbackUrl",
						label: m.auth_provider_callback_url(),
						disabled: true,
						formItemProps: { className: "sm:col-span-2" },
					},
				]
			: []),
		...(usesClientCredentials
			? [
					{ name: "clientId", label: m.auth_provider_client_id() },
					...(usesSeparateClientSecret
						? [
								{
									name: "clientSecret",
									label: m.auth_provider_client_secret(),
									valueType: "password" as const,
									description: m.auth_provider_secret_configured(),
								},
							]
						: []),
					...(!preset && usesSeparateClientSecret
						? [
								{
									name: "clearClientSecret",
									label: m.common_delete(),
									valueType: "switch" as const,
								},
							]
						: []),
				]
			: []),
		...(resolvedProviderId === "telegram"
			? [
					{
						name: "telegramBotToken",
						label: m.telegram_bot_token(),
						valueType: "password" as const,
						required: Boolean(preset),
						description: preset
							? m.telegram_add_bot_description()
							: m.telegram_token_preserve_description(),
						formItemProps: { className: "sm:col-span-2" },
					},
					{
						name: "telegramMiniAppEnabled",
						label: m.auth_telegram_mini_app_enabled(),
						valueType: "switch" as const,
						description: m.auth_telegram_mini_app_enabled_description(),
						formItemProps: { className: "sm:col-span-2" },
					},
				]
			: []),
		...(usesScopes
			? [
					{
						name: "scopes",
						label: m.auth_provider_scopes(),
						valueType: "checkbox" as const,
						fieldProps: {
							optionsClassName: "grid gap-x-6 gap-y-3 sm:grid-cols-2",
							options: scopeOptions.map((scope) => ({
								label: scope,
								value: scope,
								description: scopeDescription(scope),
								disabled:
									resolvedProviderId === "telegram" && scope === "openid",
							})),
						},
						formItemProps: { className: "sm:col-span-2" },
					},
				]
			: []),
		...(type === "email"
			? [
					{
						name: "passwordLoginEnabled",
						label: m.auth_email_password_login(),
						valueType: "switch" as const,
					},
					{
						name: "emailOtpEnabled",
						label: m.auth_email_otp_login(),
						valueType: "switch" as const,
						description: m.auth_email_otp_login_description(),
					},
				]
			: []),
		{
			name: "allowSignup",
			label: m.auth_provider_allow_signup(),
			valueType: "switch" as const,
		},
		{
			name: "enabled",
			label: m.common_enabled(),
			valueType: "switch" as const,
		},
	];
}

function providerPresetValues(preset: ProviderPreset) {
	return {
		...preset,
		clientId: "",
		clientSecret: "",
		clearClientSecret: false,
		telegramMiniAppEnabled: false,
		telegramBotToken: "",
		scopes: [...preset.scopes],
		allowSignup: true,
		passwordLoginEnabled: false,
		emailOtpEnabled: false,
		enabled: false,
	};
}

function providerValues(provider: Provider) {
	return {
		displayName: provider.displayName,
		providerId: provider.providerId,
		providerType: provider.providerType,
		callbackUrl: provider.callbackUrl ?? "",
		clientId: provider.clientId ?? "",
		clientSecret: "",
		clearClientSecret: false,
		telegramMiniAppEnabled: provider.telegramMiniAppEnabled,
		telegramBotToken: "",
		scopes: provider.scopes,
		allowSignup: provider.allowSignup,
		passwordLoginEnabled: provider.passwordLoginEnabled,
		emailOtpEnabled: provider.emailOtpEnabled,
		enabled: provider.enabled,
	};
}

function providerScopeOptions(providerId?: string) {
	if (providerId === "telegram") return ["openid", "profile", "phone"];
	return (
		authProviderPresets.find(
			(preset) =>
				preset.providerType === "social" && preset.providerId === providerId,
		)?.scopes ?? []
	);
}

function scopeDescription(scope: string) {
	return {
		openid: m.auth_scope_openid_description(),
		profile: m.auth_scope_profile_description(),
		phone: m.auth_scope_phone_description(),
		email: m.auth_scope_email_description(),
	}[scope];
}

function optionalString(value: unknown) {
	const normalized = String(value ?? "").trim();
	return normalized || null;
}

function showAuthProviderError(error: unknown) {
	toast.error(authProviderErrorMessage(error));
}
