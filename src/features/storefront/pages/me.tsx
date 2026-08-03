"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	ArrowRight,
	ChevronRight,
	Globe2,
	type LayoutDashboard,
	LogIn,
	LogOut,
	Palette,
	ReceiptText,
	ShieldCheck,
	WalletCards,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { authClient } from "#/features/auth/auth-client";
import { isInternalIdentityEmail } from "#/features/auth/identity-email";
import { getStorefrontAdminEntryFn } from "#/features/auth/server/session";
import { useCurrency } from "#/features/exchange-rates/currency-context";
import { CurrencySwitch } from "#/features/exchange-rates/currency-switch";
import { accountNavigation } from "#/features/storefront/components/account-navigation";
import useDialogState from "#/hooks/use-dialog-state";
import { LocaleSwitch } from "#/layouts/components/locale-switch";
import { SignOutDialog } from "#/layouts/components/sign-out-dialog";
import { ThemeSwitch } from "#/layouts/components/theme-switch";
import {
	AccountSettingsPanel,
	type SettingsPanelPage,
} from "#/layouts/public/account-settings-panel";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

export function StorefrontMePage() {
	const session = authClient.useSession();
	const user = session.data?.user;
	const currencySelection = useCurrency();
	const adminEntry = useQuery({
		enabled: Boolean(user),
		queryFn: () => getStorefrontAdminEntryFn(),
		queryKey: ["auth", "storefront-admin-entry", user?.id],
		retry: false,
		staleTime: 60_000,
	});

	return (
		<>
			<div className="min-h-[70vh] px-4 py-4 lg:hidden">
				<MobileMePage
					currencySelection={currencySelection}
					pending={session.isPending}
					root={adminEntry.data?.root}
					user={user}
				/>
			</div>
			<div className="container hidden min-h-[70vh] px-4 py-8 sm:py-12 lg:block">
				<header className="max-w-2xl">
					<h1 className="text-balance font-semibold text-4xl tracking-[-0.04em] sm:text-5xl">
						{m.store_my_title()}
					</h1>
					<p className="mt-3 text-pretty text-muted-foreground leading-7">
						{m.store_my_description()}
					</p>
				</header>

				<div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.72fr)]">
					{session.isPending ? (
						<AccountSkeleton />
					) : user ? (
						<SignedInAccount user={user} />
					) : (
						<GuestAccount />
					)}
					<DisplayPreferences />
				</div>
			</div>
		</>
	);
}

type SessionUser = NonNullable<
	ReturnType<typeof authClient.useSession>["data"]
>["user"];

