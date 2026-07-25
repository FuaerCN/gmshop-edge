import { createFileRoute } from "@tanstack/react-router";
import { OrderLookupPage } from "#/features/storefront/pages/order-lookup";

export const Route = createFileRoute("/(public)/orders/")({
	component: OrderLookupPage,
});
