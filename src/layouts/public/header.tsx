"use client";

import { Link } from "@tanstack/react-router";
import { CircleUserRound, Menu, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "#/components/ui/sheet";
import { authClient } from "#/features/auth/auth-client";
import { CurrencySwitch } from "#/features/exchange-rates/currency-switch";
import { useLocalCart } from "#/features/storefront/cart-storage";
import { AppTitle } from "#/layouts/components/app-title";
import { LocaleSwitch } from "#/layouts/components/locale-switch";
import { ThemeSwitch } from "#/layouts/components/theme-switch";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

export function PublicHeader() {
	const session = authClient.useSession();
	const signedIn = Boolean(session.data?.user);
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
				<Link className="shrink-0" to="/">
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
						<AccountActions signedIn={signedIn} />
					</div>
				</div>
				<MobileNavigation signedIn={signedIn} />
			</div>
		</header>
	);
}

function MobileNavigation({ signedIn }: { signedIn: boolean }) {
	const navigation = publicNavigation({ includeCart: true, signedIn });
	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button className="ms-auto lg:hidden" size="icon" variant="ghost">
					<Menu />
					<span className="sr-only">{m.public_open_navigation()}</span>
				</Button>
			</SheetTrigger>
			<SheetContent className="w-[min(22rem,88vw)]">
				<SheetHeader>
					<SheetTitle className="sr-only">
						{m.public_navigation_title()}
					</SheetTitle>
					<SheetDescription className="sr-only">
						{m.public_navigation_description()}
					</SheetDescription>
					<AppTitle description />
				</SheetHeader>
				<nav className="grid gap-1 px-4 pt-4">
					{navigation.map(([label, href]) => (
						<SheetClose asChild key={href}>
							<a
								className="rounded-xl px-4 py-3 font-medium transition-colors hover:bg-accent"
								href={href}
							>
								{label}
							</a>
						</SheetClose>
					))}
					<div className="mt-3 grid gap-2">
						<AccountActions mobile signedIn={signedIn} />
					</div>
				</nav>
				<SheetFooter className="flex-row items-center justify-between">
					<span className="text-muted-foreground text-xs">
						{m.public_display_preferences()}
					</span>
					<div className="flex items-center gap-1">
						<CurrencySwitch />
						<LocaleSwitch />
						<ThemeSwitch />
					</div>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

function AccountActions({
	mobile = false,
	signedIn,
}: {
	mobile?: boolean;
	signedIn: boolean;
}) {
	if (!signedIn)
		return (
			<Button asChild className={mobile ? "rounded-xl" : undefined}>
				<Link search={{ redirect: undefined }} to="/sign-in">
					{m.public_sign_in()}
				</Link>
			</Button>
		);
	return (
		<Button
			asChild
			className={mobile ? "rounded-xl" : "rounded-full"}
			size={mobile ? "default" : "icon"}
			variant={mobile ? "default" : "ghost"}
		>
			<Link aria-label={m.store_account_title()} to="/account">
				<CircleUserRound />
				{mobile ? m.store_account_title() : null}
			</Link>
		</Button>
	);
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
	signedIn,
}: {
	includeCart?: boolean;
	signedIn: boolean;
}) {
	return [
		[m.store_nav_shop(), "/"],
		...(includeCart ? ([[m.store_cart_title(), "/cart"]] as const) : []),
		...(signedIn
			? ([[m.store_account_orders(), "/account/orders"]] as const)
			: ([[m.store_nav_orders(), "/orders"]] as const)),
	] as ReadonlyArray<readonly [string, string]>;
}
