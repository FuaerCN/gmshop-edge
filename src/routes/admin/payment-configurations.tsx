import { createFileRoute } from "@tanstack/react-router";
import { PaymentConfigurationsPage } from "#/features/shop-payments/pages/admin";

export const Route = createFileRoute("/admin/payment-configurations")({
	component: PaymentConfigurationsPage,
});