function MobileMePage({
	currencySelection,
	pending,
	root,
	user,
}: {
	currencySelection: ReturnType<typeof useCurrency>;
	pending: boolean;
	root?: boolean;
	user?: SessionUser | null;
}) {
	const [page, setPage] = useState<SettingsPanelPage>("main");
	const [signOutOpen, setSignOutOpen] = useDialogState();
	if (pending) return <AccountSkeleton plain />;
	if (!user && page !== "main")
		return (
			<section className="mx-auto max-w-sm">
				<AccountSettingsPanel
					currencySelection={currencySelection}
					onClose={() => {}}
					onPageChange={setPage}
					onSignOut={() => {}}
					page={page}
					showHeading={false}
				/>
			</section>
		);
	if (!user)
		return (
			<div className="mx-auto max-w-sm">
				<div className="flex items-center gap-3 p-4">
					<span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
						<LogIn className="size-5" />
					</span>
					<p className="min-w-0 flex-1 font-medium">
						{m.store_not_signed_in()}
					</p>
					<Button asChild size="sm">
						<Link search={{ redirect: "/me" }} to="/sign-in">
							{m.public_sign_in()}
						</Link>
					</Button>
				</div>
				<AccountSettingsPanel
					currencySelection={currencySelection}
					onClose={() => {}}
					onPageChange={setPage}
					onSignOut={() => {}}
					page={page}
					showHeading={false}
				/>
				<div className="mt-2 p-2">
					<Button
						asChild
						className="h-auto w-full justify-start py-3 text-start"
						variant="ghost"
					>
						<Link to="/orders">
							<span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
								<ReceiptText className="size-5" />
							</span>
							<span className="min-w-0">
								<span className="block font-medium">
									{m.store_lookup_title()}
								</span>
								<span className="mt-0.5 block text-muted-foreground text-xs">
									{m.store_my_guest_orders_description()}
								</span>
							</span>
							<ChevronRight className="ms-auto" />
						</Link>
					</Button>
				</div>
			</div>
		);
	const email = isInternalIdentityEmail(user.email) ? "" : user.email || "";
	if (page !== "main")
		return (
			<section className="mx-auto max-w-sm">
				<AccountSettingsPanel
					currencySelection={currencySelection}
					onClose={() => {}}
					onPageChange={setPage}
					onSignOut={() => setSignOutOpen(true)}
					page={page}
					root={root}
					user={{ email, image: user.image, name: user.name }}
				/>
			</section>
		);
	return (
		<>
			<div className="mx-auto max-w-sm">
				<section>
					<AccountSettingsPanel
						currencySelection={currencySelection}
						onClose={() => {}}
						onPageChange={setPage}
						onSignOut={() => setSignOutOpen(true)}
						page={page}
						root={root}
						showAccountLinks={false}
						showSignOut={false}
						user={{ email, image: user.image, name: user.name }}
					/>
				</section>
				<section className="mt-2">
					<nav
						aria-label={m.store_account_title()}
						className="grid grid-cols-4 gap-x-2 gap-y-1 p-2"
					>
						{root ? (
							<MobileGridLink
								icon={ShieldCheck}
								label={m.store_admin_dashboard()}
								to="/admin"
							/>
						) : null}
						{accountNavigation.map((item) => (
							<MobileGridLink
								icon={item.icon}
								key={item.to}
								label={item.label()}
								to={item.to}
							/>
						))}
					</nav>
				</section>
				<div className="mt-1 p-2">
					<Button
						className="w-full justify-center text-destructive-foreground hover:bg-destructive/10 hover:text-destructive-foreground"
						onClick={() => setSignOutOpen(true)}
						variant="ghost"
					>
						<LogOut />
						{m.layout_signOut_title()}
					</Button>
				</div>
			</div>
			<SignOutDialog
				open={Boolean(signOutOpen)}
				onOpenChange={setSignOutOpen}
			/>
		</>
	);
}

function MobileGridLink({
	icon: Icon,
	label,
	to,
}: {
	icon: typeof LayoutDashboard;
	label: string;
	to: (typeof accountNavigation)[number]["to"] | "/admin";
}) {
	return (
		<Link
			className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-center outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
			to={to}
		>
			<span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
				<Icon className="size-5" />
			</span>
			<span className="line-clamp-2 text-xs leading-4">{label}</span>
		</Link>
	);
}

function SignedInAccount({ user }: { user: SessionUser }) {
	const [signOutOpen, setSignOutOpen] = useDialogState();
	const email = isInternalIdentityEmail(user.email) ? "" : user.email || "";
	const name = user.name || email || m.store_account_title();
	return (
		<>
			<section className="overflow-hidden rounded-3xl border bg-card">
				<div className="flex items-center gap-4 border-b p-5 sm:p-6">
					<Avatar className="size-14">
						<AvatarImage alt={name} src={user.image || ""} />
						<AvatarFallback>{userFallback(name, email)}</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<h2 className="truncate font-semibold text-xl">{name}</h2>
						{email ? (
							<p className="mt-0.5 truncate text-muted-foreground text-sm">
								{email}
							</p>
						) : null}
					</div>
				</div>
				<nav aria-label={m.store_account_title()} className="grid p-2">
					{accountNavigation.map((item) => (
						<Button
							asChild
							className="h-12 justify-start rounded-xl px-3"
							key={item.to}
							variant="ghost"
						>
							<Link to={item.to}>
								<span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
									<item.icon className="size-4" />
								</span>
								<span className="min-w-0 flex-1 truncate text-start">
									{item.label()}
								</span>
								<ArrowRight className="size-4 text-muted-foreground" />
							</Link>
						</Button>
					))}
					<Button
						className="h-12 justify-start rounded-xl px-3 text-destructive-foreground hover:bg-destructive/10 hover:text-destructive-foreground"
						onClick={() => setSignOutOpen(true)}
						variant="ghost"
					>
						<span className="grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/10">
							<LogOut className="size-4" />
						</span>
						{m.layout_signOut_title()}
					</Button>
				</nav>
			</section>
			<SignOutDialog
				open={Boolean(signOutOpen)}
				onOpenChange={setSignOutOpen}
			/>
		</>
	);
}

