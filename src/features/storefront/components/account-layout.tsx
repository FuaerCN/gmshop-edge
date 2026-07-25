"use client";

import {
	Link,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import {
	BellRing,
	Boxes,
	Laptop,
	LayoutDashboard,
	PackageSearch,
	Settings,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

const navigation = [
	{
		to: "/account",
		label: () => m.shop_dashboard_title(),
		icon: LayoutDashboard,
	},
	{
		to: "/account/orders",
		label: () => m.store_account_orders(),
		icon: PackageSearch,
	},
	{
		to: "/account/entitlements",
		label: () => m.store_account_entitlements(),
		icon: Boxes,
	},
	{
		to: "/account/settings",
		label: () => m.store_account_settings(),
		icon: Settings,
	},
	{
		to: "/account/sessions",
		label: () => m.store_account_sessions(),
		icon: Laptop,
	},
	{
		to: "/account/notifications",
		label: () => m.store_account_notifications(),
		icon: BellRing,
	},
] as const;

function isActiveNavigationItem(pathname: string, to: string) {
	return to === "/account" ? pathname === to : pathname.startsWith(to);
}

export function AccountLayout() {
	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const activeItem =
		navigation.find((item) => isActiveNavigationItem(pathname, item.to)) ??
		navigation[0];
	return (
		<div className="container min-h-[calc(100dvh-4.5rem)] px-4 py-6 sm:py-8 lg:py-12">
			<div className="grid min-h-full gap-7 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
				<aside className="min-w-0">
					<div className="lg:hidden">
						<Select
							onValueChange={(to) => {
								const target = navigation.find((item) => item.to === to);
								if (target) void navigate({ to: target.to });
							}}
							value={activeItem.to}
						>
							<SelectTrigger
								aria-label={m.store_account_title()}
								className="h-11 w-full rounded-xl"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{navigation.map((item) => (
									<SelectItem key={item.to} value={item.to}>
										<span className="flex items-center gap-2">
											<item.icon className="size-4" />
											{item.label()}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<nav
						aria-label={m.store_account_title()}
						className="sticky top-28 hidden gap-1 lg:grid"
					>
						{navigation.map((item) => {
							const active = isActiveNavigationItem(pathname, item.to);
							return (
								<Button
									asChild
									className="shrink-0 justify-start whitespace-nowrap lg:w-full"
									key={item.to}
									variant="ghost"
								>
									<Link
										aria-current={active ? "page" : undefined}
										className={cn(
											active
												? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
												: "text-muted-foreground hover:bg-muted hover:text-foreground",
										)}
										to={item.to}
									>
										<item.icon />
										{item.label()}
									</Link>
								</Button>
							);
						})}
					</nav>
				</aside>
				<main className={cn("min-w-0", "flex flex-col gap-7")}>
					<Outlet />
				</main>
			</div>
		</div>
	);
}
