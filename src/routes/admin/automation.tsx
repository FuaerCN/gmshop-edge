import { createFileRoute } from "@tanstack/react-router";
import { AutomationCenterPage } from "#/features/builds/pages/center";

export const Route = createFileRoute("/admin/automation")({
	component: AutomationCenterPage,
});
