import { createFileRoute } from "@tanstack/react-router";
import { StorefrontProductPage } from "#/features/storefront/pages/product";

export const Route = createFileRoute("/(public)/products/$productId")({
	component: ProductRoute,
});

function ProductRoute() {
	const { productId } = Route.useParams();
	return <StorefrontProductPage productId={productId} />;
}
