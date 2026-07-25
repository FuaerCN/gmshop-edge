import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AccountSettingsPage } from "#/features/storefront/pages/account-sections";

const accountRoute = getRouteApi("/(public)/account");

export const Route = createFileRoute("/(public)/account/settings")({
	component: () => (
		<AccountSettingsPage account={accountRoute.useLoaderData()} />
	),
});
