"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	Download,
	Eye,
	MoreHorizontal,
	Pencil,
	Trash2,
	WalletCards,
} from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
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
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import {
	systemAccessQueryKey,
	systemAccessQueryOptions,
} from "#/features/access/queries";
import {
	hasSystemPermission,
	type SystemPermissionGrant,
	systemPermission,
} from "#/features/access/system-rbac";
import { isInternalIdentityEmail } from "#/features/auth/identity-email";
import { customerOperationErrorMessage } from "#/features/customers/error-message";
import {
	adjustCustomerWalletFn,
	deleteCustomerDataFn,
	exportCustomerDataFn,
	getCustomerFn,
	listUsersWithCommerceFn,
	updateCustomerFn,
} from "#/features/customers/server/admin";
import {
	entitlementStatusLabel,
	entitlementTypeLabel,
} from "#/features/entitlements/labels";
import { shopOrderStatusLabel } from "#/features/shop-orders/labels";
import {
	adminRoleIdsFromForm,
	UserEnabledSwitch,
	userSchema,
} from "#/features/users/components/admin-account-controls";
import { userOperationErrorMessage } from "#/features/users/error-message";
import {
	deleteUserFn,
	saveUserFn,
	setUserRolesFn,
} from "#/features/users/server/admin";
import type { AdminUserRecord } from "#/features/users/server/users";
import { ConfirmDialog } from "#/layouts/components/confirm-dialog";
import { PageHeader } from "#/layouts/components/page-header";
import { formatDateTime, formatMinorAmount, formatNumber } from "#/lib/format";
import { parseMajorInput } from "#/lib/money-input";
import { useCurrentProTableUrlState } from "#/lib/pro-table-url-state";
import { m } from "#/paraglide/messages";

type CustomerPageResult = Awaited<ReturnType<typeof listUsersWithCommerceFn>>;
type Customer = CustomerPageResult["data"][number];
type CustomerDetail = Awaited<ReturnType<typeof getCustomerFn>>;

