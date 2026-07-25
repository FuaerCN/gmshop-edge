import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AccountEntitlementsPage } from "#/features/storefront/pages/account-sections";

export const Route = createFileRoute("/(public)/account/entitlements/")({
	component: EntitlementsRoute,
});
const accountRoute = getRouteApi("/(public)/account");
function EntitlementsRoute() {
	return <AccountEntitlementsPage account={accountRoute.useLoaderData()} />;
}
