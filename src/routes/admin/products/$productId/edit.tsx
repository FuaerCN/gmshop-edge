import { createFileRoute } from "@tanstack/react-router";
import { ProductEditorPage } from "#/features/catalog/pages/product-editor";

export const Route = createFileRoute("/admin/products/$productId/edit")({
	component: ProductEditorRoute,
});

function ProductEditorRoute() {
	return <ProductEditorPage productId={Route.useParams().productId} />;
}
