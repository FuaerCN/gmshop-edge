import { Outlet } from "@tanstack/react-router";
import { useSiteBrand } from "#/context/site-brand-provider";
import { CurrencyProvider } from "#/features/exchange-rates/currency-context";
import { SiteCustomHtml } from "#/features/settings/components/site-custom-html";
import { SkipToMain } from "#/layouts/components/skip-to-main";
import { PublicFooter } from "#/layouts/public/footer";
import { PublicHeader } from "#/layouts/public/header";

export function PublicLayout() {
	const { customHtml } = useSiteBrand();
	return (
		<CurrencyProvider>
			<div className="flex min-h-svh flex-col bg-background text-foreground">
				<SkipToMain />
				<PublicHeader />
				<main className="w-full flex-1" id="content" tabIndex={-1}>
					<Outlet />
				</main>
				<PublicFooter />
				<SiteCustomHtml html={customHtml} />
			</div>
		</CurrencyProvider>
	);
}
