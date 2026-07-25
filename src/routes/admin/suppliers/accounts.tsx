import { createFileRoute } from "@tanstack/react-router";
import { SupplierAccountsPage } from "#/features/suppliers/pages/accounts";
import { validateProTableSearch } from "#/lib/pro-table-url-state";

export const Route = createFileRoute("/admin/suppliers/accounts")({
	validateSearch: validateProTableSearch,
	component: SupplierAccountsPage,
});
