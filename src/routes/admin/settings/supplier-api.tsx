import { createFileRoute } from "@tanstack/react-router";
import { SupplierApiAdminPage } from "#/features/supplier-api/pages/admin";

export const Route = createFileRoute("/admin/settings/supplier-api")({
	component: SupplierApiAdminPage,
});
