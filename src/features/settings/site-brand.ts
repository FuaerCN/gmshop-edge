import type { SupportedLocale } from "#/lib/locales";

export type SiteBrand = {
	name: string;
	description?: string;
	logoUrl: string;
	title: string;
	seoDescription?: string;
	customHtml: string;
	backgroundColor: string;
	backgroundImageUrl: string;
	defaultLocale: SupportedLocale;
};

export const defaultSiteBrand: SiteBrand = {
	name: "GMShop Edge",
	logoUrl: "/favicon.png",
	title: "GMShop Edge",
	customHtml: "",
	backgroundColor: "",
	backgroundImageUrl: "",
	defaultLocale: "en-US",
};
