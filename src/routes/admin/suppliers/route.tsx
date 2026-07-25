import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ModuleNavigation } from "#/layouts/settings/module-navigation";
import { m } from "#/paraglide/messages";

export const Route = createFileRoute("/admin/suppliers")({
	component: SupplierLayout,
});

function SupplierLayout() {
	return (
		<ModuleNavigation
			moduleId="suppliers"
			title={m.nav_supplier_management()}
			description={m.supplier_management_description()}
		>
			<Outlet />
		</ModuleNavigation>
	);
}
