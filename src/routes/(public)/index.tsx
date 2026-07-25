import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { HomePage } from "#/features/home";
import { storefrontListSchema } from "#/features/storefront/schema";
import { createHomeSeoHead } from "#/lib/seo";

export const Route = createFileRoute("/(public)/")({
	head: ({ matches }) => createHomeSeoHead(matches),
	validateSearch: (search) => storefrontListSchema.parse(search),
	search: {
		middlewares: [stripSearchParams({ search: "", tag: "", sort: "featured" })],
	},
	component: HomeRoute,
});

function HomeRoute() {
	return <HomePage searchParams={Route.useSearch()} />;
}
