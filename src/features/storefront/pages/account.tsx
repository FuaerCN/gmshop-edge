"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	KeyRound,
	Laptop,
	ReceiptText,
	Trash2,
	WandSparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";
import { authClient } from "#/features/auth/auth-client";
import { listPublicAuthProvidersFn } from "#/features/auth/server/provider-admin";
import type { getStoreAccountFn } from "#/features/storefront/server/account-functions";
import {
	listStoreSessionsFn,
	revokeStoreSessionFn,
	updateStoreNotificationPreferenceFn,
} from "#/features/storefront/server/account-functions";
import { formatDateTime } from "#/lib/format";
import { m } from "#/paraglide/messages";

type Account = Awaited<ReturnType<typeof getStoreAccountFn>>;

export function AccountLoginMethods() {
	const client = useQueryClient();
	const providers = useQuery({
		queryKey: ["public", "auth-providers"],
		queryFn: () => listPublicAuthProvidersFn(),
		staleTime: 30_000,
	});
	const accounts = useQuery({
		queryKey: ["storefront", "account", "login-methods"],
		queryFn: async () => {
			const result = await authClient.listAccounts();
			if (result.error) throw result.error;
			return result.data ?? [];
		},
	});
	const unlink = useMutation({
		mutationFn: async (input: { providerId: string; accountId: string }) => {
			const result = await authClient.unlinkAccount(input);
			if (result.error) throw result.error;
			return result.data;
		},
		onSuccess: async () => {
			await client.invalidateQueries({
				queryKey: ["storefront", "account", "login-methods"],
			});
			toast.success(m.store_account_login_method_unlinked());
		},
		onError: () => toast.error(m.store_account_login_method_failed()),
	});
	const availableProviders =
		providers.data?.filter(
			(provider) =>
				provider.providerType !== "email_password" &&
				!accounts.data?.some(
					(account) => account.providerId === provider.providerId,
				),
		) ?? [];
	return (
		<section>
			<div className="grid gap-px">
				{accounts.data?.map((account) => (
					<div
						className="flex items-center justify-between gap-3 border-b py-4 last:border-b-0"
						key={account.id}
					>
						<div>
							<p className="font-medium text-sm">
								{account.providerId === "credential"
									? m.store_account_email_password()
									: (providers.data?.find(
											(provider) => provider.providerId === account.providerId,
										)?.displayName ?? account.providerId)}
							</p>
							<p className="text-muted-foreground text-xs">
								{m.store_account_login_method_linked()}
							</p>
						</div>
						<Button
							aria-label={m.store_account_login_method_unlink()}
							disabled={unlink.isPending || accounts.data.length <= 1}
							onClick={() =>
								unlink.mutate({
									providerId: account.providerId,
									accountId: account.accountId,
								})
							}
							size="icon-sm"
							variant="ghost"
							className="text-destructive-foreground hover:bg-destructive/10 hover:text-destructive-foreground"
						>
							<Trash2 className="text-destructive-foreground" />
						</Button>
					</div>
				))}
				{availableProviders.map((provider) => (
					<div
						className="flex items-center justify-between gap-3 border-b py-4 last:border-b-0"
						key={provider.providerId}
					>
						<span className="font-medium text-sm">{provider.displayName}</span>
						<Button
							onClick={() => void linkProvider(provider)}
							variant="outline"
						>
							<KeyRound />
							{m.store_account_login_method_link({
								provider: provider.displayName,
							})}
						</Button>
					</div>
				))}
			</div>
		</section>
	);

	async function linkProvider(provider: {
		providerId: string;
		providerType: string;
	}) {
		try {
			if (provider.providerType === "social") {
				await authClient.linkSocial({
					provider: provider.providerId as
						| "apple"
						| "discord"
						| "github"
						| "google"
						| "line"
						| "microsoft"
						| "telegram",
					callbackURL: "/account/settings",
				});
				return;
			}
			throw new Error("unsupported_auth_provider");
		} catch {
			toast.error(m.store_account_login_method_failed());
		}
	}
}

