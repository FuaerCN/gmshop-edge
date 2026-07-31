import { createFileRoute } from "@tanstack/react-router";
import { TelegramSettingsPage } from "#/features/telegram/pages/admin";

export const Route = createFileRoute("/admin/settings/telegram")({
	component: TelegramSettingsPage,
});
