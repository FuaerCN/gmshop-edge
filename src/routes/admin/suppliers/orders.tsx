import { createFileRoute } from "@tanstack/react-router";
import { SupplierOrdersPage } from "#/features/suppliers/pages/orders";
import { validateProTableSearch } from "#/lib/pro-table-url-state";

export const Route = createFileRoute("/admin/suppliers/orders")({
	validateSearch: validateProTableSearch,
	component: SupplierOrdersPage,
});
