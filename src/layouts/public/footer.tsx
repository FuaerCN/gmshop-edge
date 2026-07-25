"use client";

import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { useSiteBrand } from "#/context/site-brand-provider";
import { AppTitle } from "#/layouts/components/app-title";
import { m } from "#/paraglide/messages";

export function PublicFooter() {
	const brand = useSiteBrand();
	return (
		<footer className="mt-12 w-full py-5">
			<div className="container flex flex-col gap-4 px-4 sm:flex-row sm:items-center">
				<Link className="inline-flex shrink-0" to="/">
					<AppTitle />
				</Link>
				<div className="flex flex-wrap items-center gap-4 text-muted-foreground text-xs sm:ml-auto sm:justify-end">
					<p>
						{m.public_footer_copyright({
							year: new Date().getFullYear(),
							name: brand.name,
						})}
					</p>
					<Link
						aria-label={m.public_footer_ready()}
						className="inline-flex items-center gap-1.5 text-primary transition-opacity hover:opacity-70"
						to="/status"
					>
						<Activity className="size-3.5" />
						<span>{m.public_footer_ready()}</span>
					</Link>
				</div>
			</div>
		</footer>
	);
}