function GuestAccount({ plain = false }: { plain?: boolean }) {
	return (
		<section
			className={cn("p-5 sm:p-6", !plain && "rounded-3xl border bg-card")}
		>
			<div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
				<LogIn className="size-6" />
			</div>
			<h2 className="mt-5 font-semibold text-2xl">
				{m.store_my_guest_title()}
			</h2>
			<p className="mt-2 text-muted-foreground text-sm leading-6">
				{m.store_my_guest_description()}
			</p>
			<Button asChild className="mt-6 w-full sm:w-auto">
				<Link search={{ redirect: "/me" }} to="/sign-in">
					<LogIn />
					{m.public_sign_in()}
				</Link>
			</Button>
			<div className="my-6 border-t" />
			<Button
				asChild
				className="h-auto w-full justify-start gap-3 rounded-2xl p-3 text-start"
				variant="ghost"
			>
				<Link to="/orders">
					<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
						<ReceiptText className="size-5" />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block font-medium">{m.store_nav_orders()}</span>
						<span className="mt-0.5 block text-muted-foreground text-xs">
							{m.store_my_guest_orders_description()}
						</span>
					</span>
					<ArrowRight className="size-4 shrink-0 text-muted-foreground" />
				</Link>
			</Button>
		</section>
	);
}

function DisplayPreferences() {
	const preferences = [
		{
			label: m.store_payment_currency(),
			description: m.store_my_currency_description(),
			icon: WalletCards,
			control: <CurrencySwitch />,
		},
		{
			label: m.switch_language(),
			description: m.store_my_language_description(),
			icon: Globe2,
			control: <LocaleSwitch />,
		},
		{
			label: m.toggle_theme(),
			description: m.store_my_theme_description(),
			icon: Palette,
			control: <ThemeSwitch />,
		},
	];
	return (
		<section className="rounded-3xl border bg-card p-5 sm:p-6">
			<h2 className="font-semibold text-xl">
				{m.store_my_preferences_title()}
			</h2>
			<p className="mt-1 text-muted-foreground text-sm leading-6">
				{m.store_my_preferences_description()}
			</p>
			<div className="mt-5 divide-y">
				{preferences.map((item) => (
					<div
						className="flex min-h-16 items-center gap-3 py-3"
						key={item.label}
					>
						<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
							<item.icon className="size-5" />
						</span>
						<div className="min-w-0 flex-1">
							<p className="font-medium text-sm">{item.label}</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								{item.description}
							</p>
						</div>
						{item.control}
					</div>
				))}
			</div>
		</section>
	);
}

function AccountSkeleton({ plain = false }: { plain?: boolean }) {
	return (
		<section
			aria-label={m.store_my_account_loading()}
			className={cn("p-5 sm:p-6", !plain && "rounded-3xl border bg-card")}
		>
			<div className="flex items-center gap-4">
				<Skeleton className="size-14 rounded-full" />
				<div className="grid flex-1 gap-2">
					<Skeleton className="h-5 w-40 max-w-full" />
					<Skeleton className="h-4 w-56 max-w-full" />
				</div>
			</div>
			<div className="mt-6 grid gap-2">
				{["overview", "orders", "entitlements", "settings"].map((item) => (
					<Skeleton className="h-12 rounded-xl" key={item} />
				))}
			</div>
		</section>
	);
}

function userFallback(name: string, email: string) {
	return (name || email || "U")
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}
