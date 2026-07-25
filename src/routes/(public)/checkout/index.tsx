import { createFileRoute } from "@tanstack/react-router";
import { StorefrontCheckoutPage } from "#/features/storefront/pages/checkout";
import { checkoutSearchSchema } from "#/features/storefront/schema";

export const Route = createFileRoute("/(public)/checkout/")({
	component: StorefrontCheckoutPage,
	validateSearch: checkoutSearchSchema,
});
