import { createFileRoute, redirect } from "@tanstack/react-router";
import { AccountLayout } from "#/features/storefront/components/account-layout";
import { getStoreAccountFn } from "#/features/storefront/server/account-functions";

export const Route = createFileRoute("/(public)/account")({
	loader: async ({ location }) => {
		try {
			return await getStoreAccountFn();
		} catch {
			throw redirect({ to: "/sign-in", search: { redirect: location.href } });
		}
	},
	component: AccountLayoutRoute,
});

function AccountLayoutRoute() {
	return <AccountLayout />;
}
