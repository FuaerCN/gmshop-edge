import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const settingsRoot = "src/features/settings";

describe("settings page ownership", () => {
	it("mounts the Brand page directly on the settings index route", () => {
		const route = read("src/routes/admin/settings/index.tsx");
		expect(route).toContain('from "#/features/settings/pages/brand"');
		expect(route).toContain("component: BrandSettingsPage");
		expect(route).not.toContain("SystemSettingsSection");
	});

	it("keeps Brand assets out of the data-driven settings page", () => {
		const ordinaryPage = read(`${settingsRoot}/pages/admin.tsx`);
		const brandPage = read(`${settingsRoot}/pages/brand.tsx`);
		const assetField = read(`${settingsRoot}/components/site-asset-field.tsx`);
		const queries = read(`${settingsRoot}/queries.ts`);

		expect(ordinaryPage).not.toMatch(
			/SiteLogoField|SiteBackgroundField|uploadSiteLogoFn|group === "brand"/,
		);
		expect(brandPage).toContain("<SiteLogoField");
		expect(brandPage).not.toMatch(/SiteBackgroundField|site\.background_/);
		expect(brandPage).toContain('name="site.custom_html"');
		expect(brandPage).toContain("<ProEditor");
		expect(brandPage).toContain('language="html"');
		expect(brandPage).toContain("component: CustomHtmlPreview");
		expect(brandPage).toContain("theme={resolvedTheme}");
		expect(brandPage).toContain("<HtmlViewer");
		expect(brandPage.match(/theme=\{resolvedTheme\}/g)).toHaveLength(2);
		for (const page of [ordinaryPage, brandPage]) {
			expect(page).toContain("useQuery(systemSettingsQueryOptions)");
			expect(page).toContain("queryKey: systemSettingsQueryKey");
		}
		expect(queries).toContain(
			'export const systemSettingsQueryKey = ["admin", "system-settings"]',
		);
		expect(queries).toContain("staleTime: 5 * 60_000");
		expect(brandPage).toContain("await router.invalidate({");
		expect(brandPage).toContain(
			'filter: (match) => match.routeId === "__root__"',
		);
		expect(assetField).toContain("validateSquareImage");
		expect(assetField).toContain("fileDataUrl(file)");
		expect(assetField).toContain("file.size > maxBytes");
		expect(assetField).toContain("<img");
		expect(assetField).toContain("await remove()");
		expect(assetField.match(/await onChanged\(\)/g)).toHaveLength(2);
	});

	it("keeps all six ordinary groups on one data-driven form contract", () => {
		const groups = {
			access: "access",
			fulfillment: "fulfillment",
			operations: "operations",
			orders: "orders",
			retention: "retention",
			secrets: "secrets",
		} as const;
		for (const [routeName, group] of Object.entries(groups)) {
			const route = read(`src/routes/admin/settings/${routeName}.tsx`);
			expect(route, routeName).toContain(
				'from "#/features/settings/pages/admin"',
			);
			expect(route, routeName).toContain(
				`<SystemSettingsSection group="${group}" />`,
			);
		}
	});

	it("keeps secret display on the permission-protected settings query", () => {
		const page = read(`${settingsRoot}/pages/admin.tsx`);
		const server = read(`${settingsRoot}/server/admin.ts`);

		expect(page).not.toMatch(/SecretUnlockPanel|revealSystemSettingsSecretsFn/);
		expect(server).not.toMatch(
			/revealSystemSettingsSecretsFn|system_settings\.secrets_revealed/,
		);
		expect(page).toContain("settings_secret_configured");
		expect(server).toContain('systemPermission("settings", "read")');
	});

	it("keeps currency rates on the settings page scroll and exposes every maintained currency", () => {
		const ratePage = read("src/features/exchange-rates/pages/admin.tsx");
		const publicRates = read("src/features/exchange-rates/server/public.ts");
		const switchSource = read(
			"src/features/exchange-rates/currency-switch.tsx",
		);
		expect(ratePage).toContain('layout="full"');
		expect(ratePage).not.toContain("exchange_rates_sync_status_unconfigured");
		expect(publicRates).toContain("available.flatMap");
		expect(switchSource).toContain("overflow-y-auto");
	});
});

function read(path: string) {
	return readFileSync(resolve(path), "utf8");
}
