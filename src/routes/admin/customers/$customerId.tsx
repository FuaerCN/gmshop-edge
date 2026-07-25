import { createFileRoute } from "@tanstack/react-router";
import { CustomerWorkspacePage } from "#/features/customers/pages/workspace";

export const Route = createFileRoute("/admin/customers/$customerId")({
	component: CustomerWorkspaceRoute,
});

function CustomerWorkspaceRoute() {
	return <CustomerWorkspacePage customerId={Route.useParams().customerId} />;
}