export function UsersPage({
	permissions,
}: {
	permissions: readonly SystemPermissionGrant[];
}) {
	const tableUrlState = useCurrentProTableUrlState({ searchColumnId: "email" });
	const client = useQueryClient();
	const [refreshKey, setRefreshKey] = useState(0);
	const [editingUser, setEditingUser] = useState<Customer | null>(null);
	const [deletingUser, setDeletingUser] = useState<AdminUserRecord | null>(
		null,
	);
	const [detail, setDetail] = useState<CustomerDetail | null>(null);
	const [adjustingWallet, setAdjustingWallet] = useState<Customer | null>(null);
	const [exportingData, setExportingData] = useState<Customer | null>(null);
	const [deletingData, setDeletingData] = useState<Customer | null>(null);
	const [sensitiveProof, setSensitiveProof] = useState("");
	const canCreateUsers = hasSystemPermission(
		permissions,
		systemPermission("users", "create"),
	);
	const canUpdateUsers = hasSystemPermission(
		permissions,
		systemPermission("users", "update"),
	);
	const canDeleteUsers = hasSystemPermission(
		permissions,
		systemPermission("users", "delete"),
	);
	const canReadCustomers = hasSystemPermission(
		permissions,
		systemPermission("customers", "read"),
	);
	const canUpdateCustomers = hasSystemPermission(
		permissions,
		systemPermission("customers", "update"),
	);
	const canExportCustomers = hasSystemPermission(
		permissions,
		systemPermission("customers", "create"),
	);
	const canDeleteCustomerData = hasSystemPermission(
		permissions,
		systemPermission("customers", "delete"),
	);
	const access = useQuery({
		...systemAccessQueryOptions,
		enabled: canCreateUsers || canUpdateUsers,
	});
	const roleOptions = (access.data?.roles ?? [])
		.filter((role) => !["customer", "guest"].includes(role.name))
		.map((role) => ({ label: role.name, value: role.id }));
	const refresh = useCallback(async () => {
		await client.invalidateQueries({ queryKey: ["admin", "users"] });
		setRefreshKey((value) => value + 1);
	}, [client]);
	const saveUser = useMutation({ mutationFn: saveUserFn });
	const deleteUser = useMutation({
		mutationFn: deleteUserFn,
		onSuccess: async () => {
			setDeletingUser(null);
			await Promise.all([
				refresh(),
				client.invalidateQueries({ queryKey: systemAccessQueryKey }),
			]);
		},
		onError: (error) => toast.error(userOperationErrorMessage(error)),
	});
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
				queryKey: ["admin", "users", input],
				queryFn: () => listUsersWithCommerceFn({ data: input }),
			});
		},
		[client],
	);
	const update = useMutation({
		mutationFn: updateCustomerFn,
		onSuccess: async () => {
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
			closeExport();
		},
		onError: showError,
	});
	const deleteData = useMutation({
		mutationFn: deleteCustomerDataFn,
		onSuccess: async () => {
			setDeletingData(null);
			await refresh();
		},
		onError: showError,
	});

	async function saveAccount(values: Record<string, unknown>) {
		const enabled = editingUser?.userEnabled ?? true;
		let userId = editingUser?.id;
		if (!editingUser || canUpdateUsers) {
			const saved = await saveUser.mutateAsync({
				data: {
					...(editingUser ? { id: editingUser.id } : {}),
					name: String(values.name ?? ""),
					email:
						editingUser && isPlaceholderEmail(editingUser.email)
							? editingUser.email
							: String(values.email ?? ""),
					enabled,
					note: String(values.note ?? ""),
					password: String(values.password ?? ""),
				},
			});
			userId = saved.id;
			await setUserRolesFn({
				data: {
					userId,
					roleIds: adminRoleIdsFromForm(values.roles),
				},
			});
		}
		if (editingUser && canUpdateCustomers)
			await update.mutateAsync({
				data: {
					id: editingUser.id,
					name: String(values.name ?? ""),
					note: String(values.note ?? ""),
					status: enabled ? "active" : "disabled",
				},
			});
		setEditingUser(null);
		await Promise.all([
			refresh(),
			client.invalidateQueries({ queryKey: systemAccessQueryKey }),
		]);
	}

	const columns = useMemo<ColumnDef<Customer>[]>(
		() => [
			{
				accessorKey: "status",
				header: m.common_enabled(),
				cell: ({ row }) => {
					const user = adminUserFromCustomer(row.original);
					if (user && canUpdateUsers)
						return (
							<UserEnabledSwitch
								user={user}
								label={row.original.name || m.customers_customer()}
								onChanged={refresh}
							/>
						);
					return (
						<Badge
							variant={
								row.original.status === "active" ? "default" : "secondary"
							}
						>
							{customerStatusLabel(row.original.status)}
						</Badge>
					);
				},
			},
			{
				accessorKey: "email",
				header: m.customers_customer(),
				meta: { search: true },
				cell: ({ row }) => {
					const label = row.original.name || row.original.email;
					const loginMethods = visibleLoginMethods(
						row.original.loginMethods,
						row.original.email,
					);
					return (
						<div>
							{canReadCustomers ? (
								<button
									className="block font-semibold hover:underline"
									disabled={loadDetail.isPending}
									onClick={() =>
										loadDetail.mutate({ data: { id: row.original.id } })
									}
									type="button"
								>
									{label}
								</button>
							) : (
								<span className="block font-semibold">{label}</span>
							)}
							{loginMethods.some(
								(method) => method.providerId === "credential",
							) || isPlaceholderEmail(row.original.email) ? null : (
								<div className="flex flex-wrap items-center gap-1.5 font-mono text-muted-foreground text-xs">
									<span>
										email:{" "}
										{isPlaceholderEmail(row.original.email)
											? null
											: row.original.email}
									</span>
									<EmailStatusBadge
										email={row.original.email}
										verified={row.original.emailVerified}
									/>
								</div>
							)}
							{loginMethods.map((method) => (
								<div
									key={`${method.providerId}:${method.accountId}`}
									className="flex flex-wrap items-center gap-1.5 font-mono text-muted-foreground text-xs"
								>
									<span>
										{loginMethodKey(method.providerId)}:{" "}
										{loginBindingIdentifier(method, row.original.email)}
									</span>
									{method.providerId === "credential" ? (
										<EmailStatusBadge
											email={row.original.email}
											verified={row.original.emailVerified}
										/>
									) : null}
								</div>
							))}
						</div>
					);
				},
			},
			{
				accessorKey: "roles",
				header: m.admin_users_roles(),
				cell: ({ row }) =>
					row.original.roles.length ? (
						<div className="flex flex-wrap gap-1">
							{row.original.roles.map((role) => (
								<Badge key={role} variant="outline">
									{role}
								</Badge>
							))}
						</div>
					) : (
						"—"
					),
			},
			...(canReadCustomers
				? [
						{
							accessorKey: "balanceMinor",
							header: m.wallet_balance(),
							cell: ({ row }: { row: { original: Customer } }) =>
								formatMinorAmount(
									row.original.balanceMinor,
									row.original.balanceCurrency,
									row.original.balanceCurrencyDecimals,
								),
						},
						{
							accessorKey: "orderCount",
							header: m.customers_orders(),
							cell: ({ row }: { row: { original: Customer } }) =>
								formatNumber(row.original.orderCount),
						},
						{
							accessorKey: "activeEntitlementCount",
							header: m.customers_entitlements(),
							cell: ({ row }: { row: { original: Customer } }) =>
								`${formatNumber(row.original.activeEntitlementCount)} / ${formatNumber(row.original.entitlementCount)}`,
						},
						{
							id: "spent",
							header: m.customers_spent(),
							cell: ({ row }: { row: { original: Customer } }) =>
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
					]
				: []),
			{
				id: "actions",
				header: m.common_actions(),
				cell: ({ row }) => {
					const canEdit =
						Boolean(row.original.userId) &&
						(canUpdateUsers || canUpdateCustomers);
					const canDeleteAccount =
						Boolean(row.original.userId) && canDeleteUsers;
					const hasNonDeleteAction =
						canEdit ||
						canReadCustomers ||
						canUpdateCustomers ||
						canExportCustomers;
					const hasDeleteAction = canDeleteAccount || canDeleteCustomerData;
					if (!hasNonDeleteAction && !hasDeleteAction) return "—";
					return (
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
									{canEdit ? (
										<DropdownMenuItem
											onClick={() => setEditingUser(row.original)}
										>
											<Pencil />
											{m.admin_users_editUser()}
										</DropdownMenuItem>
									) : null}
									{canReadCustomers ? (
										<DropdownMenuItem
											disabled={loadDetail.isPending}
											onClick={() =>
												loadDetail.mutate({ data: { id: row.original.id } })
											}
										>
											<Eye />
											{m.customers_view()}
										</DropdownMenuItem>
									) : null}
									{canUpdateCustomers ? (
										<DropdownMenuItem
											onClick={() => setAdjustingWallet(row.original)}
										>
											<WalletCards />
											{m.wallet_adjust()}
										</DropdownMenuItem>
									) : null}
									{canExportCustomers ? (
										<DropdownMenuItem
											onClick={() => setExportingData(row.original)}
										>
											<Download />
											{m.customers_export_data()}
										</DropdownMenuItem>
									) : null}
									{hasNonDeleteAction && hasDeleteAction ? (
										<DropdownMenuSeparator />
									) : null}
									{canDeleteAccount ? (
										<DropdownMenuItem
											variant="destructive"
											onClick={() => {
												const user = adminUserFromCustomer(row.original);
												if (user) setDeletingUser(user);
											}}
										>
											<Trash2 />
											{m.admin_users_delete_title()}
										</DropdownMenuItem>
									) : null}
									{canDeleteCustomerData ? (
										<DropdownMenuItem
											onClick={() => setDeletingData(row.original)}
											variant="destructive"
										>
											<Trash2 />
											{m.customers_delete_data()}
										</DropdownMenuItem>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					);
				},
			},
		],
		[
			canDeleteCustomerData,
			canDeleteUsers,
			canExportCustomers,
			canReadCustomers,
			canUpdateCustomers,
			canUpdateUsers,
			loadDetail,
			refresh,
		],
	);

	return (
		<>
			<div className="flex min-h-0 w-full flex-1 flex-col gap-4">
				<PageHeader
					title={m.nav_user_management()}
					description={m.admin_users_description()}
					actions={
						canCreateUsers ? (
							<ModalForm
								key="create-user"
								trigger={<ProButton>{m.admin_users_newUser()}</ProButton>}
								title={m.admin_users_newUser()}
								schema={userSchema({
									mode: "create",
									roleOptions,
									profileFields: true,
								})}
								onFinish={saveAccount}
								onFinishFailed={(error) =>
									toast.error(userOperationErrorMessage(error))
								}
							/>
						) : undefined
					}
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
			{editingUser ? (
				<ModalForm
					key={editingUser.id}
					open
					onOpenChange={(open) => !open && setEditingUser(null)}
					title={m.admin_users_editUser()}
					schema={userSchema({
						mode: "edit",
						roleOptions,
						accountFields: canUpdateUsers,
						emailField:
							canUpdateUsers && !isPlaceholderEmail(editingUser.email),
						profileFields: canUpdateCustomers,
					})}
					initialValues={{
						name: editingUser.name,
						email: isPlaceholderEmail(editingUser.email)
							? undefined
							: editingUser.email,
						note: editingUser.note ?? "",
						roles: roleOptions
							.filter((option) => editingUser.roles.includes(option.label))
							.map((option) => option.value),
					}}
					onFinish={saveAccount}
					onFinishFailed={(error) =>
						toast.error(userOperationErrorMessage(error))
					}
				/>
			) : null}
			{adjustingWallet ? (
				<WalletAdjustmentModal
					customerId={adjustingWallet.id}
					currency={adjustingWallet.balanceCurrency}
					currencyDecimals={adjustingWallet.balanceCurrencyDecimals}
					currentBalanceMinor={adjustingWallet.balanceMinor}
					onOpenChange={(open) => !open && setAdjustingWallet(null)}
					onUpdated={async () => {
						setAdjustingWallet(null);
						await refresh();
					}}
					open
				/>
			) : null}
			<CustomerDetailModal
				canUpdate={canUpdateCustomers}
				detail={detail}
				onOpenChange={(open) => !open && setDetail(null)}
				onUpdated={async () => {
					await refresh();
					if (detail) await loadDetail.mutateAsync({ data: { id: detail.id } });
				}}
			/>
			<ModalForm
				open={Boolean(exportingData)}
				onOpenChange={(open) => !open && closeExport()}
				title={m.customers_export_data()}
				description={m.customers_sensitive_action_description()}
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
					if (!exportingData) return;
					const proof = String(values.proof ?? "");
					setSensitiveProof(proof);
					await exportData.mutateAsync({
						data: { id: exportingData.id, password: proof },
					});
				}}
				onFinishFailed={showError}
			/>
			<ConfirmDialog
				open={Boolean(deletingData)}
				onOpenChange={(open) => !open && setDeletingData(null)}
				title={m.customers_delete_data()}
				desc={m.customers_delete_data_description()}
				confirmText={m.customers_delete_data()}
				destructive
				isLoading={deleteData.isPending}
				handleConfirm={() => {
					if (deletingData)
						deleteData.mutate({ data: { id: deletingData.id } });
				}}
			/>
			<ConfirmDialog
				open={Boolean(deletingUser)}
				onOpenChange={(open) => !open && setDeletingUser(null)}
				title={m.admin_users_delete_title()}
				desc={m.admin_users_delete_description({
					email: deletingUser?.name || m.customers_customer(),
				})}
				confirmText={m.common_delete()}
				destructive
				isLoading={deleteUser.isPending}
				handleConfirm={() => {
					if (deletingUser)
						deleteUser.mutate({ data: { id: deletingUser.id } });
				}}
			/>
		</>
	);

	function closeExport() {
		setExportingData(null);
		setSensitiveProof("");
	}
}

