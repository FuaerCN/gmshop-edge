import { createFileRoute } from "@tanstack/react-router";
import { deliveryComponentTypes } from "#/features/catalog/editor-schema";
import { ProductEditorPage } from "#/features/catalog/pages/product-editor";

export const Route = createFileRoute("/admin/products/new")({
	validateSearch: (search: Record<string, unknown>) => ({
		type:
			deliveryComponentTypes.find((type) => type === search.type) ?? "stock",
	}),
	component: NewProductRoute,
});

function NewProductRoute() {
	return <ProductEditorPage initialProductType={Route.useSearch().type} />;
}
