import { createFileRoute } from "@tanstack/react-router";
import { ProductWorkspacePage } from "#/features/catalog/pages/product-workspace";

export const Route = createFileRoute("/admin/products/$productId/")({
	component: ProductWorkspaceRoute,
});

function ProductWorkspaceRoute() {
	return <ProductWorkspacePage productId={Route.useParams().productId} />;
}
