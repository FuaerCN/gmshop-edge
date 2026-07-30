"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ShoppingCart, User } from "lucide-react";
import { useLocalCart } from "#/features/storefront/cart-storage";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

type MobileNavigationSection = "shop" | "cart" | "my";

export function mobileNavigationSection(
	pathname: string,
): MobileNavigationSection | null {
	const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
	if (path === "/") return "shop";
	if (path === "/cart") return "cart";
	if (path === "/me" || path === "/orders") return "my";
	if (path !== "/account" && !path.startsWith("/account/")) return null;
	return path.split("/").filter(Boolean).length <= 2 ? "my" : null;
}

export function MobileBottomNavigation() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const activeSection = mobileNavigationSection(pathname);
	const cart = useLocalCart();
	if (!activeSection) return null;
	const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
	const items = [
		{ id: "shop", label: m.store_nav_shop(), icon: Home, to: "/" },
		{
			id: "cart",
			label: m.store_cart_title(),
			icon: ShoppingCart,
			to: "/cart",
		},
		{ id: "my", label: m.store_my_title(), icon: User, to: "/me" },
	] as const;

	return (
		<>
			<div
				aria-hidden
				className="h-[calc(5.5rem+var(--safe-bottom))] lg:hidden"
			/>
			<nav
				aria-label={m.store_mobile_navigation()}
				className="fixed right-4 bottom-[calc(1rem+var(--safe-bottom))] left-4 z-50 mx-auto max-w-sm lg:hidden"
			>
				<div className="absolute inset-0 rounded-full bg-foreground/5 blur-xl" />
				<div className="relative flex h-14 overflow-hidden rounded-full border border-foreground/15 bg-background/75 p-1 shadow-lg backdrop-blur-3xl backdrop-saturate-200">
					{items.map((item) => {
						const active = activeSection === item.id;
						return (
							<Link
								aria-current={active ? "page" : undefined}
								aria-label={item.label}
								className={cn(
									"relative flex min-w-0 flex-1 items-center justify-center rounded-full border border-transparent px-3 text-muted-foreground transition-[background-color,border-color,color,box-shadow] duration-300",
									active &&
										"border-foreground/15 bg-foreground/10 text-foreground shadow-sm",
								)}
								key={item.id}
								to={item.to}
							>
								<span className="relative shrink-0">
									<item.icon className="size-5" />
									{item.id === "cart" && cartCount ? (
										<span className="absolute -top-2 -right-2 min-w-4 rounded-full bg-primary px-1 text-center font-semibold text-[9px] text-primary-foreground leading-4">
											{cartCount > 99 ? "99+" : cartCount}
										</span>
									) : null}
								</span>
								<span
									className={cn(
										"overflow-hidden whitespace-nowrap font-medium text-sm transition-[max-width,opacity,margin] duration-300",
										active
											? "ms-1.5 max-w-20 opacity-100"
											: "ms-0 max-w-0 opacity-0",
									)}
								>
									{item.label}
								</span>
							</Link>
						);
					})}
				</div>
			</nav>
		</>
	);
}
