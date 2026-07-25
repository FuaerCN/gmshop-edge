import { createFileRoute } from "@tanstack/react-router";
import { CustomersPage } from "#/features/customers/pages/admin";
import { validateProTableSearch } from "#/lib/pro-table-url-state";

export const Route = createFileRoute("/admin/customers")({
	validateSearch: validateProTableSearch,
	component: CustomersPage,
});
