"use client";

import {
	Link,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
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
import { accountNavigation } from "./account-navigation";

function isActiveNavigationItem(pathname: string, to: string) {
	return to === "/account" ? pathname === to : pathname.startsWith(to);
}

export function AccountLayout() {
	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const activeItem =
		accountNavigation.find((item) =>
			isActiveNavigationItem(pathname, item.to),
		) ?? accountNavigation[0];
	return (
		<div className="container min-h-[calc(100dvh-4.5rem)] px-4 py-6 sm:py-8 lg:py-12">
			<div className="grid min-h-full gap-7 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
				<aside className="min-w-0">
					<div className="lg:hidden">
						<Select
							onValueChange={(to) => {
								const target = accountNavigation.find((item) => item.to === to);
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
								{accountNavigation.map((item) => (
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
						{accountNavigation.map((item) => {
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
