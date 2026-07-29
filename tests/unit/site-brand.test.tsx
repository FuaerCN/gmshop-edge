import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteBrandProvider } from "#/context/site-brand-provider";
import { SiteCustomHtml } from "#/features/settings/components/site-custom-html";
import type { SiteBrand } from "#/features/settings/site-brand";
import { AppTitle } from "#/layouts/components/app-title";

describe("site brand presentation", () => {
	it("uses the configured name and logo in the shared app title", () => {
		const brand: SiteBrand = {
			name: "Edge Cashier",
			logoUrl: "/api/site-logo?v=7",
			title: "Edge Cashier",
			customHtml: "",
			defaultLocale: "en-US",
		};
		const markup = renderToStaticMarkup(
			<SiteBrandProvider brand={brand}>
				<AppTitle description />
			</SiteBrandProvider>,
		);
		expect(markup).toContain("Edge Cashier");
		expect(markup).toContain('src="/api/site-logo?v=7"');
		expect(markup).not.toContain("GMShop <");
	});

	it("renders trusted custom HTML exactly on the storefront surface", () => {
		const markup = renderToStaticMarkup(
			<SiteCustomHtml
				html={'<script src="https://chat.example/widget.js"></script>'}
			/>,
		);
		expect(markup).toContain("data-site-custom-html");
		expect(markup).toContain(
			'<script src="https://chat.example/widget.js"></script>',
		);
		expect(renderToStaticMarkup(<SiteCustomHtml html="" />)).toBe("");
	});
});
