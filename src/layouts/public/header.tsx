"use client";

import { Link } from "@tanstack/react-router";
import { LogOut, Menu, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetTitle,
	SheetTrigger,
} from "#/components/ui/sheet";
import { authClient } from "#/features/auth/auth-client";
import { isInternalIdentityEmail } from "#/features/auth/identity-email";
import { CurrencySwitch } from "#/features/exchange-rates/currency-switch";
import { useLocalCart } from "#/features/storefront/cart-storage";
import { accountNavigation } from "#/features/storefront/components/account-navigation";
import useDialogState from "#/hooks/use-dialog-state";
import { AppTitle } from "#/layouts/components/app-title";
import { LocaleSwitch } from "#/layouts/components/locale-switch";
import { SignOutDialog } from "#/layouts/components/sign-out-dialog";
import { ThemeSwitch } from "#/layouts/components/theme-switch";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

export function PublicHeader() {
	const session = authClient.useSession();
	const user = session.data?.user;
	const signedIn = Boolean(user);
	const navigation = publicNavigation({ signedIn });
	const [stuck, setStuck] = useState(false);
	useEffect(() => {
		const update = () => setStuck(window.scrollY > 0);
		update();
		window.addEventListener("scroll", update, { passive: true });
		return () => window.removeEventListener("scroll", update);
	}, []);
	return (
		<header
			className={cn(
				"sticky inset-x-0 top-0 z-50 border-transparent border-b bg-background/90 transition-[border-color,backdrop-filter]",
				stuck && "border-border/70 backdrop-blur-xl",
			)}
		>
			<div className="container flex h-18 items-center px-4">
				<Link className="min-w-0 shrink lg:shrink-0" to="/">
					<AppTitle />
				</Link>
				<div className="ms-auto hidden items-center lg:flex">
					<nav className="me-6 flex items-center gap-6 text-muted-foreground text-sm">
						{navigation.map(([label, href]) => (
							<a
								className="py-2 transition-colors hover:text-foreground"
								href={href}
								key={href}
							>
								{label}
							</a>
						))}
					</nav>
					<div className="flex items-center gap-1 ps-1">
						<CurrencySwitch />
						<LocaleSwitch />
						<ThemeSwitch />
						<CartAction />
						<DesktopAccountActions user={user} />
					</div>
				</div>
				<div className="ms-auto flex shrink-0 items-center gap-1 lg:hidden">
					<CurrencySwitch />
					<LocaleSwitch />
					<ThemeSwitch />
					<MobileNavigation user={user} />
				</div>
			</div>
		</header>
	);
}

type HeaderUser = {
	name?: string | null;
	email?: string | null;
	image?: string | null;
};

const mobileNavigationLinkClass =
	"rounded-xl px-4 py-3 font-medium transition-colors hover:bg-accent";

