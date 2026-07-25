import { createFileRoute } from "@tanstack/react-router";
import { StorefrontOrderPage } from "#/features/storefront/pages/order";

export const Route = createFileRoute("/(public)/orders/$orderNumber")({
	component: OrderRoute,
});

function OrderRoute() {
	const { orderNumber } = Route.useParams();
	return <StorefrontOrderPage orderNumber={orderNumber} />;
}
