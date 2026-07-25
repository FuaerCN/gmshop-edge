import { createFileRoute } from "@tanstack/react-router";
import { SupplierProductsPage } from "#/features/suppliers/pages/products";
import { validateProTableSearch } from "#/lib/pro-table-url-state";

const supplierProductStatuses = new Set([
	"not_imported",
	"imported",
	"stopped",
	"cost_changed",
	"no_account",
	"sync_error",
]);

export const Route = createFileRoute("/admin/suppliers/products")({
	validateSearch: (search) => {
		const result = validateProTableSearch(search) as ReturnType<
			typeof validateProTableSearch
		> & { source?: string; status?: string };
		if (
			typeof search.source === "string" &&
			search.source.length > 0 &&
			search.source.length <= 2300
		)
			result.source = search.source;
		if (
			typeof search.status === "string" &&
			supplierProductStatuses.has(search.status)
		)
			result.status = search.status;
		return result;
	},
	component: SupplierProductsPage,
});