function MobileNavigation({ user }: { user?: HeaderUser | null }) {
	const signedIn = Boolean(user);
	const navigation = publicNavigation({
		includeCart: true,
		includeOrders: !signedIn,
		signedIn,
	});
	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button size="icon" variant="ghost">
					<Menu />
					<span className="sr-only">{m.public_open_navigation()}</span>
				</Button>
			</SheetTrigger>
			<SheetContent className="w-[min(22rem,88vw)] overflow-hidden">
				<SheetTitle className="sr-only">
					{m.public_navigation_title()}
				</SheetTitle>
				<SheetDescription className="sr-only">
					{m.public_navigation_description()}
				</SheetDescription>
				<nav className="grid min-h-0 min-w-0 gap-1 overflow-x-hidden overflow-y-auto px-4 pt-12">
					{navigation.map(([label, href]) => (
						<SheetClose asChild key={href}>
							<a className={mobileNavigationLinkClass} href={href}>
								{label}
							</a>
						</SheetClose>
					))}
					{user
						? accountNavigation.map((item) => (
								<SheetClose asChild key={item.to}>
									<Link className={mobileNavigationLinkClass} to={item.to}>
										{item.label()}
									</Link>
								</SheetClose>
							))
						: null}
				</nav>
				<SheetFooter className="shrink-0">
					<MobileUserFooter user={user} />
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

function MobileUserFooter({ user }: { user?: HeaderUser | null }) {
	const [signOutOpen, setSignOutOpen] = useDialogState();
	if (!user)
		return (
			<SheetClose asChild>
				<Link
					className="rounded-xl bg-primary px-4 py-3 text-center font-medium text-primary-foreground"
					search={{ redirect: undefined }}
					to="/sign-in"
				>
					{m.public_sign_in()}
				</Link>
			</SheetClose>
		);
	const email = isInternalIdentityEmail(user.email) ? "" : user.email || "";
	const name = user.name || email || m.store_account_title();
	const fallback = getUserFallback(name, email);
	return (
		<>
			<div className="flex min-w-0 items-center gap-3 px-1 py-2">
				<Avatar className="size-9">
					<AvatarImage alt={name} src={user.image || ""} />
					<AvatarFallback>{fallback}</AvatarFallback>
				</Avatar>
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{name}</p>
					{email ? (
						<p className="truncate text-xs text-muted-foreground">{email}</p>
					) : null}
				</div>
			</div>
			<Button
				className="justify-start rounded-xl"
				onClick={() => setSignOutOpen(true)}
				variant="destructive"
			>
				<LogOut />
				{m.layout_signOut_title()}
			</Button>
			<SignOutDialog
				open={Boolean(signOutOpen)}
				onOpenChange={setSignOutOpen}
			/>
		</>
	);
}

function DesktopAccountActions({ user }: { user?: HeaderUser | null }) {
	const [signOutOpen, setSignOutOpen] = useDialogState();
	if (!user)
		return (
			<Button asChild>
				<Link search={{ redirect: undefined }} to="/sign-in">
					{m.public_sign_in()}
				</Link>
			</Button>
		);
	const email = isInternalIdentityEmail(user.email) ? "" : user.email || "";
	const name = user.name || email || m.store_account_title();
	const fallback = getUserFallback(name, email);
	return (
		<>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						aria-label={m.store_account_title()}
						className="rounded-full"
						size="icon"
						variant="ghost"
					>
						<Avatar className="size-7">
							<AvatarImage alt={name} src={user.image || ""} />
							<AvatarFallback>{fallback}</AvatarFallback>
						</Avatar>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuLabel className="font-normal">
						<div className="grid gap-1">
							<p className="truncate text-sm font-medium">{name}</p>
							{email ? (
								<p className="truncate text-xs text-muted-foreground">
									{email}
								</p>
							) : null}
						</div>
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{accountNavigation.map((item) => (
						<DropdownMenuItem asChild key={item.to}>
							<Link to={item.to}>
								<item.icon />
								{item.label()}
							</Link>
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onClick={() => setSignOutOpen(true)}
					>
						<LogOut />
						{m.layout_signOut_title()}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<SignOutDialog
				open={Boolean(signOutOpen)}
				onOpenChange={setSignOutOpen}
			/>
		</>
	);
}

function getUserFallback(name: string, email: string) {
	const source = name || email || "U";
	return source
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

function CartAction() {
	const cart = useLocalCart();
	const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
	return (
		<Button asChild className="rounded-full" size="icon" variant="ghost">
			<Link aria-label={m.store_cart_title()} to="/cart">
				<ShoppingCart />
				{count ? (
					<span className="absolute translate-x-3 -translate-y-3 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
						{count > 99 ? "99+" : count}
					</span>
				) : null}
			</Link>
		</Button>
	);
}

function publicNavigation({
	includeCart = false,
	includeOrders = true,
	signedIn,
}: {
	includeCart?: boolean;
	includeOrders?: boolean;
	signedIn: boolean;
}) {
	const navigation: Array<readonly [string, string]> = [
		[m.store_nav_shop(), "/"],
	];
	if (includeCart) navigation.push([m.store_cart_title(), "/cart"]);
	if (includeOrders)
		navigation.push(
			signedIn
				? [m.store_account_orders(), "/account/orders"]
				: [m.store_nav_orders(), "/orders"],
		);
	return navigation;
}
