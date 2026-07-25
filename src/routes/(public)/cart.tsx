import { createFileRoute } from "@tanstack/react-router";
import { StorefrontCartPage } from "#/features/storefront/pages/cart";

export const Route = createFileRoute("/(public)/cart")({
	component: StorefrontCartPage,
});
