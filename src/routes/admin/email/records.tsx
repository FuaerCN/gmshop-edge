import { createFileRoute } from "@tanstack/react-router";
import { EmailRecordsPage } from "#/features/notifications/pages/records";

export const Route = createFileRoute("/admin/email/records")({
	component: EmailRecordsPage,
});
