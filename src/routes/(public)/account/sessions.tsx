import { createFileRoute } from "@tanstack/react-router";
import { AccountSessionsPage } from "#/features/storefront/pages/account-sections";

export const Route = createFileRoute("/(public)/account/sessions")({
	component: AccountSessionsPage,
});
