import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "#/features/catalog/pages/products";

export const Route = createFileRoute("/admin/products/trash")({
	component: () => <ProductsPage view="trash" />,
});
