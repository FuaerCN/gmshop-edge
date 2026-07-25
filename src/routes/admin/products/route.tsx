import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/products")({
	component: ProductsLayout,
});

function ProductsLayout() {
	return <Outlet />;
}
