import { createFileRoute } from "@tanstack/react-router";
import { StorefrontMePage } from "#/features/storefront/pages/me";
import { createDefaultSeoHead, siteNameFromMatches } from "#/lib/seo";
import { m } from "#/paraglide/messages";

export const Route = createFileRoute("/(public)/me")({
	head: ({ matches }) => {
		const siteName = siteNameFromMatches(matches);
		return createDefaultSeoHead({
			title: `${m.store_my_title()} – ${siteName}`,
			description: m.store_my_description(),
			path: "/me",
			siteName,
		});
	},
	component: StorefrontMePage,
});
