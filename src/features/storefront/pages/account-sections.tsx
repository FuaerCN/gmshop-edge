"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import {
	ArrowRight,
	Boxes,
	CalendarDays,
	Copy,
	Download,
	Eye,
	FileDown,
	KeyRound,
	PackageOpen,
	ReceiptText,
	RefreshCw,
	ShoppingBag,
	WandSparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CopyButton, ProButton } from "#/components/pro/base/button";
import { ProSchemaForm } from "#/components/pro/form";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { Skeleton } from "#/components/ui/skeleton";
import { authClient } from "#/features/auth/auth-client";
import { listPublicAuthProvidersFn } from "#/features/auth/server/provider-admin";
import { entitlementStatusLabel } from "#/features/entitlements/labels";
import { shopOrderStatusLabel } from "#/features/shop-orders/labels";
import { AutomationEntitlementCard } from "#/features/storefront/components/build-entitlement";
import {
	AccountLoginMethods,
	AccountNotificationPreferences,
	AccountSessions,
} from "#/features/storefront/pages/account";
import type { getStoreAccountFn } from "#/features/storefront/server/account-functions";
import {
	getAccountOrderFn,
	prepareEntitlementRenewalFn,
	setAccountPasswordFn,
	updateStoreProfileFn,
} from "#/features/storefront/server/account-functions";
import { ChangePasswordForm } from "#/layouts/components/change-password-dialog";
import {
	formatBytes,
	formatDate,
	formatDateTime,
	formatMinorAmountWithSymbol,
} from "#/lib/format";
import { localeLabels, supportedLocales } from "#/lib/locales";
import { m } from "#/paraglide/messages";

type Account = Awaited<ReturnType<typeof getStoreAccountFn>>;

export function AccountOverviewPage({ account }: { account: Account }) {
	const actionNeeded = account.orders.filter(
		(order) => order.status === "pending_payment",
	).length;
	const activeEntitlements = account.entitlements.filter(
		(entitlement) => entitlement.status === "active",
	).length;
	return (
		<>
			<PageTitle
				title={m.store_account_title()}
				description={m.store_account_overview_description()}
			/>
			<div className="grid gap-3 sm:grid-cols-3">
				<Summary
					icon={<ReceiptText />}
					label={m.store_account_orders()}
					value={account.orders.length}
				/>
				<Summary
					icon={<PackageOpen />}
					label={m.store_account_action_needed()}
					value={actionNeeded}
				/>
				<Summary
					icon={<Boxes />}
					label={m.store_account_active_entitlements()}
					value={activeEntitlements}
				/>
			</div>
			<section>
				<div className="flex items-center justify-between gap-4">
					<h2 className="font-semibold text-xl">
						{m.store_account_recent_orders()}
					</h2>
					{account.orders.length > 0 ? (
						<Button asChild size="sm" variant="ghost">
							<Link to="/account/orders">
								{m.store_account_view_all_orders()}
								<ArrowRight />
							</Link>
						</Button>
					) : null}
				</div>
				<div className="mt-3 grid gap-4 lg:grid-cols-2">
					{account.orders.slice(0, 5).map((order) => (
						<OrderLink key={order.orderNumber} order={order} />
					))}
					{account.orders.length === 0 ? (
						<Empty
							action={
								<Button asChild>
									<Link to="/">
										<ShoppingBag />
										{m.store_account_start_shopping()}
									</Link>
								</Button>
							}
							description={m.store_account_empty_orders_description()}
							title={m.store_account_no_orders()}
						/>
					) : null}
				</div>
			</section>
		</>
	);
}

export function AccountOrdersPage({ account }: { account: Account }) {
	return (
		<>
			<PageTitle
				title={m.store_account_orders()}
				description={m.store_account_orders_description()}
			/>
			<div className="grid gap-4 lg:grid-cols-2">
				{account.orders.map((order) => (
					<OrderLink key={order.orderNumber} order={order} />
				))}
				{account.orders.length === 0 ? (
					<Empty
						action={
							<Button asChild>
								<Link to="/">
									<ShoppingBag />
									{m.store_account_start_shopping()}
								</Link>
							</Button>
						}
						description={m.store_account_empty_orders_description()}
						title={m.store_account_no_orders()}
					/>
				) : null}
			</div>
		</>
	);
}

