import { createFileRoute } from "@tanstack/react-router";
import { ShopOrdersPage } from "#/features/shop-orders/pages/admin";
import { validateProTableSearch } from "#/lib/pro-table-url-state";
export const Route = createFileRoute("/admin/orders")({
	validateSearch: validateProTableSearch,
	component: ShopOrdersPage,
});
