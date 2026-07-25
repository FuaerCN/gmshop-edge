import { createFileRoute } from "@tanstack/react-router";
import { DeliveryCenterPage } from "#/features/fulfillment/pages/admin";

export const Route = createFileRoute("/admin/delivery")({
	component: DeliveryCenterPage,
});
