import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AccountNotificationsPage } from "#/features/storefront/pages/account-sections";

const accountRoute = getRouteApi("/(public)/account");

export const Route = createFileRoute("/(public)/account/notifications")({
	component: () => (
		<AccountNotificationsPage account={accountRoute.useLoaderData()} />
	),
});