export function AccountNotificationPreferences({
	account,
}: {
	account: Account;
}) {
	const [preferences, setPreferences] = useState(
		new Map(
			account.notificationPreferences.map((item) => [item.event, item.enabled]),
		),
	);
	const update = useMutation({
		mutationFn: updateStoreNotificationPreferenceFn,
		onSuccess: ({ event, enabled }) => {
			setPreferences((current) => new Map(current).set(event, enabled));
			toast.success(m.store_account_notifications_saved());
		},
		onError: () => toast.error(m.store_account_operation_failed()),
	});
	if (!account.user.email)
		return (
			<section className="rounded-2xl bg-muted/30 p-5 text-muted-foreground text-sm sm:p-6">
				{m.store_account_notifications_email_unavailable()}
			</section>
		);
	const labels = {
		order_paid: m.store_account_notification_order_paid(),
		delivery_ready: m.store_account_notification_delivery_ready(),
		automation_ready: m.store_account_notification_automation_ready(),
		automation_failed: m.store_account_notification_automation_failed(),
		refund_succeeded: m.store_account_notification_refund_succeeded(),
		refund_failed: m.store_account_notification_refund_failed(),
		after_sale_updated: m.store_account_notification_after_sale_updated(),
		entitlement_expiring: m.store_account_notification_entitlement_expiring(),
	} as const;
	const groups = [
		{
			title: m.store_account_notifications_orders(),
			description: m.store_account_notifications_orders_description(),
			icon: ReceiptText,
			events: [
				"order_paid",
				"delivery_ready",
				"refund_succeeded",
				"refund_failed",
				"after_sale_updated",
			],
		},
		{
			title: m.store_account_notifications_entitlements(),
			description: m.store_account_notifications_entitlements_description(),
			icon: WandSparkles,
			events: ["automation_ready", "automation_failed", "entitlement_expiring"],
		},
	] as const;
	return (
		<div className="grid gap-8 lg:grid-cols-2">
			{!account.user.emailVerified ? (
				<p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm xl:col-span-2">
					{m.store_account_notifications_verify_email()}
				</p>
			) : null}
			{groups.map((group) => (
				<section
					className="min-w-0 rounded-3xl border bg-card p-5 sm:p-6"
					key={group.title}
				>
					<header className="flex items-start gap-3 pb-3">
						<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
							<group.icon className="size-5" />
						</span>
						<div>
							<h2 className="font-semibold">{group.title}</h2>
							<p className="mt-0.5 text-muted-foreground text-sm">
								{group.description}
							</p>
						</div>
					</header>
					<div className="divide-y">
						{group.events.map((event) => (
							<div
								className="flex items-center justify-between gap-4 px-1 py-4 sm:px-2"
								key={event}
							>
								<Label
									className="cursor-pointer"
									htmlFor={`notification-${event}`}
								>
									{labels[event]}
								</Label>
								<Switch
									checked={preferences.get(event) ?? true}
									disabled={!account.user.emailVerified || update.isPending}
									id={`notification-${event}`}
									onCheckedChange={(enabled) =>
										update.mutate({
											data: { event, enabled },
										})
									}
								/>
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	);
}

export function AccountSessions() {
	const client = useQueryClient();
	const sessions = useQuery({
		queryKey: ["storefront", "account", "sessions"],
		queryFn: () => listStoreSessionsFn(),
		staleTime: 15_000,
	});
	const revoke = useMutation({
		mutationFn: revokeStoreSessionFn,
		onSuccess: async () => {
			await client.invalidateQueries({
				queryKey: ["storefront", "account", "sessions"],
			});
			toast.success(m.store_account_session_revoked());
		},
		onError: () => toast.error(m.store_account_operation_failed()),
	});
	return (
		<section className="grid gap-4 lg:grid-cols-2">
			{sessions.data?.map((item) => (
				<article
					className="relative flex min-h-52 min-w-0 flex-col rounded-3xl border bg-card p-5 sm:p-6"
					key={item.id}
				>
					<div className="flex min-w-0 items-start gap-3 pe-10">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<Laptop className="size-5" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<p
									className="truncate font-medium"
									title={item.userAgent ?? undefined}
								>
									{sessionDeviceLabel(item.userAgent)}
								</p>
								{item.current ? (
									<Badge variant="outline">
										{m.store_account_current_session()}
									</Badge>
								) : null}
							</div>
						</div>
					</div>
					{!item.current ? (
						<Button
							aria-label={m.store_account_revoke_session()}
							className="absolute end-4 top-4 text-destructive-foreground hover:bg-destructive/10 hover:text-destructive-foreground focus-visible:ring-destructive/20 sm:end-5 sm:top-5"
							disabled={revoke.isPending}
							onClick={() => revoke.mutate({ data: { sessionId: item.id } })}
							size="icon-sm"
							variant="ghost"
						>
							<Trash2 className="text-destructive-foreground" />
						</Button>
					) : null}
					<dl className="mt-6 grid flex-1 content-end gap-4 text-sm">
						<SessionDatum
							label={m.store_account_session_ip()}
							value={item.ipAddress || "—"}
						/>
						<div className="grid grid-cols-2 gap-4">
							<SessionDatum
								label={m.store_account_session_started()}
								value={formatDateTime(item.createdAt)}
							/>
							<SessionDatum
								label={m.store_account_session_last_active()}
								value={formatDateTime(item.updatedAt)}
							/>
						</div>
					</dl>
				</article>
			))}
		</section>
	);
}

function SessionDatum({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="mt-1 truncate font-medium text-foreground" title={value}>
				{value}
			</dd>
		</div>
	);
}

function sessionDeviceLabel(userAgent: string | null) {
	if (!userAgent) return m.store_account_unknown_device();
	const browser = /Edg\//.test(userAgent)
		? "Edge"
		: /Firefox\//.test(userAgent)
			? "Firefox"
			: /Chrome\//.test(userAgent)
				? "Chrome"
				: /Safari\//.test(userAgent)
					? "Safari"
					: null;
	const platform = /iPhone/.test(userAgent)
		? "iPhone"
		: /iPad/.test(userAgent)
			? "iPad"
			: /Android/.test(userAgent)
				? "Android"
				: /Macintosh/.test(userAgent)
					? "macOS"
					: /Windows/.test(userAgent)
						? "Windows"
						: /Linux/.test(userAgent)
							? "Linux"
							: null;
	return (
		[browser, platform].filter(Boolean).join(" · ") ||
		m.store_account_unknown_device()
	);
}
