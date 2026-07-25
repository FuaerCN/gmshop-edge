import { createFileRoute } from "@tanstack/react-router";
import { OrderWorkspacePage } from "#/features/shop-orders/pages/workspace";

export const Route = createFileRoute("/admin/orders/$orderId")({
	component: OrderWorkspaceRoute,
});

function OrderWorkspaceRoute() {
	return <OrderWorkspacePage orderId={Route.useParams().orderId} />;
}