export function AccountEntitlementsPage({ account }: { account: Account }) {
	const navigate = useNavigate();
	const entitlements = account.entitlements.filter(
		(entitlement) => entitlement.status !== "exhausted",
	);
	const renew = useMutation({
		mutationFn: prepareEntitlementRenewalFn,
		onSuccess: (result) => {
			sessionStorage.setItem(
				`gmshop-renewal:${result.sellableItemId}`,
				result.entitlementId,
			);
			void navigate({ to: "/checkout" });
		},
		onError: () => toast.error(m.store_checkout_failed()),
	});
	return (
		<>
			<PageTitle
				title={m.store_account_entitlements()}
				description={m.store_account_entitlements_description()}
			/>
			<div className="grid gap-4 lg:grid-cols-2">
				{entitlements.map((entitlement) => (
					<EntitlementCard
						entitlement={entitlement}
						key={entitlement.id}
						onRenew={() =>
							renew.mutate({
								data: { entitlementId: entitlement.id },
							})
						}
						renewing={renew.isPending}
					/>
				))}
				{entitlements.length === 0 ? (
					<Empty
						action={
							<Button asChild>
								<Link to="/">
									<ShoppingBag />
									{m.store_account_start_shopping()}
								</Link>
							</Button>
						}
						description={m.store_account_empty_entitlements_description()}
						title={m.store_account_no_entitlements()}
					/>
				) : null}
			</div>
		</>
	);
}

function EntitlementCard({
	entitlement,
	onRenew,
	renewing,
}: {
	entitlement: Account["entitlements"][number];
	onRenew: () => void;
	renewing: boolean;
}) {
	const navigate = useNavigate();
	const EntitlementIcon =
		entitlement.type === "stock"
			? KeyRound
			: entitlement.type === "download"
				? FileDown
				: WandSparkles;
	const remaining =
		entitlement.usageLimit !== null
			? m.store_account_entitlement_times({
					count: Math.max(0, entitlement.usageLimit - entitlement.usageCount),
				})
			: entitlement.accessLimit !== null
				? m.store_account_entitlement_times({
						count: Math.max(
							0,
							entitlement.accessLimit - entitlement.accessCount,
						),
					})
				: m.store_account_entitlement_unlimited();
	const expired = entitlement.status === "expired";
	return (
		<article
			className="group flex min-w-0 flex-col rounded-3xl border bg-card p-5 transition-colors hover:border-primary/35 sm:p-6"
			data-status={entitlement.status}
		>
			<header className="flex items-start justify-between gap-4">
				<div className="flex min-w-0 items-start gap-3">
					<span
						className={`grid size-10 shrink-0 place-items-center rounded-xl ${
							expired
								? "bg-muted text-muted-foreground"
								: "bg-primary/10 text-primary"
						}`}
					>
						<EntitlementIcon className="size-5" />
					</span>
					<div className="min-w-0">
						<strong className="block truncate text-base">
							{entitlement.productName}
						</strong>
						{entitlement.sellableItemName !== entitlement.productName ? (
							<p className="mt-1 truncate text-muted-foreground text-sm">
								{entitlement.sellableItemName}
							</p>
						) : null}
						<Badge className="mt-2" variant={expired ? "secondary" : "outline"}>
							{entitlementStatusLabel(entitlement.status)}
						</Badge>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					{entitlement.renewable ? (
						<ProButton
							disabled={renewing}
							onClick={onRenew}
							size="sm"
							variant="outline"
						>
							<RefreshCw />
							{m.store_entitlement_renew()}
						</ProButton>
					) : null}
					<ProButton
						onClick={() =>
							void navigate({
								to: "/account/orders/$orderNumber",
								params: { orderNumber: entitlement.orderNumber },
								search: { from: "entitlements" },
							})
						}
						size="sm"
						variant="outline"
					>
						<ReceiptText />
						{m.store_account_entitlement_details()}
					</ProButton>
				</div>
			</header>
			<div className="mt-7 flex flex-1 items-end justify-between gap-6">
				<div>
					<p className="text-muted-foreground text-xs">
						{m.store_account_entitlement_quota()}
					</p>
					<p className="mt-1 font-semibold text-2xl tracking-tight">
						{remaining}
					</p>
				</div>
				<div className="min-w-0 text-right">
					<p className="text-muted-foreground text-xs">
						{m.store_account_entitlement_validity()}
					</p>
					<p className="mt-1 flex items-center justify-end gap-1.5 font-medium text-sm">
						<CalendarDays className="size-4 text-primary" />
						{entitlement.expiresAt ? (
							<time
								dateTime={new Date(entitlement.expiresAt).toISOString()}
								suppressHydrationWarning
							>
								{formatDate(entitlement.expiresAt)}
							</time>
						) : (
							m.store_account_entitlement_available()
						)}
					</p>
				</div>
			</div>
			<AccountEntitlementActions entitlement={entitlement} />
		</article>
	);
}

