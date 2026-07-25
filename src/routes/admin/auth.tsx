import { createFileRoute } from "@tanstack/react-router";
import { AuthProvidersPage } from "#/features/auth/pages/providers";

export const Route = createFileRoute("/admin/auth")({
	component: AuthProvidersPage,
});
