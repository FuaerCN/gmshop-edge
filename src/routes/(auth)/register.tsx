import { createFileRoute, redirect } from "@tanstack/react-router";
import { RegisterPage } from "#/features/auth/pages/register";
import { getInstallStatus } from "#/features/installation/server/functions";

export const Route = createFileRoute("/(auth)/register")({
	loader: async () => {
		const installStatus = await getInstallStatus();
		if (!installStatus.installed) throw redirect({ to: "/install" });
	},
	component: RegisterPage,
});