function CustomerDetailModal({
	canUpdate,
	detail,
	onOpenChange,
	onUpdated,
}: {
	canUpdate: boolean;
	detail: CustomerDetail | null;
	onOpenChange: (open: boolean) => void;
	onUpdated: () => Promise<void>;
}) {
	const loginMethods = detail
		? visibleLoginMethods(detail.loginMethods, detail.email)
		: [];
	return (
		<ProModal
			open={Boolean(detail)}
			onOpenChange={onOpenChange}
			title={detail?.name || detail?.email || m.customers_customer()}
			description={
				detail?.email && !isPlaceholderEmail(detail.email)
					? detail.email
					: undefined
			}
			className="sm:max-w-3xl"
		>
			{detail ? (
				<div className="grid gap-5 overflow-y-auto">
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<Summary
							label={m.wallet_balance()}
							value={formatMinorAmount(
								detail.wallet.balanceMinor,
								detail.wallet.currency,
								detail.wallet.currencyDecimals,
							)}
						/>
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
						<h3 className="font-semibold">{m.admin_users_login_methods()}</h3>
						{loginMethods.length ? (
							<div className="grid gap-2">
								{loginMethods.map((method) => (
									<div
										key={`${method.providerId}:${method.accountId}`}
										className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
									>
										<div className="flex items-center gap-2">
											<Badge variant="outline">
												{loginMethodLabel(method.providerId)}
											</Badge>
											<span>{loginMethodIdentity(method, detail.email)}</span>
										</div>
										<span className="text-muted-foreground text-xs">
											{m.admin_users_linked_at({
												date: formatDateTime(method.createdAt),
											})}
										</span>
									</div>
								))}
							</div>
						) : (
							<p className="text-muted-foreground text-sm">
								{m.admin_users_no_login_methods()}
							</p>
						)}
					</section>
					<section className="grid gap-2">
						<div className="flex items-center justify-between gap-3">
							<h3 className="font-semibold">{m.customers_balances()}</h3>
							{canUpdate ? (
								<WalletAdjustmentModal
									customerId={detail.id}
									currency={detail.wallet.currency}
									currencyDecimals={detail.wallet.currencyDecimals}
									currentBalanceMinor={detail.wallet.balanceMinor}
									onUpdated={onUpdated}
									trigger={<ProButton size="sm">{m.wallet_adjust()}</ProButton>}
								/>
							) : null}
						</div>
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

function WalletAdjustmentModal({
	customerId,
	currency,
	currencyDecimals,
	currentBalanceMinor,
	open,
	onOpenChange,
	onUpdated,
	trigger,
}: {
	customerId: string;
	currency: string;
	currencyDecimals: number;
	currentBalanceMinor: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onUpdated: () => Promise<void>;
	trigger?: ReactNode;
}) {
	const adjust = useMutation({
		mutationFn: adjustCustomerWalletFn,
		onError: showError,
	});
	return (
		<ModalForm
			description={`${m.wallet_balance()}: ${formatMinorAmount(currentBalanceMinor, currency, currencyDecimals)}`}
			initialValues={{ direction: "credit" }}
			onFinish={async (values) => {
				await adjust.mutateAsync({
					data: {
						id: customerId,
						direction: String(values.direction) as "credit" | "debit",
						amountMinor: String(values.amountMinor ?? ""),
						reason: String(values.reason ?? ""),
						idempotencyKey: crypto.randomUUID(),
					},
				});
				await onUpdated();
			}}
			onOpenChange={onOpenChange}
			open={open}
			schema={[
				{
					name: "direction",
					label: m.wallet_adjust_direction(),
					valueType: "select" as const,
					required: true,
					fieldProps: {
						options: [
							{ label: m.wallet_credit(), value: "credit" },
							{ label: m.wallet_debit(), value: "debit" },
						],
					},
				},
				{
					name: "amountMinor",
					label: m.wallet_adjust_amount(),
					required: true,
					render: (field) => (
						<WalletAmountInput
							currency={currency}
							decimals={currencyDecimals}
							onChange={field.onChange}
						/>
					),
				},
				{
					name: "reason",
					label: m.wallet_adjust_reason(),
					required: true,
				},
			]}
			title={m.wallet_adjust()}
			trigger={trigger}
			validate={(values) => {
				const errors: Record<string, string[]> = {};
				if (!isPositiveMinor(values.amountMinor))
					errors.amountMinor = [m.store_input_required()];
				return errors;
			}}
		/>
	);
}

function isPositiveMinor(value: unknown) {
	return typeof value === "string" && /^\d+$/.test(value) && BigInt(value) > 0n;
}

function WalletAmountInput({
	currency,
	decimals,
	onChange,
}: {
	currency: string;
	decimals: number;
	onChange: (value: string) => void;
}) {
	const [display, setDisplay] = useState("");
	return (
		<div className="relative">
			<Input
				className="pr-16"
				inputMode="decimal"
				onChange={(event) => {
					const value = event.target.value;
					setDisplay(value);
					const parsed = parseMajorInput(value, decimals);
					onChange(parsed === undefined ? "" : (parsed ?? ""));
				}}
				value={display}
			/>
			<span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground text-sm">
				{currency}
			</span>
		</div>
	);
}

function loginMethodKey(providerId: string) {
	return providerId === "credential" ? "email" : providerId;
}

function loginMethodLabel(providerId: string) {
	if (providerId === "credential")
		return m.admin_users_login_method_credential();
	if (providerId === "telegram") return "Telegram";
	return providerId;
}

function loginMethodIdentity(
	method: CustomerDetail["loginMethods"][number],
	email: string,
) {
	if (method.providerId === "credential") return email;
	if (method.providerId === "telegram") {
		const username = method.telegramUsername
			? `@${method.telegramUsername}`
			: null;
		const telegramId = method.telegramId ?? method.accountId;
		return [username, `ID ${telegramId}`].filter(Boolean).join(" · ");
	}
	return method.accountId;
}

function loginBindingIdentifier(
	method: CustomerDetail["loginMethods"][number],
	email: string,
) {
	if (method.providerId === "credential") return email;
	return method.telegramId ?? method.accountId;
}

function visibleLoginMethods(
	methods: CustomerDetail["loginMethods"],
	email: string,
) {
	return methods.filter(
		(method) =>
			method.providerId !== "credential" || !isPlaceholderEmail(email),
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

function isPlaceholderEmail(email: string) {
	return isInternalIdentityEmail(email);
}

function EmailStatusBadge({
	email,
	verified,
}: {
	email: string;
	verified: boolean;
}) {
	return (
		<Badge
			className="px-1.5 py-0 font-sans text-[10px]"
			variant={verified ? "secondary" : "outline"}
		>
			{isPlaceholderEmail(email)
				? m.admin_users_email_unbound()
				: verified
					? m.admin_users_email_verified()
					: m.admin_users_email_unverified()}
		</Badge>
	);
}

function adminUserFromCustomer(customer: Customer): AdminUserRecord | null {
	if (!customer.userId || customer.userEnabled == null) return null;
	return {
		id: customer.userId,
		name: customer.name ?? "",
		email: customer.email,
		enabled: customer.userEnabled,
		emailVerified: customer.emailVerified === true,
		createdAt: new Date(customer.createdAt).toISOString(),
		updatedAt: new Date(customer.updatedAt).toISOString(),
		roles: customer.roles.filter(
			(role) => role !== "customer" && role !== "guest",
		),
	};
}

function showError(error: unknown) {
	toast.error(customerOperationErrorMessage(error));
}
