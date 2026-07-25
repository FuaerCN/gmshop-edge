import { createFileRoute } from "@tanstack/react-router";
import { CouponsPage } from "#/features/coupons/pages/admin";
import { validateProTableSearch } from "#/lib/pro-table-url-state";

export const Route = createFileRoute("/admin/coupons")({
	validateSearch: validateProTableSearch,
	component: CouponsPage,
});
