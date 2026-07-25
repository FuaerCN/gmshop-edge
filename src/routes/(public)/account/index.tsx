import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AccountOverviewPage } from "#/features/storefront/pages/account-sections";

export const Route = createFileRoute("/(public)/account/")({
	component: AccountRoute,
});

const accountRoute = getRouteApi("/(public)/account");

function AccountRoute() {
	return <AccountOverviewPage account={accountRoute.useLoaderData()} />;
}
