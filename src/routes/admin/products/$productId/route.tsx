import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/products/$productId")({
	component: ProductLayout,
});

function ProductLayout() {
	return <Outlet />;
}
