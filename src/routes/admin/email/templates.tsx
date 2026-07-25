import { createFileRoute } from "@tanstack/react-router";
import { EmailTemplatesPage } from "#/features/notifications/pages/email-templates";

export const Route = createFileRoute("/admin/email/templates")({
	component: EmailTemplatesPage,
});
