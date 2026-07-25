import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	hasSystemPermission,
	systemPermission,
} from "#/features/access/system-rbac";
import {
	AdminDashboardPage,
	dashboardQuery,
} from "#/features/dashboard/pages/admin";
import { tasksQuery } from "#/features/dashboard/pages/tasks";
import { firstAllowedAdminUrl } from "#/layouts/components/data/sidebar-data";

export const Route = createFileRoute("/admin/")({
	loader: async ({ context, parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise;
		const parentData = parentMatch.loaderData;
		if (!parentData) throw redirect({ to: "/403" });
		const { systemAccess } = parentData;
		if (
			hasSystemPermission(
				systemAccess.permissions,
				systemPermission("dashboard", "read"),
			)
		) {
			void context.queryClient.prefetchQuery(dashboardQuery);
			void context.queryClient.prefetchQuery(tasksQuery);
			return;
		}
		throw redirect({
			to: firstAllowedAdminUrl(systemAccess.permissions) ?? "/403",
		});
	},
	component: AdminDashboardPage,
});
