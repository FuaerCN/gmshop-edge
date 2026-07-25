export function SiteCustomHtml({ html }: { html: string }) {
	if (!html) return null;
	return (
		<div
			data-site-custom-html
			// biome-ignore lint/security/noDangerouslySetInnerHtml: administrators explicitly configure trusted storefront integrations.
			dangerouslySetInnerHTML={{ __html: html }}
			suppressHydrationWarning
		/>
	);
}
