import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { UsersPage } from "#/features/users/pages/admin";
import { validateProTableSearch } from "#/lib/pro-table-url-state";

const adminRoute = getRouteApi("/admin");

export const Route = createFileRoute("/admin/access/users")({
	validateSearch: validateProTableSearch,
	component: () => (
		<UsersPage
			permissions={adminRoute.useLoaderData().systemAccess.permissions}
		/>
	),
});
