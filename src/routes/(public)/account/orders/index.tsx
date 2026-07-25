import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AccountOrdersPage } from "#/features/storefront/pages/account-sections";

export const Route = createFileRoute("/(public)/account/orders/")({
	component: OrdersRoute,
});
const accountRoute = getRouteApi("/(public)/account");
function OrdersRoute() {
	return <AccountOrdersPage account={accountRoute.useLoaderData()} />;
}
