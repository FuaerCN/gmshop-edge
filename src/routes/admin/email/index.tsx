import { createFileRoute } from "@tanstack/react-router";
import { EmailConfigurationsPage } from "#/features/notifications/pages/email-configurations";
import { validateProTableSearch } from "#/lib/pro-table-url-state";

export const Route = createFileRoute("/admin/email/")({
	validateSearch: validateProTableSearch,
	component: EmailConfigurationsPage,
});