function AccountEntitlementActions({
	entitlement,
}: {
	entitlement: Account["entitlements"][number];
}) {
	const router = useRouter();
	const supportsAccountActions = ["stock", "download", "automation"].includes(
		entitlement.type,
	);
	const order = useQuery({
		queryKey: ["storefront", "account", "order", entitlement.orderNumber],
		queryFn: () =>
			getAccountOrderFn({
				data: { orderNumber: entitlement.orderNumber },
			}),
		enabled: supportsAccountActions,
	});
	if (!supportsAccountActions) return null;
	if (order.isPending) {
		return (
			<p className="min-h-9 text-muted-foreground text-sm">
				{m.common_loading()}
			</p>
		);
	}
	if (!order.data) {
		return (
			<div className="flex min-h-9 items-center justify-between gap-3">
				<p className="text-muted-foreground text-sm">
					{m.store_account_entitlement_actions_failed()}
				</p>
				<Button
					size="sm"
					variant="outline"
					onClick={() => void order.refetch()}
				>
					{m.common_retry()}
				</Button>
			</div>
		);
	}
	const data = order.data;
	const downloads =
		entitlement.type === "download"
			? data.downloads.filter(
					(asset) =>
						asset.entitlementId === entitlement.id &&
						(asset.accessLimit === null ||
							asset.accessCount < asset.accessLimit),
				)
			: [];
	const stockDelivery =
		entitlement.type === "stock"
			? data.deliveries.find(
					(delivery) =>
						delivery.entitlementId === entitlement.id &&
						delivery.status === "delivered" &&
						delivery.hasContent,
				)
			: undefined;
	const automation =
		entitlement.type === "automation"
			? data.automationRuns.find((run) => run.id === entitlement.id)
			: undefined;
	async function downloadAsset(asset: (typeof data.downloads)[number]) {
		const response = await fetch(
			`/api/shop/orders/${encodeURIComponent(entitlement.orderNumber)}/downloads/${encodeURIComponent(asset.id)}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
				credentials: "same-origin",
			},
		);
		if (!response.ok) {
			toast.error(m.store_download_failed());
			return;
		}
		const url = URL.createObjectURL(await response.blob());
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = asset.fileName;
		anchor.click();
		URL.revokeObjectURL(url);
		void refreshEntitlement();
	}
	async function refreshEntitlement() {
		await Promise.all([
			order.refetch(),
			router.invalidate({
				filter: (match) => match.routeId === "/(public)/account",
			}),
		]);
	}
	if (!stockDelivery && !downloads.length && !automation) return null;
	return (
		<div className="mt-6 flex min-h-9 flex-wrap items-end gap-2">
			{stockDelivery ? (
				<Dialog>
					<DialogTrigger asChild>
						<Button size="sm">
							<Eye />
							{m.store_reveal_delivery()}
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-lg">
						<DialogHeader>
							<DialogTitle>{m.store_reveal_delivery()}</DialogTitle>
							<DialogDescription>
								{entitlement.productName} · {entitlement.sellableItemName}
							</DialogDescription>
						</DialogHeader>
						<AccountStockContent
							deliveryId={stockDelivery.id}
							orderNumber={entitlement.orderNumber}
						/>
					</DialogContent>
				</Dialog>
			) : null}
			{downloads.length ? (
				<Dialog>
					<DialogTrigger asChild>
						<Button size="sm">
							<Download />
							{m.store_downloads()}
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-lg">
						<DialogHeader>
							<DialogTitle>{m.store_downloads()}</DialogTitle>
							<DialogDescription>
								{entitlement.productName} · {entitlement.sellableItemName}
							</DialogDescription>
						</DialogHeader>
						<div className="divide-y">
							{downloads.map((asset) => (
								<div
									className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
									key={asset.id}
								>
									<div className="min-w-0">
										<strong className="block truncate text-sm">
											{asset.fileName}
										</strong>
										<span className="text-muted-foreground text-xs">
											v{asset.version} · {formatBytes(asset.sizeBytes)}
										</span>
									</div>
									<Button onClick={() => void downloadAsset(asset)} size="sm">
										<Download />
										{m.store_download()}
									</Button>
								</div>
							))}
						</div>
					</DialogContent>
				</Dialog>
			) : null}
			{automation ? (
				<AutomationEntitlementCard
					automation={automation}
					notificationChannels={data.automationNotificationChannels}
					onChanged={() => void refreshEntitlement()}
					orderNumber={entitlement.orderNumber}
				/>
			) : null}
		</div>
	);
}

function AccountStockContent({
	deliveryId,
	orderNumber,
}: {
	deliveryId: string;
	orderNumber: string;
}) {
	const [content, setContent] = useState("");
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		void fetch(
			`/api/shop/orders/${encodeURIComponent(orderNumber)}/deliveries/${encodeURIComponent(deliveryId)}/reveal`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
				credentials: "same-origin",
			},
		)
			.then(async (response) => {
				if (!response.ok) throw new Error("delivery_reveal_failed");
				const body = (await response.json()) as { content?: unknown };
				if (typeof body.content !== "string")
					throw new Error("delivery_reveal_failed");
				setContent(body.content);
			})
			.catch(() => setFailed(true));
	}, [deliveryId, orderNumber]);
	function recordCopy() {
		void fetch(
			`/api/shop/orders/${encodeURIComponent(orderNumber)}/deliveries/${encodeURIComponent(deliveryId)}/reveal`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "copied" }),
				credentials: "same-origin",
			},
		);
	}
	if (failed)
		return (
			<p className="text-destructive text-sm">
				{m.store_delivery_reveal_failed()}
			</p>
		);
	if (!content) return <Skeleton className="h-12 w-full rounded-xl" />;
	return (
		<div className="flex min-w-0 items-center gap-2 rounded-xl border bg-muted/30 p-2 pl-3">
			<code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm whitespace-pre">
				{content}
			</code>
			<CopyButton
				aria-label={m.store_copy_delivery()}
				copy={content}
				icon={<Copy />}
				onClick={recordCopy}
				size="icon-sm"
				tooltip={m.store_copy_delivery()}
				variant="ghost"
			/>
		</div>
	);
}

export function AccountSettingsPage({ account }: { account: Account }) {
	const session = authClient.useSession();
	const update = useMutation({
		mutationFn: updateStoreProfileFn,
		onSuccess: async () => {
			await session.refetch();
			toast.success(m.store_account_profile_saved());
		},
		onError: () => toast.error(m.store_account_operation_failed()),
	});
	return (
		<>
			<PageTitle
				title={m.store_account_settings()}
				description={m.store_account_settings_description()}
			/>
			<div className="grid gap-5 lg:grid-cols-2">
				<section className="grid content-start gap-5 rounded-3xl border bg-card p-5 sm:p-6">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h2 className="font-semibold text-xl">
								{m.store_account_profile()}
							</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								{m.store_account_profile_description()}
							</p>
						</div>
						<Button form="account-profile-form" size="sm" type="submit">
							{m.store_account_save()}
						</Button>
					</div>
					<ProSchemaForm
						className="grid gap-3"
						id="account-profile-form"
						initialValues={{
							name: account.user.name,
							preferredLocale: account.user.preferredLocale,
						}}
						onFinish={async (values) => {
							await update.mutateAsync({
								data: {
									name: String(values.name ?? ""),
									preferredLocale:
										values.preferredLocale === "zh-CN" ? "zh-CN" : "en-US",
								},
							});
						}}
						schema={[
							{
								name: "name",
								label: m.common_name(),
								required: true,
								fieldProps: { maxLength: 120 },
							},
							{
								name: "preferredLocale",
								label: m.store_account_preferred_language(),
								valueType: "select",
								required: true,
								tooltip: m.store_account_preferred_language_description(),
								fieldProps: {
									options: supportedLocales.map((locale) => ({
										label: localeLabels[locale],
										value: locale,
									})),
								},
							},
						]}
						submitter={false}
					/>
				</section>
				<AccountEmailSettings account={account} />
				<section className="grid content-start gap-5 rounded-3xl border bg-card p-5 sm:p-6">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h2 className="font-semibold text-xl">
								{m.store_account_security()}
							</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								{m.store_account_security_description()}
							</p>
						</div>
						<Button form="account-password-form" size="sm" type="submit">
							{m.store_account_save()}
						</Button>
					</div>
					{account.hasPassword ? (
						<ChangePasswordForm formId="account-password-form" />
					) : (
						<>
							<p className="text-muted-foreground text-sm">
								{m.store_account_set_password_description()}
							</p>
							<SetPasswordForm formId="account-password-form" />
						</>
					)}
				</section>
				<section className="grid content-start gap-5 rounded-3xl border bg-card p-5 sm:p-6">
					<div>
						<h2 className="font-semibold text-xl">
							{m.store_account_login_methods()}
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							{m.store_account_connections_description()}
						</p>
					</div>
					<AccountLoginMethods />
				</section>
			</div>
		</>
	);
}

function AccountEmailSettings({ account }: { account: Account }) {
	const providers = useQuery({
		queryKey: ["public", "auth-providers"],
		queryFn: () => listPublicAuthProvidersFn(),
		staleTime: 30_000,
	});
	const emailDeliveryEnabled =
		providers.data?.some((provider) => provider.emailDeliveryEnabled) === true;
	const changeEmail = useMutation({
		mutationFn: async (newEmail: string) => {
			const result = await authClient.changeEmail({
				newEmail,
				callbackURL: "/account/settings",
			});
			if (result.error) throw result.error;
			return result.data;
		},
		onSuccess: () =>
			toast.success(
				account.user.emailVerified
					? m.store_account_email_change_sent()
					: m.store_account_email_bind_sent(),
			),
		onError: () => toast.error(m.store_account_email_change_failed()),
	});
	const formId = "account-email-form";
	return (
		<section className="grid content-start gap-5 rounded-3xl border bg-card p-5 sm:p-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="font-semibold text-xl">{m.store_account_email()}</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						{m.store_account_email_description()}
					</p>
				</div>
				<Button
					disabled={
						providers.isPending ||
						!emailDeliveryEnabled ||
						changeEmail.isPending
					}
					form={formId}
					size="sm"
					type="submit"
				>
					{account.user.email
						? m.store_account_email_change()
						: m.store_account_email_bind()}
				</Button>
			</div>
			{account.user.email ? (
				<div className="rounded-xl border bg-muted/20 p-3">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm">
							{m.store_account_email_bound()}
						</span>
						<Badge variant="secondary">
							{account.user.emailVerified
								? m.store_account_email_verified()
								: m.store_account_email_pending()}
						</Badge>
					</div>
					<p className="mt-1 text-muted-foreground text-sm">
						{account.user.email}
					</p>
				</div>
			) : (
				<p className="text-muted-foreground text-sm">
					{m.store_account_email_unbound()}
				</p>
			)}
			{!providers.isPending && !emailDeliveryEnabled ? (
				<p className="text-muted-foreground text-sm">
					{m.store_account_email_delivery_unavailable()}
				</p>
			) : (
				<ProSchemaForm
					className="grid gap-3"
					id={formId}
					initialValues={{ email: "" }}
					onFinish={async (values) => {
						await changeEmail.mutateAsync(
							String(values.email ?? "")
								.trim()
								.toLowerCase(),
						);
					}}
					schema={[
						{
							name: "email",
							label: m.store_account_email_new(),
							required: true,
							fieldProps: {
								autoComplete: "email",
								maxLength: 320,
								type: "email",
							},
						},
					]}
					submitter={false}
				/>
			)}
		</section>
	);
}

function SetPasswordForm({ formId }: { formId: string }) {
	const setup = useMutation({
		mutationFn: setAccountPasswordFn,
		onSuccess: () => {
			toast.success(m.store_account_set_password_success());
			window.location.reload();
		},
		onError: () => toast.error(m.store_account_set_password_failed()),
	});
	return (
		<ProSchemaForm
			className="grid gap-3"
			id={formId}
			schema={[
				{
					name: "newPassword",
					label: m.account_change_password_new_password_label(),
					valueType: "password",
					required: true,
					fieldProps: { minLength: 12, maxLength: 200 },
				},
				{
					name: "confirmPassword",
					label: m.account_change_password_confirm_password_label(),
					valueType: "password",
					required: true,
					fieldProps: { minLength: 12, maxLength: 200 },
				},
			]}
			onFinish={async (values) => {
				const newPassword = String(values.newPassword ?? "");
				if (newPassword !== String(values.confirmPassword ?? ""))
					throw new Error("passwords_do_not_match");
				await setup.mutateAsync({ data: { newPassword } });
			}}
			submitter={false}
		/>
	);
}

export function AccountSessionsPage() {
	return (
		<>
			<PageTitle
				title={m.store_account_sessions()}
				description={m.store_account_sessions_description()}
			/>
			<AccountSessions />
		</>
	);
}

export function AccountNotificationsPage({ account }: { account: Account }) {
	return (
		<>
			<PageTitle
				title={m.store_account_notifications()}
				description={m.store_account_notifications_description()}
			/>
			<AccountNotificationPreferences account={account} />
		</>
	);
}

function PageTitle({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="max-w-3xl pb-1">
			<h1 className="text-balance font-semibold text-3xl tracking-[-0.035em] sm:text-4xl">
				{title}
			</h1>
			<p className="mt-2 text-pretty text-muted-foreground leading-6">
				{description}
			</p>
		</div>
	);
}
function Summary({
	icon,
	label,
	value,
}: {
	icon: React.ReactNode;
	label: string;
	value: number;
}) {
	return (
		<div className="flex items-center gap-4 rounded-2xl bg-muted/30 p-4 sm:p-5">
			<span className="grid size-10 place-items-center rounded-full bg-background text-primary">
				{icon}
			</span>
			<div>
				<p className="text-muted-foreground text-sm">{label}</p>
				<strong className="text-2xl">{value}</strong>
			</div>
		</div>
	);
}
function Empty({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="grid min-h-64 justify-items-center content-center gap-3 rounded-3xl bg-muted/25 px-6 py-12 text-center">
			<span className="grid size-12 place-items-center rounded-full bg-background text-primary">
				<PackageOpen className="size-6" />
			</span>
			<div>
				<p className="font-medium">{title}</p>
				<p className="mt-1 max-w-md text-muted-foreground text-sm leading-6">
					{description}
				</p>
			</div>
			{action ? <div className="mt-1">{action}</div> : null}
		</div>
	);
}

function OrderLink({ order }: { order: Account["orders"][number] }) {
	return (
		<Link
			className="group flex min-h-40 flex-col rounded-3xl border bg-card p-5 transition-colors hover:border-primary/35 sm:p-6"
			params={{ orderNumber: order.orderNumber }}
			search={{}}
			to="/account/orders/$orderNumber"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex min-w-0 items-start gap-3">
					<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
						<ReceiptText className="size-5" />
					</span>
					<div className="min-w-0">
						<strong className="block truncate font-medium">
							{order.productName ?? m.store_account_order()}
						</strong>
						<p className="mt-1 text-muted-foreground text-xs">
							{m.shop_orders_items()} {order.itemCount}
						</p>
					</div>
				</div>
				<Badge
					className={orderStatusBadgeClass(order.status)}
					variant="outline"
				>
					{shopOrderStatusLabel(order.status)}
				</Badge>
			</div>
			<div className="mt-5 flex flex-1 items-end justify-between gap-6">
				<div className="min-w-0">
					<p className="truncate font-mono text-muted-foreground text-xs">
						{order.orderNumber}
					</p>
					<p className="mt-1 text-muted-foreground text-xs">
						{formatDateTime(order.createdAt)}
					</p>
				</div>
				<p className="shrink-0 font-semibold text-primary text-xl">
					{formatMinorAmountWithSymbol(
						order.totalMinor,
						order.currency,
						order.currencyDecimals,
					)}
				</p>
			</div>
		</Link>
	);
}

function orderStatusBadgeClass(status: string) {
	if (["paid", "completed"].includes(status)) {
		return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
	}
	if (["cancelled", "expired", "failed"].includes(status)) {
		return "border-destructive/20 bg-destructive/10 text-destructive-foreground";
	}
	if (["refunding", "refunded"].includes(status)) {
		return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400";
	}
	return "border-primary/20 bg-primary/10 text-primary";
}
