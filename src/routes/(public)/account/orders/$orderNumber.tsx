import { createFileRoute, redirect } from "@tanstack/react-router";
import { StorefrontOrderPage } from "#/features/storefront/pages/order";
import { getAccountOrderFn } from "#/features/storefront/server/account-functions";

export const Route = createFileRoute("/(public)/account/orders/$orderNumber")({
	validateSearch: (
		search: Record<string, unknown>,
	): { from?: "entitlements" } =>
		search.from === "entitlements" ? { from: "entitlements" } : {},
	loader: async ({ params }) => {
		try {
			return await getAccountOrderFn({
				data: { orderNumber: params.orderNumber },
			});
		} catch {
			throw redirect({ to: "/account" });
		}
	},
	component: AccountOrderRoute,
});

function AccountOrderRoute() {
	const { orderNumber } = Route.useParams();
	const { from } = Route.useSearch();
	return (
		<StorefrontOrderPage
			accountOrder={Route.useLoaderData()}
			backToEntitlements={from === "entitlements"}
			orderNumber={orderNumber}
		/>
	);
}
