import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleNavigation } from "#/layouts/settings/module-navigation";
import { m } from "#/paraglide/messages";

export const Route = createFileRoute("/admin/email")({
	component: Layout,
});

function Layout() {
	return (
		<ModuleNavigation
			moduleId="email-config"
			title={m.settings_group_email()}
			description={m.settings_group_email_description()}
		>
			<Outlet />
		</ModuleNavigation>
	);
}
